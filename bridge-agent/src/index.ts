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
  const params = new URLSearchParams({
    select: "id,file_path,file_type",
    or: "(thumbnail_url.is.null,thumbnail_url.like.data:*)",
    limit: "1000",
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

  const assets = (await res.json()) as { id: string; file_path: string; file_type: "psd" | "ai" }[];
  console.log(`[Reprocess] Found ${assets.length} assets to process`);

  let success = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      // Convert UNC path back to local mount path
      const localPath = asset.file_path.replace(/\\\\/g, "/").replace("//edgesynology2/mac", "/mnt/nas/mac");

      const thumb = await generateThumbnail(localPath, asset.file_type, asset.id);
      const thumbnailUrl = await uploadThumbnail(thumb.thumbnailPath, asset.id);

      await updateAsset(asset.id, {
        thumbnail_url: thumbnailUrl,
        width: thumb.width,
        height: thumb.height,
      });

      success++;
      if (success % 50 === 0) {
        console.log(`[Reprocess] Progress: ${success}/${assets.length}`);
      }
    } catch (err: any) {
      failed++;
      console.warn(`[Reprocess] Failed ${asset.id}: ${err.message}`);
    }
  }

  console.log(`[Reprocess] Done. Success: ${success}, Failed: ${failed}`);
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
