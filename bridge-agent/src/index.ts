import path from "path";
import fs from "fs/promises";
import { config } from "./config";
import { registerAgent, heartbeat, ingestAsset, updateAsset, queueRender, checkScanRequest, reportScanProgress, reportIngestionProgress, getConfiguredScanRoots } from "./api";
import { scan, saveState, validateScanRoots, ScannedFile, ScanResult } from "./scanner";
import { generateThumbnail, readThumbnailBase64 } from "./thumbnail";
import { uploadToSpaces } from "./s3";
import { flushStats } from "./transferStats";
import { runNormalizer } from "./tiff-normalizer";

let agentId: string;

// === Helpers for UNC ↔ local path conversion ===

/** Convert a stored UNC path to a local container path using config */
function uncToLocal(uncPath: string): string | null {
  const normalized = uncPath.replace(/\\/g, "/");
  const prefix = `//${config.nasHost}/${config.nasShare}`;
  if (!normalized.startsWith(prefix)) return null;
  const relative = normalized.slice(prefix.length);
  return `${config.nasMountRoot}${relative}`;
}

/** Check if a UNC path belongs to our configured NAS host/share */
function isOurAsset(uncPath: string): boolean {
  return uncToLocal(uncPath) !== null;
}

/** Upload thumbnail to DO Spaces and return the public URL */
async function uploadThumbnail(thumbPath: string, assetId: string): Promise<string> {
  const key = `thumbnails/${assetId}.jpg`;
  const url = await uploadToSpaces(thumbPath, key);
  return url;
}

/** Process a batch of newly discovered files (original — no tracking) */
async function processBatch(files: ScannedFile[]) {
  console.log(`[Agent] Processing batch of ${files.length} files`);
  for (const file of files) {
    try {
      await ingestAndThumbnail(file);
    } catch (err: any) {
      console.error(`[Agent] Failed to ingest ${file.filename}: ${err.message}`);
    }
  }
}

interface BatchResult {
  hash: string;
  success: boolean;
}

/** Process a batch with per-file success tracking */
async function processBatchTracked(files: ScannedFile[]): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const file of files) {
    try {
      await ingestAndThumbnail(file);
      results.push({ hash: file.sha256, success: true });
    } catch (err: any) {
      console.error(`[Agent] Failed to ingest ${file.filename}: ${err.message}`);
      results.push({ hash: file.sha256, success: false });
    }
  }
  return results;
}

/** Ingest a single file: create DB record, generate thumbnail, upload */
async function ingestAndThumbnail(file: ScannedFile) {
  console.log(`[Agent] Ingesting: ${file.filename}`);

  // 1. Ingest the asset record
  const { asset } = await ingestAsset({
    filename: file.filename,
    file_path: file.uncPath,
    file_type: file.fileType,
    file_size: file.fileSize,
    width: 0,
    height: 0,
    artboards: 1,
    modified_at: file.modifiedAt.toISOString(),
    file_created_at: file.createdAt.toISOString(),
  });

  // 2. Generate thumbnail, upload to DO Spaces, update asset
  try {
    const result = await generateThumbnail(file.filePath, file.fileType, asset.id);

    if (result.success) {
      const thumbnailUrl = await uploadThumbnail(result.thumbnailPath, asset.id);
      await updateAsset(asset.id, {
        thumbnail_url: thumbnailUrl,
        width: result.width,
        height: result.height,
        status: "processing",
      });
      console.log(`[Agent] Thumbnail uploaded: ${result.width}x${result.height} → ${thumbnailUrl}`);
    } else {
      console.warn(`[Agent] Thumbnail failed (${result.reason}): ${file.filename}`);
      await updateAsset(asset.id, { thumbnail_error: result.reason });
      try {
        await queueRender(asset.id, result.reason);
        console.log(`[Agent] Queued render job for ${file.filename}`);
      } catch (queueErr: any) {
        console.warn(`[Agent] Failed to queue render: ${queueErr.message}`);
      }
    }
  } catch (thumbErr: any) {
    console.warn(`[Agent] Thumbnail failed for ${file.filename}: ${thumbErr.message}`);
  }
}

/** Reprocess: generate thumbnails for existing assets that have none */
async function reprocess() {
  console.log("[Reprocess] Fetching assets without thumbnails...");

  const baseUrl = `${config.supabaseUrl}/rest/v1/assets`;
  const batchSize = 1000;
  let offset = 0;
  let allAssets: { id: string; file_path: string; file_type: "psd" | "ai" }[] = [];

  while (true) {
    const params = new URLSearchParams({
      select: "id,file_path,file_type",
      or: "(thumbnail_url.is.null,thumbnail_url.like.data:*)",
      limit: String(batchSize),
      offset: String(offset),
    });

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
    const page = (await res.json()) as { id: string; file_path: string; file_type: "psd" | "ai" }[];
    allAssets = allAssets.concat(page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`[Reprocess] Found ${allAssets.length} assets to process`);

  let success = 0;
  let failed = 0;
  let skipped = 0;
  let queued = 0;

  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    try {
      const localPath = uncToLocal(asset.file_path);
      if (!localPath) {
        skipped++;
        continue;
      }

      console.log(`[Reprocess] [${i + 1}/${allAssets.length}] Processing: ${asset.file_type.toUpperCase()} ${path.basename(asset.file_path)}`);

      const result = await generateThumbnail(localPath, asset.file_type, asset.id);

      if (result.success) {
        const thumbnailUrl = await uploadThumbnail(result.thumbnailPath, asset.id);
        await updateAsset(asset.id, {
          thumbnail_url: thumbnailUrl,
          width: result.width,
          height: result.height,
          status: "processing",
        });
        success++;
        console.log(`[Reprocess] ✓ ${result.width}x${result.height} → ${thumbnailUrl}`);
      } else {
        // Flag and queue for Windows agent
        await updateAsset(asset.id, { thumbnail_error: result.reason });
        try {
          await queueRender(asset.id, result.reason);
          queued++;
        } catch { /* ignore queue errors */ }
        failed++;
        console.warn(`[Reprocess] ✗ ${asset.id}: ${result.message}`);
      }
    } catch (err: any) {
      failed++;
      console.warn(`[Reprocess] ✗ ${asset.id}: ${err.message}`);
    }
  }

  console.log(`[Reprocess] Done. Success: ${success}, Failed: ${failed}, Queued: ${queued}, Skipped: ${skipped}`);
}

/** Backfill: queue all AI assets without thumbnails for the Windows render agent */
async function queueFailedThumbs() {
  console.log("[QueueFailedThumbs] Fetching AI assets without thumbnails...");

  const baseUrl = `${config.supabaseUrl}/rest/v1/assets`;
  const batchSize = 1000;
  let offset = 0;
  let allAssets: { id: string; filename: string }[] = [];

  while (true) {
    const params = new URLSearchParams({
      select: "id,filename",
      file_type: "eq.ai",
      thumbnail_url: "is.null",
      limit: String(batchSize),
      offset: String(offset),
    });

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
    const page = (await res.json()) as { id: string; filename: string }[];
    allAssets = allAssets.concat(page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`[QueueFailedThumbs] Found ${allAssets.length} AI assets to queue`);

  let queued = 0;
  for (const asset of allAssets) {
    try {
      await queueRender(asset.id, "no_pdf_compat");
      await updateAsset(asset.id, { thumbnail_error: "no_pdf_compat" });
      queued++;
      if (queued % 50 === 0) console.log(`[QueueFailedThumbs] Queued ${queued}/${allAssets.length}`);
    } catch (err: any) {
      console.warn(`[QueueFailedThumbs] Failed to queue ${asset.id}: ${err.message}`);
    }
  }

  console.log(`[QueueFailedThumbs] Done. Queued: ${queued}`);
}

/** Backfill real file modification dates for all assets */
async function backfillDates() {
  console.log("[BackfillDates] Fetching all assets...");

  const baseUrl = `${config.supabaseUrl}/rest/v1/assets`;
  const batchSize = 1000;
  let offset = 0;
  let allAssets: { id: string; file_path: string }[] = [];

  while (true) {
    const params = new URLSearchParams({
      select: "id,file_path",
      limit: String(batchSize),
      offset: String(offset),
    });

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
    const page = (await res.json()) as { id: string; file_path: string }[];
    allAssets = allAssets.concat(page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`[BackfillDates] Found ${allAssets.length} assets to check`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    try {
      const localPath = uncToLocal(asset.file_path);
      if (!localPath) {
        skipped++;
        continue;
      }

      const stat = await fs.stat(localPath);
      const modifiedAt = stat.mtime.toISOString();
      const createdAt = stat.birthtime.toISOString();

      await updateAsset(asset.id, { modified_at: modifiedAt, file_created_at: createdAt });
      updated++;

      if (updated % 100 === 0) {
        console.log(`[BackfillDates] Progress: ${updated} updated, ${skipped} skipped, ${failed} failed (${i + 1}/${allAssets.length})`);
      }
    } catch {
      failed++;
    }
  }

  console.log(`[BackfillDates] Done. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

/** Reset all local state (scan-state.json + thumbnail cache) */
async function resetLocalState() {
  console.log("[Reset] Clearing local scan state and thumbnail cache...");

  // 1. Delete scan-state.json
  const stateFile = path.join(config.dataDir, "scan-state.json");
  try {
    await fs.unlink(stateFile);
    console.log("[Reset] ✓ Deleted scan-state.json");
  } catch (err: any) {
    if (err.code === "ENOENT") console.log("[Reset] scan-state.json not found (already clean)");
    else console.warn(`[Reset] Failed to delete scan-state.json: ${err.message}`);
  }

  // 2. Delete thumbnail cache directory
  const thumbDir = path.join(config.dataDir, "thumbnails");
  try {
    await fs.rm(thumbDir, { recursive: true, force: true });
    console.log("[Reset] ✓ Deleted thumbnail cache");
  } catch (err: any) {
    console.warn(`[Reset] Failed to delete thumbnail cache: ${err.message}`);
  }

  console.log("[Reset] Local state cleared.");
}

/** Main loop */
async function main() {
  // Check for CLI modes
  if (process.argv.includes("--reset")) {
    const withDb = process.argv.includes("--with-db");
    await resetLocalState();
    if (withDb) {
      console.log("[Reset] Also wiping database tables via API...");
      try {
        const agent = await registerAgent();
        const res = await fetch(`${config.supabaseUrl}/functions/v1/agent-api/full-reset`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
          },
          body: JSON.stringify({ agent_key: config.agentKey }),
        });
        const data = await res.json();
        if (res.ok) {
          console.log("[Reset] ✓ Database wiped:", JSON.stringify(data));
        } else {
          console.error("[Reset] ✗ Database wipe failed:", JSON.stringify(data));
        }
      } catch (err: any) {
        console.error("[Reset] ✗ Database wipe failed:", err.message);
      }
    }
    console.log("[Reset] Done. Restart the agent to begin a fresh scan.");
    process.exit(0);
  }

  if (process.argv.includes("--normalize-tiffs")) {
    const folderIdx = process.argv.indexOf("--folder");
    const folder = folderIdx !== -1 ? process.argv[folderIdx + 1] : null;
    const dryRun = process.argv.includes("--dry-run");
    const roots = folder ? [folder] : config.scanRoots;
    await runNormalizer({ roots, dryRun });
    process.exit(0);
  }

  if (process.argv.includes("--backfill-dates")) {
    await backfillDates();
    process.exit(0);
  }

  if (process.argv.includes("--reprocess")) {
    await reprocess();
    process.exit(0);
  }

  if (process.argv.includes("--queue-failed-thumbs")) {
    await queueFailedThumbs();
    process.exit(0);
  }

  console.log("==============================================");
  console.log(" DAM Bridge Agent");
  console.log(`  Agent:    ${config.agentName}`);
  console.log(`  NAS:      \\\\${config.nasHost}\\${config.nasShare} → ${config.nasMountRoot}`);
  console.log(`  Roots:    ${config.scanRoots.join(", ")}`);
  console.log(`  Since:    ${config.scanMinDate}`);
  console.log(`  Interval: ${config.scanIntervalMinutes}m`);
  console.log(`  Storage:  DO Spaces (${config.spacesBucket}.${config.spacesRegion})`);
  console.log("==============================================");

  // Register with the API
  const agent = await registerAgent();
  agentId = agent.id;

  // Heartbeat every 60 seconds (with transfer stats)
  setInterval(async () => {
    try {
      const stats = flushStats();
      await heartbeat(stats);
    } catch (err: any) {
      console.warn(`[Agent] Heartbeat failed: ${err.message}`);
    }
  }, 60 * 1000);

  // Poll for manual scan requests every 15 seconds
  let scanRunning = false;
  setInterval(async () => {
    if (scanRunning) return;
    try {
      const { scan_requested } = await checkScanRequest();
      if (scan_requested) {
        console.log("[Agent] Manual scan requested from UI!");
        scanRunning = true;
        await runScanCycle();
        scanRunning = false;
      }
    } catch (err: any) {
      console.warn(`[Agent] Scan request check failed: ${err.message}`);
    }
  }, 15_000);

  // Initial scan
  scanRunning = true;
  await runScanCycle();
  scanRunning = false;

  // Scheduled scans
  setInterval(async () => {
    if (scanRunning) return;
    scanRunning = true;
    await runScanCycle();
    scanRunning = false;
  }, config.scanIntervalMinutes * 60 * 1000);
  console.log(`[Agent] Scheduled scan every ${config.scanIntervalMinutes} minutes`);
}

async function runScanCycle() {
  try {
    // Fetch scan roots from admin UI config, falling back to env vars
    const remoteRoots = await getConfiguredScanRoots();
    const scanRoots = remoteRoots && remoteRoots.length > 0 ? remoteRoots : config.scanRoots;
    console.log(`[Agent] Using scan roots: ${scanRoots.join(", ")}`);

    const result: ScanResult = await scan(scanRoots);
    const { newFiles, updatedKnownFiles, scanStartTime } = result;

    if (newFiles.length > 0) {
      let ingested = 0;
      let failed = 0;
      const successHashes = new Set<string>();

      // Report initial ingestion progress
      try { await reportIngestionProgress(newFiles.length, 0); } catch { /* ignore */ }

      for (let i = 0; i < newFiles.length; i += 20) {
        const batch = newFiles.slice(i, i + 20);
        const batchResults = await processBatchTracked(batch);

        // Track which files were successfully ingested
        for (const r of batchResults) {
          if (r.success) {
            successHashes.add(r.hash);
            ingested++;
          } else {
            failed++;
          }
        }

        // Report ingestion progress every batch
        try { await reportIngestionProgress(newFiles.length, ingested + failed); } catch { /* ignore */ }

        // Save state incrementally every 10 batches (200 files)
        // Only persist hashes of files that were SUCCESSFULLY ingested
        if ((i / 20) % 10 === 9) {
          const safeKnownFiles = updatedKnownFiles.filter(
            kf => !newFiles.some(nf => nf.sha256 === kf.hash) || successHashes.has(kf.hash)
          );
          await saveState({ lastScanTime: scanStartTime, knownFiles: safeKnownFiles });
          console.log(`[Agent] Checkpoint saved: ${successHashes.size} ingested, ${failed} failed`);
        }
      }

      // Final state save — only include successfully ingested new files
      const finalKnownFiles = updatedKnownFiles.filter(
        kf => !newFiles.some(nf => nf.sha256 === kf.hash) || successHashes.has(kf.hash)
      );
      await saveState({ lastScanTime: scanStartTime, knownFiles: finalKnownFiles });

      console.log(`[Agent] Ingestion complete. Success: ${ingested}, Failed: ${failed}`);
      if (failed > 0) {
        console.log(`[Agent] ${failed} failed files will be retried on next scan cycle.`);
      }

      // Clear ingestion progress when done
      try { await reportIngestionProgress(0, 0); } catch { /* ignore */ }
    } else {
      // No new files, but still save state (for move detections, lastScanTime)
      await saveState({ lastScanTime: scanStartTime, knownFiles: updatedKnownFiles });
    }
  } catch (err: any) {
    console.error(`[Agent] Scan cycle failed: ${err.message}`);
  }
}

// Start
main().catch((err) => {
  console.error("[Agent] Fatal error:", err);
  process.exit(1);
});
