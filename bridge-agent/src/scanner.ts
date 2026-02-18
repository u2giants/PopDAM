import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "./config";
import { reportScanProgress } from "./api";

export interface ScannedFile {
  filename: string;
  filePath: string;       // Full path inside container
  uncPath: string;        // Original NAS UNC-style path for storage
  fileType: "psd" | "ai";
  fileSize: number;
  modifiedAt: Date;
  createdAt: Date;        // Filesystem birthtime
  sha256: string;
}

interface KnownFile {
  hash: string;
  path: string;
}

interface ScanState {
  lastScanTime: string;
  knownHashes?: string[];  // Legacy format (auto-migrated)
  knownFiles?: KnownFile[];
}

const STATE_FILE = path.join(config.dataDir, "scan-state.json");
const minDate = new Date(config.scanMinDate);

/** Load persisted scan state, auto-migrating legacy format */
export async function loadState(): Promise<{ lastScanTime: string; knownFiles: KnownFile[] }> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const state: ScanState = JSON.parse(raw);

    // Migrate legacy knownHashes[] → knownFiles[]
    if (state.knownHashes && !state.knownFiles) {
      console.log(`[Scanner] Migrating ${state.knownHashes.length} legacy hashes to knownFiles format`);
      return {
        lastScanTime: state.lastScanTime,
        knownFiles: state.knownHashes.map((hash) => ({ hash, path: "" })),
      };
    }

    return {
      lastScanTime: state.lastScanTime,
      knownFiles: state.knownFiles || [],
    };
  } catch {
    return { lastScanTime: minDate.toISOString(), knownFiles: [] };
  }
}

/** Save scan state — called AFTER successful ingestion, not during scan */
export async function saveState(state: { lastScanTime: string; knownFiles: KnownFile[] }): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Compute SHA-256 of a file (first 64KB + last 64KB + file size).
 * Reading head+tail is still very fast on large files but far more
 * collision-resistant than head-only.
 */
async function quickHash(filePath: string): Promise<string> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const hash = crypto.createHash("sha256");

    // Read first 64KB
    const headBuf = Buffer.alloc(65536);
    const { bytesRead: headRead } = await handle.read(headBuf, 0, 65536, 0);
    hash.update(headBuf.subarray(0, headRead));

    // Read last 64KB (if file is large enough that tail differs from head)
    if (stat.size > 65536) {
      const tailOffset = Math.max(0, stat.size - 65536);
      const tailBuf = Buffer.alloc(65536);
      const { bytesRead: tailRead } = await handle.read(tailBuf, 0, 65536, tailOffset);
      hash.update(tailBuf.subarray(0, tailRead));
    }

    // Include file size for additional collision avoidance
    hash.update(stat.size.toString());
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

/**
 * Convert a container path to a UNC-style NAS path.
 * Uses config.nasMountRoot / nasHost / nasShare to ensure correctness.
 *
 * Example: /mnt/nas/mac/Decor/Foo/bar.psd → \\edgesynology2\mac\Decor\Foo\bar.psd
 */
function toUncPath(containerPath: string): string {
  const relative = path.relative(config.nasMountRoot, containerPath);

  // Safety: if relative escapes the mount root, something is misconfigured
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `[Scanner] File "${containerPath}" is outside NAS_MOUNT_ROOT "${config.nasMountRoot}". ` +
      `Check your SCAN_ROOTS and NAS_MOUNT_ROOT configuration.`
    );
  }

  return `\\\\${config.nasHost}\\${config.nasShare}\\${relative.replace(/\//g, "\\")}`;
}

/**
 * Validate that every scan root exists and is a directory.
 * Throws a fatal error if any root is invalid — this prevents the silent
 * "scan ran but found nothing" problem caused by misconfigured mounts.
 */
export async function validateScanRoots(): Promise<void> {
  for (const root of config.scanRoots) {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) {
        throw new Error(
          `SCAN_ROOTS path "${root}" exists but is NOT a directory. ` +
          `Check your docker-compose volume mounts.`
        );
      }
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(
          `\n` +
          `═══════════════════════════════════════════════════════════════\n` +
          `  FATAL: SCAN_ROOTS path does not exist inside the container\n` +
          `\n` +
          `  Path:  ${root}\n` +
          `\n` +
          `  This usually means your docker-compose.yml volume mount\n` +
          `  does not match your SCAN_ROOTS (or NAS_MOUNT_ROOT) setting.\n` +
          `\n` +
          `  Current NAS_MOUNT_ROOT: ${config.nasMountRoot}\n` +
          `  Current SCAN_ROOTS:     ${config.scanRoots.join(", ")}\n` +
          `\n` +
          `  In docker-compose.yml, check the volume line:\n` +
          `    - /volume1/<share>:${config.nasMountRoot}:ro\n` +
          `═══════════════════════════════════════════════════════════════\n`
        );
      }
      if (err.code === "EACCES") {
        throw new Error(
          `SCAN_ROOTS path "${root}" exists but the agent has no permission to read it. ` +
          `Check NAS folder permissions for the Docker user.`
        );
      }
      throw err;
    }
  }
  console.log(`[Scanner] ✓ All scan roots validated: ${config.scanRoots.join(", ")}`);
}

/** Recursively walk directories and yield matching files */
async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err: any) {
    // Permission denied or broken symlink — skip silently for subdirectories
    // (top-level roots are validated separately by validateScanRoots)
    if (err.code === "EACCES" || err.code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().replace(".", "");
      if (config.scanExtensions.includes(ext)) {
        yield full;
      }
    }
  }
}

export interface ScanResult {
  newFiles: ScannedFile[];
  /** The updated hash→path map (including moved files). Caller persists AFTER ingestion. */
  updatedKnownFiles: KnownFile[];
  scanStartTime: string;
  scannedCount: number;
  movedCount: number;
}

/**
 * Run an incremental scan across all configured roots.
 * IMPORTANT: This function does NOT save state. The caller must call
 * saveState() AFTER successful ingestion to persist the known hashes.
 */
export async function scan(): Promise<ScanResult> {
  // Validate roots before scanning (fail loudly if misconfigured)
  await validateScanRoots();

  const state = await loadState();

  // Build hash→path map for movement detection
  const hashToPath = new Map<string, string>();
  for (const kf of state.knownFiles) {
    hashToPath.set(kf.hash, kf.path);
  }

  // Build a set of known UNC paths for fast skip-if-unchanged
  const knownPathSet = new Set<string>();
  for (const kf of state.knownFiles) {
    if (kf.path) knownPathSet.add(kf.path);
  }

  const sinceDate = new Date(state.lastScanTime);
  const newFiles: ScannedFile[] = [];
  let scannedCount = 0;
  let skippedUnchanged = 0;
  let movedCount = 0;
  const scanStart = new Date();

  console.log(`[Scanner] Starting incremental scan since ${sinceDate.toISOString()}`);
  console.log(`[Scanner] Roots: ${config.scanRoots.join(", ")}`);
  console.log(`[Scanner] NAS: \\\\${config.nasHost}\\${config.nasShare} → ${config.nasMountRoot}`);
  console.log(`[Scanner] Known files: ${hashToPath.size}`);

  for (const root of config.scanRoots) {
    for await (const filePath of walkDir(root)) {
      scannedCount++;
      if (scannedCount % 5000 === 0) {
        console.log(`[Scanner] Scanned ${scannedCount} files (${skippedUnchanged} skipped unchanged)...`);
        try {
          await reportScanProgress("scanning", scannedCount, newFiles.length);
        } catch { /* don't fail scan for progress reports */ }
      }

      try {
        const stat = await fs.stat(filePath);

        // Skip files older than minimum date
        if (stat.mtime < minDate) continue;

        // Optimization: if file hasn't changed since last scan AND we already
        // know its UNC path, skip the expensive hash computation
        const uncPath = toUncPath(filePath);
        if (stat.mtime < sinceDate && knownPathSet.has(uncPath)) {
          skippedUnchanged++;
          continue;
        }

        // Compute quick hash for dedup
        const hash = await quickHash(filePath);

        if (hashToPath.has(hash)) {
          const knownPath = hashToPath.get(hash)!;
          if (knownPath && knownPath !== uncPath) {
            try {
              console.log(`[Scanner] File moved: ${path.basename(knownPath)} → new folder`);
              const { moveAsset } = await import("./api");
              await moveAsset(knownPath, uncPath);
              hashToPath.set(hash, uncPath);
              movedCount++;
            } catch (moveErr: any) {
              console.warn(`[Scanner] Move detection failed: ${moveErr.message}`);
            }
          }
          continue;
        }

        const ext = path.extname(filePath).toLowerCase().replace(".", "") as "psd" | "ai";

        newFiles.push({
          filename: path.basename(filePath),
          filePath,
          uncPath,
          fileType: ext,
          fileSize: stat.size,
          modifiedAt: stat.mtime,
          createdAt: stat.birthtime,
          sha256: hash,
        });

        // Add to map but DO NOT persist yet — caller does that after ingestion
        hashToPath.set(hash, uncPath);
      } catch (err: any) {
        console.warn(`[Scanner] Error processing ${filePath}: ${err.message}`);
      }
    }
  }

  // Report final scan progress (but do NOT save state here!)
  try {
    await reportScanProgress("idle", scannedCount, newFiles.length);
  } catch { /* ignore */ }

  // Build the updated known files list for the caller to persist
  const updatedKnownFiles: KnownFile[] = [];
  for (const [hash, p] of hashToPath) {
    updatedKnownFiles.push({ hash, path: p });
  }

  console.log(`[Scanner] Complete. Scanned ${scannedCount} files, found ${newFiles.length} new, ${movedCount} moved, ${skippedUnchanged} skipped (unchanged).`);
  return { newFiles, updatedKnownFiles, scanStartTime: scanStart.toISOString(), scannedCount, movedCount };
}
