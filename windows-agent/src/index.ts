import { config } from "./config";
import { registerAgent, heartbeat, claimRenderJobs, completeRender, RenderJob } from "./api";
import { renderWithIllustrator } from "./illustrator";
import { uploadToSpaces } from "./s3";

/** Process a single render job */
async function processJob(job: RenderJob): Promise<void> {
  const { id: jobId, asset } = job;
  const filename = asset.filename;

  console.log(`[Render] Processing: ${filename}`);

  try {
    // The file_path in DB is UNC format: \\edgesynology2\mac\...
    // On Windows with the NAS mapped, this should be directly accessible
    const filePath = asset.file_path;

    // Render with Illustrator
    const { jpegPath, width, height } = await renderWithIllustrator(filePath, asset.id);
    console.log(`[Render] Exported: ${width}x${height}`);

    // Upload to DO Spaces
    const key = `thumbnails/${asset.id}.jpg`;
    const thumbnailUrl = await uploadToSpaces(jpegPath, key);
    console.log(`[Render] Uploaded: ${thumbnailUrl}`);

    // Report success
    await completeRender(jobId, "completed", thumbnailUrl);
    console.log(`[Render] ✓ ${filename}`);
  } catch (err: any) {
    console.error(`[Render] ✗ ${filename}: ${err.message}`);
    await completeRender(jobId, "failed", undefined, err.message);
  }
}

/** Poll for and process render jobs */
async function pollCycle(): Promise<void> {
  try {
    const jobs = await claimRenderJobs(3);
    if (jobs.length === 0) return;

    console.log(`[Render] Claimed ${jobs.length} jobs`);

    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err: any) {
    console.error(`[Render] Poll failed: ${err.message}`);
  }
}

async function main() {
  console.log("==============================================");
  console.log(" DAM Windows Render Agent");
  console.log(`  Agent:    ${config.agentName}`);
  console.log(`  NAS:      ${config.nasUncPrefix}`);
  console.log(`  Poll:     ${config.pollIntervalSeconds}s`);
  console.log(`  Storage:  DO Spaces (${config.spacesBucket}.${config.spacesRegion})`);
  console.log("==============================================");

  // Register
  try {
    await registerAgent();
    console.log("[Render] Registered with API");
  } catch (err: any) {
    console.warn(`[Render] Registration failed (continuing): ${err.message}`);
  }

  // Heartbeat every 5 minutes
  setInterval(async () => {
    try {
      await heartbeat();
    } catch (err: any) {
      console.warn(`[Render] Heartbeat failed: ${err.message}`);
    }
  }, 5 * 60 * 1000);

  // Initial poll
  await pollCycle();

  // Scheduled polls
  setInterval(pollCycle, config.pollIntervalSeconds * 1000);
  console.log(`[Render] Polling every ${config.pollIntervalSeconds} seconds`);
}

main().catch((err) => {
  console.error("[Render] Fatal error:", err);
  process.exit(1);
});
