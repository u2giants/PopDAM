# TIFF Normalizer with Single-Folder Test Mode

## Overview

Add a headless TIFF normalizer to the bridge agent that rewrites TIFFs from uncompressed (or LZW/etc.) to ZIP (deflate) compression -- saving disk space without touching pixel data. It will include a `--normalize-tiffs` CLI mode with an optional `--folder` flag to test on a single directory first. For test mode, find the folders with multiple uncompressed TIFFs to run the test. 

## How to Use

**Test on one folder first:**

```bash
docker-compose run --rm agent node dist/index.js \
  --normalize-tiffs --folder "/mnt/nas/mac/Decor/Character Licensed/____New Structure/In Development"
```

**Run on all scan roots:**

```bash
docker-compose run --rm agent node dist/index.js --normalize-tiffs
```

**Dry run (report only, no changes):**

```bash
docker-compose run --rm agent node dist/index.js \
  --normalize-tiffs --folder "/mnt/nas/mac/some/folder" --dry-run
```

After it completes, restart the main agent: `docker-compose up -d`

## What It Does

1. Recursively walks the target folder(s) for `.tif` / `.tiff` files
2. For each file, reads TIFF compression metadata via `sharp`
3. Skips files already using ZIP/deflate compression
4. Rewrites the TIFF using ZIP compression while preserving:
  - Pixel data (lossless)
  - ICC color profile
  - EXIF/IPTC metadata
5. Restores the original file modification and access timestamps (`mtime`/`atime`) so nothing looks "changed" to other systems
6. Outputs a summary report (printed to console + saved as JSON) showing:
  - Files processed, skipped, failed
  - Per-file before/after sizes
  - Total space saved

## Safety Features

- `**--dry-run` flag**: Scans and reports what it *would* do without writing anything
- `**--folder` flag**: Limits scope to a single directory for testing
- **Read-only volume concern**: The current Docker mount is `:ro` -- we will need to either remove the `:ro` flag or add a separate read-write mount for the folders being normalized. The plan will document this clearly.
- Writes to a temp file first, then replaces the original only on success
- If anything fails mid-file, the original is left untouched

---

## Technical Details

### New File: `bridge-agent/src/tiff-normalizer.ts`

Core module with these functions:

- `getTiffCompression(filePath)` -- uses `sharp` metadata to read current compression type
- `isAlreadyZipCompressed(filePath)` -- returns true if compression is already deflate/zip
- `normalizeTiff(filePath, dryRun)` -- rewrites a single TIFF:
  1. Read metadata via `sharp(filePath).metadata()`
  2. Skip if already zip-compressed
  3. Save original `mtime`/`atime` via `fs.stat()`
  4. Write to a temp file using `sharp(filePath).tiff({ compression: 'deflate' }).toFile(tempPath)`
  5. Replace original: `fs.rename(tempPath, filePath)`
  6. Restore timestamps: `fs.utimes(filePath, atime, mtime)`
  7. Return `{ originalSize, newSize, skipped, error }`
- `walkTiffs(dir)` -- async generator yielding `.tif`/`.tiff` file paths
- `runNormalizer(options)` -- main orchestrator that walks, processes, and builds the report

### Changes to `bridge-agent/src/index.ts`

Add a new CLI mode block in `main()`:

```
if (process.argv.includes("--normalize-tiffs")) {
  const folderIdx = process.argv.indexOf("--folder");
  const folder = folderIdx !== -1 ? process.argv[folderIdx + 1] : null;
  const dryRun = process.argv.includes("--dry-run");
  const roots = folder ? [folder] : config.scanRoots;
  await runNormalizer({ roots, dryRun });
  process.exit(0);
}
```

### Changes to `bridge-agent/docker-compose.yml`

Add a note/comment that for TIFF normalization, the volume mount must be read-write:

```yaml
# For --normalize-tiffs, change :ro to :rw
- /volume1/mac:/mnt/nas/mac:ro
```

### Report Output

The report is saved to `data/tiff-normalize-report.json` and printed to console:

```
=======================================
 TIFF Normalization Report
=======================================
 Files scanned:    1,234
 Already compressed: 800  (skipped)
 Normalized:       420
 Failed:           14
 Total saved:      12.3 GB
=======================================
```

### Dependencies

No new dependencies needed -- `sharp` (already installed) supports TIFF read/write with deflate compression natively.