import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "./config";

interface NormalizeResult {
  filePath: string;
  originalSize: number;
  newSize: number;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

interface NormalizeReport {
  startedAt: string;
  completedAt: string;
  roots: string[];
  dryRun: boolean;
  totalScanned: number;
  alreadyCompressed: number;
  normalized: number;
  failed: number;
  totalOriginalBytes: number;
  totalNewBytes: number;
  totalSavedBytes: number;
  files: NormalizeResult[];
}

interface NormalizerOptions {
  roots: string[];
  dryRun: boolean;
}

/** Recursively yield all .tif/.tiff file paths under a directory */
async function* walkTiffs(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err: any) {
    console.warn(`[TiffNorm] Cannot read directory ${dir}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTiffs(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".tif" || ext === ".tiff") {
        yield fullPath;
      }
    }
  }
}

/** Check if a TIFF is already using ZIP/deflate compression */
async function isAlreadyZipCompressed(filePath: string): Promise<{ compressed: boolean; compression?: string }> {
  const meta = await sharp(filePath).metadata();
  const compression = (meta as any).compression;

  // sharp reports TIFF compression as a string; deflate/zip variants
  if (
    compression === "deflate" ||
    compression === "zip" ||
    compression === "adobe-deflate" ||
    compression === 8 // numeric TIFF tag for deflate
  ) {
    return { compressed: true, compression: String(compression) };
  }
  return { compressed: false, compression: compression ? String(compression) : "none/unknown" };
}

/** Normalize a single TIFF file to ZIP compression */
async function normalizeTiff(filePath: string, dryRun: boolean): Promise<NormalizeResult> {
  const stat = await fs.stat(filePath);
  const originalSize = stat.size;
  const originalMtime = stat.mtime;
  const originalAtime = stat.atime;

  // Check current compression
  const { compressed, compression } = await isAlreadyZipCompressed(filePath);
  if (compressed) {
    return {
      filePath,
      originalSize,
      newSize: originalSize,
      skipped: true,
      skipReason: `already ${compression}`,
    };
  }

  if (dryRun) {
    return {
      filePath,
      originalSize,
      newSize: 0, // unknown in dry run
      skipped: false,
      skipReason: `dry-run (current: ${compression})`,
    };
  }

  // Write to temp file alongside the original
  const tempPath = filePath + ".tmp_deflate";

  try {
    // Rewrite with ZIP/deflate compression
    await sharp(filePath)
      .tiff({ compression: "deflate" })
      .toFile(tempPath);

    // Get new size
    const newStat = await fs.stat(tempPath);
    const newSize = newStat.size;

    // Replace original with temp file
    await fs.rename(tempPath, filePath);

    // Restore original timestamps
    await fs.utimes(filePath, originalAtime, originalMtime);

    return { filePath, originalSize, newSize, skipped: false };
  } catch (err: any) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // ignore
    }
    return { filePath, originalSize, newSize: originalSize, skipped: false, error: err.message };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Main normalizer orchestrator */
export async function runNormalizer(options: NormalizerOptions): Promise<void> {
  const { roots, dryRun } = options;

  console.log("=======================================");
  console.log(" TIFF Normalizer");
  console.log(`  Mode:    ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`  Roots:   ${roots.join(", ")}`);
  console.log("=======================================\n");

  const report: NormalizeReport = {
    startedAt: new Date().toISOString(),
    completedAt: "",
    roots,
    dryRun,
    totalScanned: 0,
    alreadyCompressed: 0,
    normalized: 0,
    failed: 0,
    totalOriginalBytes: 0,
    totalNewBytes: 0,
    totalSavedBytes: 0,
    files: [],
  };

  for (const root of roots) {
    console.log(`[TiffNorm] Scanning: ${root}`);

    for await (const filePath of walkTiffs(root)) {
      report.totalScanned++;

      if (report.totalScanned % 100 === 0) {
        console.log(`[TiffNorm] Progress: ${report.totalScanned} files scanned, ${report.normalized} normalized, ${report.alreadyCompressed} skipped...`);
      }

      try {
        const result = await normalizeTiff(filePath, dryRun);
        report.files.push(result);

        if (result.error) {
          report.failed++;
          console.warn(`[TiffNorm] ✗ FAILED: ${path.basename(filePath)}: ${result.error}`);
        } else if (result.skipped) {
          report.alreadyCompressed++;
        } else {
          report.normalized++;
          report.totalOriginalBytes += result.originalSize;
          report.totalNewBytes += result.newSize;

          if (!dryRun) {
            const saved = result.originalSize - result.newSize;
            console.log(
              `[TiffNorm] ✓ ${path.basename(filePath)}: ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (saved ${formatBytes(saved)})`
            );
          } else {
            console.log(
              `[TiffNorm] ~ ${path.basename(filePath)}: ${formatBytes(result.originalSize)} (current: ${result.skipReason})`
            );
          }
        }
      } catch (err: any) {
        report.failed++;
        console.warn(`[TiffNorm] ✗ ERROR: ${path.basename(filePath)}: ${err.message}`);
      }
    }
  }

  report.completedAt = new Date().toISOString();
  report.totalSavedBytes = report.totalOriginalBytes - report.totalNewBytes;

  // Print summary
  console.log("\n=======================================");
  console.log(" TIFF Normalization Report");
  console.log("=======================================");
  console.log(` Files scanned:      ${report.totalScanned.toLocaleString()}`);
  console.log(` Already compressed: ${report.alreadyCompressed.toLocaleString()}  (skipped)`);
  console.log(` Normalized:         ${report.normalized.toLocaleString()}`);
  console.log(` Failed:             ${report.failed.toLocaleString()}`);
  if (!dryRun) {
    console.log(` Total saved:        ${formatBytes(report.totalSavedBytes)}`);
  } else {
    console.log(` (Dry run — no files were modified)`);
  }
  console.log("=======================================\n");

  // Save report JSON
  try {
    const dataDir = config.dataDir;
    await fs.mkdir(dataDir, { recursive: true });
    const reportPath = path.join(dataDir, "tiff-normalize-report.json");
    // Strip per-file details for the JSON to keep it manageable — keep just summary + failed files
    const jsonReport = {
      ...report,
      files: report.files.filter((f) => f.error), // only keep failed files in JSON
      allFileCount: report.files.length,
    };
    await fs.writeFile(reportPath, JSON.stringify(jsonReport, null, 2));
    console.log(`[TiffNorm] Report saved to: ${reportPath}`);
  } catch (err: any) {
    console.warn(`[TiffNorm] Could not save report: ${err.message}`);
  }
}
