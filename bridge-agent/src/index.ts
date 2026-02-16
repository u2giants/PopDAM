import { config } from "./config";
import { registerAgent, heartbeat, ingestAsset } from "./api";
import { scan, ScannedFile } from "./scanner";
import { generateThumbnail } from "./thumbnail";

let agentId: string;

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
        width: 0,  // Will be updated after thumbnail extraction
        height: 0,
        artboards: 1,
      });

      // 2. Generate thumbnail
      try {
        const thumb = await generateThumbnail(file.filePath, file.fileType, asset.id);
        console.log(`[Agent] Thumbnail generated: ${thumb.width}x${thumb.height}`);

        // TODO: Upload thumbnail to storage and update asset.thumbnail_url
        // For now, thumbnail is stored locally at thumb.thumbnailPath
      } catch (thumbErr: any) {
        console.warn(`[Agent] Thumbnail failed for ${file.filename}: ${thumbErr.message}`);
      }
    } catch (err: any) {
      console.error(`[Agent] Failed to ingest ${file.filename}: ${err.message}`);
    }
  }
}

/** Main loop */
async function main() {
  console.log("==============================================");
  console.log(" DAM Bridge Agent");
  console.log(`  Agent:  ${config.agentName}`);
  console.log(`  Roots:  ${config.scanRoots.join(", ")}`);
  console.log(`  Since:  ${config.scanMinDate}`);
  console.log(`  Interval: ${config.scanIntervalMinutes}m`);
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
      // Process in batches of 20
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
