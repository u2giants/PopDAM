import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { config } from "./config";

const execFileAsync = promisify(execFile);

const THUMB_DIR = path.join(config.dataDir, "thumbnails");

export interface ThumbnailResult {
  thumbnailPath: string;
  width: number;
  height: number;
}

/** Ensure thumbnail directory exists */
async function ensureDir() {
  await fs.mkdir(THUMB_DIR, { recursive: true });
}

/**
 * Extract thumbnail from a PSD file.
 * PSD files contain an embedded composite image — we use sharp which
 * can read PSD format directly for the flattened composite.
 */
async function thumbnailFromPsd(filePath: string, outputPath: string): Promise<ThumbnailResult> {
  const tempPng = outputPath.replace(/\.jpg$/, ".tmp.png");

  // Attempt 1: sharp (works for standard PSD with flattened composite)
  try {
    const image = sharp(filePath, { pages: 0 });
    const metadata = await image.metadata();

    await image.resize({
      width: config.thumbnailMaxSize,
      height: config.thumbnailMaxSize,
      fit: "inside",
      withoutEnlargement: true,
    }).jpeg({ quality: config.thumbnailQuality }).toFile(outputPath);

    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    // sharp can't read this PSD, fall through
  }

  // Attempt 2: ImageMagick convert (handles PSB, complex PSDs)
  try {
    // [0] selects the flattened composite / first layer
    await execFileAsync("convert", [
      `${filePath}[0]`,
      "-resize", `${config.thumbnailMaxSize}x${config.thumbnailMaxSize}>`,
      "-quality", config.thumbnailQuality.toString(),
      outputPath,
    ]);

    const metadata = await sharp(outputPath).metadata();
    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    // ImageMagick failed, try Ghostscript
  }

  // Attempt 3: Ghostscript (PSD as PostScript-ish)
  try {
    await execFileAsync("gs", [
      "-dNOPAUSE", "-dBATCH", "-dSAFER",
      "-sDEVICE=png16m", "-r150",
      "-dFirstPage=1", "-dLastPage=1",
      `-sOutputFile=${tempPng}`,
      filePath,
    ]);

    const metadata = await sharp(tempPng).metadata();
    await sharp(tempPng)
      .resize({ width: config.thumbnailMaxSize, height: config.thumbnailMaxSize, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: config.thumbnailQuality })
      .toFile(outputPath);

    await fs.unlink(tempPng).catch(() => {});
    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (err) {
    throw new Error(`All PSD thumbnail methods failed for ${filePath}: ${err}`);
  }
}

/**
 * Extract thumbnail from an AI file.
 * Strategy:
 *   1. Try sharp directly (works if AI file has PDF compatibility enabled)
 *   2. Fall back to Ghostscript (renders the PDF/PostScript content)
 *   3. Fall back to Inkscape (handles pure SVG-based AI files)
 */
async function thumbnailFromAi(filePath: string, outputPath: string): Promise<ThumbnailResult> {
  const tempPng = outputPath.replace(/\.jpg$/, ".tmp.png");

  // Attempt 1: Direct sharp read (PDF-compatible AI)
  try {
    const image = sharp(filePath, { density: 150 });
    const metadata = await image.metadata();
    await image
      .resize({
        width: config.thumbnailMaxSize,
        height: config.thumbnailMaxSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.thumbnailQuality })
      .toFile(outputPath);

    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    // PDF compat likely disabled, fall through
  }

  // Attempt 2: Ghostscript
  try {
    await execFileAsync("gs", [
      "-dNOPAUSE",
      "-dBATCH",
      "-dSAFER",
      "-sDEVICE=png16m",
      `-r150`,
      `-dFirstPage=1`,
      `-dLastPage=1`,
      `-sOutputFile=${tempPng}`,
      filePath,
    ]);

    const metadata = await sharp(tempPng).metadata();
    await sharp(tempPng)
      .resize({
        width: config.thumbnailMaxSize,
        height: config.thumbnailMaxSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.thumbnailQuality })
      .toFile(outputPath);

    await fs.unlink(tempPng).catch(() => {});
    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    // Ghostscript failed, try Inkscape
  }

  // Attempt 3: Inkscape
  try {
    await execFileAsync("inkscape", [
      filePath,
      "--export-type=png",
      `--export-filename=${tempPng}`,
      "--export-dpi=150",
    ]);

    const metadata = await sharp(tempPng).metadata();
    await sharp(tempPng)
      .resize({
        width: config.thumbnailMaxSize,
        height: config.thumbnailMaxSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.thumbnailQuality })
      .toFile(outputPath);

    await fs.unlink(tempPng).catch(() => {});
    return {
      thumbnailPath: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (err) {
    throw new Error(`All thumbnail extraction methods failed for ${filePath}: ${err}`);
  }
}

/**
 * Generate a thumbnail for a file. Returns metadata + local path to the JPEG.
 */
export async function generateThumbnail(
  filePath: string,
  fileType: "psd" | "ai",
  assetId: string
): Promise<ThumbnailResult> {
  await ensureDir();
  const outputPath = path.join(THUMB_DIR, `${assetId}.jpg`);

  if (fileType === "psd") {
    return thumbnailFromPsd(filePath, outputPath);
  } else {
    return thumbnailFromAi(filePath, outputPath);
  }
}

/**
 * Read thumbnail as base64 (for uploading via API)
 */
export async function readThumbnailBase64(thumbPath: string): Promise<string> {
  const buf = await fs.readFile(thumbPath);
  return buf.toString("base64");
}
