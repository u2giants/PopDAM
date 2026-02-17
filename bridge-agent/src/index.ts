import path from "path";
import fs from "fs/promises";
import { config } from "./config";
import { registerAgent, heartbeat, ingestAsset, updateAsset, queueRender } from "./api";
import { scan, ScannedFile } from "./scanner";
import { generateThumbnail, readThumbnailBase64 } from "./thumbnail";
import { uploadToSpaces } from "./s3";

let agentId: string;

/** Upload thumbnail to DO Spaces and return the public URL */
async function uploadThumbnail(thumbPath: string, assetId: string): Promise<string> {
  const key = `thumbnails/${assetId}.jpg`;
  const url = await uploadToSpaces(thumbPath, key);
  return url;
}

/** Process a batch of newly discovered files */
async function processBatch(files: ScannedFile[]) {
  console.log(`[Agent] Processing batch of ${files.length} files`);

  for (const file of files) {
    try {
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
          // Thumbnail generation failed (e.g. AI file without PDF compat)
          console.warn(`[Agent] Thumbnail failed (${result.reason}): ${file.filename}`);
          await updateAsset(asset.id, { thumbnail_error: result.reason });
          // Queue for Windows render agent
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
    } catch (err: any) {
      console.error(`[Agent] Failed to ingest ${file.filename}: ${err.message}`);
    }
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
      const normalized = asset.file_path.replace(/\\/g, "/");
      if (!normalized.includes("edgesynology2/mac")) {
        skipped++;
        continue;
      }

      const localPath = normalized.replace(/^\/\/edgesynology2\/mac/, "/mnt/nas/mac");
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
      const normalized = asset.file_path.replace(/\\/g, "/");
      if (!normalized.includes("edgesynology2/mac")) {
        skipped++;
        continue;
      }

      const localPath = normalized.replace(/^\/\/edgesynology2\/mac/, "/mnt/nas/mac");

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

/** Main loop */
async function main() {
  // Check for CLI modes
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
  console.log(`  Agent:  ${config.agentName}`);
  console.log(`  Roots:  ${config.scanRoots.join(", ")}`);
  console.log(`  Since:  ${config.scanMinDate}`);
  console.log(`  Interval: ${config.scanIntervalMinutes}m`);
  console.log(`  Storage: DO Spaces (${config.spacesBucket}.${config.spacesRegion})`);
  console.log("==============================================");

  // Register with the API
  const agent = await registerAgent();
  agentId = agent.id;

  // Heartbeat every 5 minutes
  setInterval(async () => {
    try {
      await heartbeat();
    } catch (err: any) {
      console.warn(`[Agent] Heartbeat failed: ${err.message}`);
    }
  }, 5 * 60 * 1000);

  // Initial scan
  await runScanCycle();

  // Scheduled scans
  setInterval(runScanCycle, config.scanIntervalMinutes * 60 * 1000);
  console.log(`[Agent] Scheduled scan every ${config.scanIntervalMinutes} minutes`);
}

async function runScanCycle() {
  try {
    const newFiles = await scan();
    if (newFiles.length > 0) {
      for (let i = 0; i < newFiles.length; i += 20) {
        const batch = newFiles.slice(i, i + 20);
        await processBatch(batch);
      }
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
