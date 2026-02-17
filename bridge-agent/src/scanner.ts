import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "./config";

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

interface ScanState {
  lastScanTime: string;
  knownHashes: string[];  // SHA-256 of already-ingested files
}

const STATE_FILE = path.join(config.dataDir, "scan-state.json");
const minDate = new Date(config.scanMinDate);

/** Load persisted scan state */
async function loadState(): Promise<ScanState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastScanTime: minDate.toISOString(), knownHashes: [] };
  }
}

/** Save scan state */
async function saveState(state: ScanState): Promise<void> {
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
  const knownSet = new Set(state.knownHashes);
  const sinceDate = new Date(state.lastScanTime);
  const newFiles: ScannedFile[] = [];
  let scannedCount = 0;
  const scanStart = new Date();

  console.log(`[Scanner] Starting incremental scan since ${sinceDate.toISOString()}`);
  console.log(`[Scanner] Roots: ${config.scanRoots.join(", ")}`);
  console.log(`[Scanner] Known files: ${knownSet.size}`);

  for (const root of config.scanRoots) {
    for await (const filePath of walkDir(root)) {
      scannedCount++;
      if (scannedCount % 10000 === 0) {
        console.log(`[Scanner] Scanned ${scannedCount} files...`);
      }

      try {
        const stat = await fs.stat(filePath);

        // Skip files older than minimum date
        if (stat.mtime < minDate) continue;

        // Skip files not modified since last scan (unless first run)
        if (stat.mtime <= sinceDate && knownSet.size > 0) continue;

        // Compute quick hash for dedup
        const hash = await quickHash(filePath);
        if (knownSet.has(hash)) continue;

        const ext = path.extname(filePath).toLowerCase().replace(".", "") as "psd" | "ai";

        newFiles.push({
          filename: path.basename(filePath),
          filePath,
          uncPath: toUncPath(filePath),
          fileType: ext,
          fileSize: stat.size,
          modifiedAt: stat.mtime,
          createdAt: stat.birthtime,
          sha256: hash,
        });

        knownSet.add(hash);
      } catch {
        // Skip individual file errors
      }
    }
  }

  // Persist updated state
  await saveState({
    lastScanTime: scanStart.toISOString(),
    knownHashes: Array.from(knownSet),
  });

  console.log(`[Scanner] Complete. Scanned ${scannedCount} files, found ${newFiles.length} new.`);
  return newFiles;
}
