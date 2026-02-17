import path from "path";
import { config } from "./config";
import { registerAgent, heartbeat, ingestAsset, updateAsset } from "./api";
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
      });

      // 2. Generate thumbnail, upload to DO Spaces, update asset
      try {
        const thumb = await generateThumbnail(file.filePath, file.fileType, asset.id);
        const thumbnailUrl = await uploadThumbnail(thumb.thumbnailPath, asset.id);

        await updateAsset(asset.id, {
          thumbnail_url: thumbnailUrl,
          width: thumb.width,
          height: thumb.height,
          status: "processing",
        });
        console.log(`[Agent] Thumbnail uploaded: ${thumb.width}x${thumb.height} → ${thumbnailUrl}`);
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

  // Paginate to get ALL assets without thumbnails
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

    if (!res.ok) {
      throw new Error(`Failed to fetch assets: ${res.status}`);
    }

    const page = (await res.json()) as { id: string; file_path: string; file_type: "psd" | "ai" }[];
    allAssets = allAssets.concat(page);

    if (page.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`[Reprocess] Found ${allAssets.length} assets to process`);

  let success = 0;
  let failed = 0;

  let skipped = 0;

  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    try {
      // Convert UNC path (backslashes) to local mount path (forward slashes)
      const normalized = asset.file_path.replace(/\\/g, "/");

      // Only process paths from edgesynology2 — skip unknown/legacy UNC prefixes
      if (!normalized.includes("edgesynology2/mac")) {
        skipped++;
        continue;
      }

      const localPath = normalized.replace(/^\/\/edgesynology2\/mac/, "/mnt/nas/mac");

      // Log every attempt so it doesn't appear to hang
      console.log(`[Reprocess] [${i + 1}/${allAssets.length}] Processing: ${asset.file_type.toUpperCase()} ${path.basename(asset.file_path)}`);

      const thumb = await generateThumbnail(localPath, asset.file_type, asset.id);
      const thumbnailUrl = await uploadThumbnail(thumb.thumbnailPath, asset.id);

      await updateAsset(asset.id, {
        thumbnail_url: thumbnailUrl,
        width: thumb.width,
        height: thumb.height,
        status: "processing",
      });

      success++;
      console.log(`[Reprocess] ✓ ${thumb.width}x${thumb.height} → ${thumbnailUrl}`);
    } catch (err: any) {
      failed++;
      console.warn(`[Reprocess] ✗ ${asset.id}: ${err.message}`);
    }
  }

  console.log(`[Reprocess] Done. Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
}

/** Main loop */
async function main() {
  // Check for reprocess mode
  if (process.argv.includes("--reprocess")) {
    await reprocess();
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
