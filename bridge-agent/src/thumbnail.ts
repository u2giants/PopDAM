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

export interface ThumbnailError {
  success: false;
  reason: string; // e.g. "no_pdf_compat"
  message: string;
}

export type ThumbnailOutcome =
  | ({ success: true } & ThumbnailResult)
  | ThumbnailError;

/** Ensure thumbnail directory exists */
async function ensureDir() {
  await fs.mkdir(THUMB_DIR, { recursive: true });
}

/**
 * Validate that a generated thumbnail is not the Adobe Illustrator
 * "saved without PDF Content" placeholder image.
 * The placeholder is a mostly-white image with minimal color variation.
 * Returns true if the image appears to be a real preview.
 */
async function isValidThumbnail(imagePath: string): Promise<boolean> {
  try {
    const stats = await sharp(imagePath).stats();
    // Check all channels: if mean is very high (near white) and std dev is very low,
    // it's likely the placeholder image
    const channels = stats.channels;
    const allNearWhite = channels.every(ch => ch.mean > 240);
    const allLowVariance = channels.every(ch => ch.stdev < 30);
    
    if (allNearWhite && allLowVariance) {
      console.log(`[Thumbnail] Rejected placeholder: mean=[${channels.map(c => c.mean.toFixed(1)).join(',')}] stdev=[${channels.map(c => c.stdev.toFixed(1)).join(',')}]`);
      return false;
    }

    // Additional check: if the image is very small in file size (< 5KB), 
    // it's likely just text on white
    const stat = await fs.stat(imagePath);
    if (stat.size < 5000 && allNearWhite) {
      console.log(`[Thumbnail] Rejected tiny placeholder: ${stat.size} bytes`);
      return false;
    }

    return true;
  } catch {
    return true; // If we can't validate, assume it's fine
  }
}

/**
 * Extract thumbnail from a PSD file.
 */
async function thumbnailFromPsd(filePath: string, outputPath: string): Promise<ThumbnailResult> {
  const tempPng = outputPath.replace(/\.jpg$/, ".tmp.png");

  // Attempt 1: sharp
  try {
    const image = sharp(filePath, { pages: 0 });
    const metadata = await image.metadata();
    await image.resize({
      width: config.thumbnailMaxSize,
      height: config.thumbnailMaxSize,
      fit: "inside",
      withoutEnlargement: true,
    }).jpeg({ quality: config.thumbnailQuality }).toFile(outputPath);

    return { thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch { /* fall through */ }

  // Attempt 2: ImageMagick
  try {
    await execFileAsync("convert", [
      `${filePath}[0]`,
      "-resize", `${config.thumbnailMaxSize}x${config.thumbnailMaxSize}>`,
      "-quality", config.thumbnailQuality.toString(),
      outputPath,
    ]);
    const metadata = await sharp(outputPath).metadata();
    return { thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch { /* fall through */ }

  // Attempt 3: Ghostscript
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
    return { thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch (err) {
    throw new Error(`All PSD thumbnail methods failed for ${filePath}: ${err}`);
  }
}

/**
 * Extract thumbnail from an AI file. Returns a ThumbnailOutcome
 * so callers can distinguish between a hard failure (no_pdf_compat)
 * and a successful extraction.
 */
async function thumbnailFromAi(filePath: string, outputPath: string): Promise<ThumbnailOutcome> {
  const tempPng = outputPath.replace(/\.jpg$/, ".tmp.png");

  // Attempt 1: Direct sharp read (PDF-compatible AI)
  try {
    const image = sharp(filePath, { density: 150 });
    const metadata = await image.metadata();
    await image.resize({
      width: config.thumbnailMaxSize, height: config.thumbnailMaxSize,
      fit: "inside", withoutEnlargement: true,
    }).jpeg({ quality: config.thumbnailQuality }).toFile(outputPath);

    if (!(await isValidThumbnail(outputPath))) {
      await fs.unlink(outputPath).catch(() => {});
      return {
        success: false,
        reason: "no_pdf_compat",
        message: `AI file thumbnail is placeholder (no real PDF content): ${filePath}`,
      };
    }

    return { success: true, thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch { /* fall through */ }

  // Attempt 2: Ghostscript
  try {
    await execFileAsync("gs", [
      "-dNOPAUSE", "-dBATCH", "-dSAFER",
      "-sDEVICE=png16m", `-r150`,
      `-dFirstPage=1`, `-dLastPage=1`,
      `-sOutputFile=${tempPng}`,
      filePath,
    ]);
    const metadata = await sharp(tempPng).metadata();
    await sharp(tempPng).resize({
      width: config.thumbnailMaxSize, height: config.thumbnailMaxSize,
      fit: "inside", withoutEnlargement: true,
    }).jpeg({ quality: config.thumbnailQuality }).toFile(outputPath);
    await fs.unlink(tempPng).catch(() => {});

    if (!(await isValidThumbnail(outputPath))) {
      await fs.unlink(outputPath).catch(() => {});
      return {
        success: false,
        reason: "no_pdf_compat",
        message: `AI file thumbnail is placeholder (no real PDF content): ${filePath}`,
      };
    }

    return { success: true, thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch { /* fall through */ }

  // Attempt 3: Inkscape
  try {
    await execFileAsync("inkscape", [
      filePath, "--export-type=png",
      `--export-filename=${tempPng}`, "--export-dpi=150",
    ]);
    const metadata = await sharp(tempPng).metadata();
    await sharp(tempPng).resize({
      width: config.thumbnailMaxSize, height: config.thumbnailMaxSize,
      fit: "inside", withoutEnlargement: true,
    }).jpeg({ quality: config.thumbnailQuality }).toFile(outputPath);
    await fs.unlink(tempPng).catch(() => {});

    if (!(await isValidThumbnail(outputPath))) {
      await fs.unlink(outputPath).catch(() => {});
      return {
        success: false,
        reason: "no_pdf_compat",
        message: `AI file thumbnail is placeholder (no real PDF content): ${filePath}`,
      };
    }

    return { success: true, thumbnailPath: outputPath, width: metadata.width || 0, height: metadata.height || 0 };
  } catch (err) {
    // All methods failed — this AI file likely has no PDF compatibility
    return {
      success: false,
      reason: "no_pdf_compat",
      message: `AI file requires Adobe Illustrator for rendering (no PDF compatibility): ${err}`,
    };
  }
}

/**
 * Generate a thumbnail for a file.
 * For PSD: throws on failure (all PSD methods are reliable).
 * For AI: returns a ThumbnailOutcome so callers can handle no_pdf_compat gracefully.
 */
export async function generateThumbnail(
  filePath: string,
  fileType: "psd" | "ai",
  assetId: string
): Promise<ThumbnailOutcome> {
  await ensureDir();
  const outputPath = path.join(THUMB_DIR, `${assetId}.jpg`);

  if (fileType === "psd") {
    const result = await thumbnailFromPsd(filePath, outputPath);
    return { success: true, ...result };
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
