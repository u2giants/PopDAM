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
