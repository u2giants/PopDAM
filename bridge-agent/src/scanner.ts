import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "./config";
import { moveAsset, reportScanProgress } from "./api";

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
async function loadState(): Promise<{ lastScanTime: string; knownFiles: KnownFile[] }> {
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

/** Save scan state */
async function saveState(state: { lastScanTime: string; knownFiles: KnownFile[] }): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Compute SHA-256 of a file (first 64KB for speed on large files) */
async function quickHash(filePath: string): Promise<string> {
  const handle = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(buf, 0, 65536, 0);
    const hash = crypto.createHash("sha256");
    hash.update(buf.subarray(0, bytesRead));
    // Also include file size for collision avoidance
    const stat = await handle.stat();
    hash.update(stat.size.toString());
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

/** Convert container path back to UNC-style NAS path */
function toUncPath(containerPath: string): string {
  // /mnt/nas/mac/Decor/Foo/bar.psd → \\edgesynology2\mac\Decor\Foo\bar.psd
  const relative = containerPath.replace(/^\/mnt\/nas\//, "");
  return `\\\\${config.agentName}\\${relative.replace(/\//g, "\\")}`;
}

/** Recursively walk directories and yield matching files */
async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err: any) {
    // Permission denied or broken symlink — skip silently
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

/** Run an incremental scan across all configured roots */
export async function scan(): Promise<ScannedFile[]> {
  const state = await loadState();

  // Build hash→path map for movement detection
  const hashToPath = new Map<string, string>();
  for (const kf of state.knownFiles) {
    hashToPath.set(kf.hash, kf.path);
  }

  const sinceDate = new Date(state.lastScanTime);
  const newFiles: ScannedFile[] = [];
  let scannedCount = 0;
  let movedCount = 0;
  const scanStart = new Date();

  console.log(`[Scanner] Starting incremental scan since ${sinceDate.toISOString()}`);
  console.log(`[Scanner] Roots: ${config.scanRoots.join(", ")}`);
  console.log(`[Scanner] Known files: ${hashToPath.size}`);

  for (const root of config.scanRoots) {
    for await (const filePath of walkDir(root)) {
      scannedCount++;
      if (scannedCount % 5000 === 0) {
        console.log(`[Scanner] Scanned ${scannedCount} files...`);
        // Report progress every 5000 files
        try {
          await reportScanProgress("scanning", scannedCount, newFiles.length);
        } catch { /* don't fail scan for progress reports */ }
      }

      try {
        const stat = await fs.stat(filePath);

        // Skip files older than minimum date
        if (stat.mtime < minDate) continue;

        // Skip files not modified since last scan (unless first run)
        if (stat.mtime <= sinceDate && hashToPath.size > 0) continue;

        // Compute quick hash for dedup
        const hash = await quickHash(filePath);
        const uncPath = toUncPath(filePath);

        if (hashToPath.has(hash)) {
          const knownPath = hashToPath.get(hash)!;
          // If we have a recorded path and it differs, this file moved
          if (knownPath && knownPath !== uncPath) {
            try {
              console.log(`[Scanner] File moved: ${path.basename(knownPath)} → new folder`);
              await moveAsset(knownPath, uncPath);
              hashToPath.set(hash, uncPath); // Update our local map
              movedCount++;
            } catch (moveErr: any) {
              console.warn(`[Scanner] Move detection failed: ${moveErr.message}`);
            }
          }
          continue; // Already known (same or moved), don't re-ingest
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

        hashToPath.set(hash, uncPath);
      } catch (err: any) {
        console.warn(`[Scanner] Error processing ${filePath}: ${err.message}`);
      }
    }
  }

  // Persist updated state (new format)
  const knownFiles: KnownFile[] = [];
  for (const [hash, p] of hashToPath) {
    knownFiles.push({ hash, path: p });
  }
  await saveState({ lastScanTime: scanStart.toISOString(), knownFiles });

  // Report final progress
  try {
    await reportScanProgress("idle", scannedCount, newFiles.length);
  } catch { /* ignore */ }

  console.log(`[Scanner] Complete. Scanned ${scannedCount} files, found ${newFiles.length} new, ${movedCount} moved.`);
  return newFiles;
