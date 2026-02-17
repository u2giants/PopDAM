

# Plan: Windows Render Agent + File Movement Tracking

## Overview

Two enhancements to the PopDAM bridge agent system:
1. Flag AI files that failed thumbnail generation and route them to a Windows machine with Illustrator for rendering
2. Detect when files move between workflow folders and update the database instead of creating duplicates

---

## Part 1: Thumbnail Error Flagging + Windows Render Agent

### Problem
Some `.ai` files are saved without "PDF compatibility" enabled. The Linux bridge agent tries sharp, Ghostscript, and Inkscape but all fail. These files need Adobe Illustrator itself to render a preview.

### Solution

#### A. Database Changes
- Add `thumbnail_error` column (nullable text) to `assets` table -- stores error reason like `no_pdf_compat`
- Create `render_queue` table for the Windows agent to poll:
  - `id` (uuid, primary key)
  - `asset_id` (uuid, references assets)
  - `status` (text: pending / claimed / completed / failed)
  - `claimed_by` (text, nullable -- Windows agent identifier)
  - `claimed_at`, `completed_at` (timestamps)
  - `error_message` (text, nullable)
  - `created_at` (timestamp)

#### B. Bridge Agent Changes
- Update `thumbnail.ts`: When all AI thumbnail methods fail, instead of throwing a generic error, return a structured failure with reason `no_pdf_compat`
- Update `index.ts`: When thumbnail fails for `.ai` files, call `updateAsset` with `thumbnail_error: 'no_pdf_compat'` and insert a row into `render_queue` via a new API action

#### C. Agent API Changes
- Add `queue-render` action: inserts a render job (called by bridge agent on failure)
- Add `claim-render` action: Windows agent polls for pending render jobs, atomically claims a batch
- Add `complete-render` action: Windows agent reports success (with thumbnail URL) or failure

#### D. Windows Render Agent (separate application)
This is a standalone Node.js app that runs on a Windows PC with Adobe Illustrator installed. It:
1. Connects to Tailscale (same network as Synology and the backend)
2. Polls the `render_queue` via the agent API every 30 seconds
3. For each claimed job, reads the `.ai` file from the NAS via UNC path (e.g., `\\edgesynology2\mac\...`)
4. Uses Illustrator's ExtendScript/COM automation to open the file, export a JPEG
5. Uploads the JPEG to DigitalOcean Spaces
6. Calls `complete-render` to update the asset with the new thumbnail URL

The Windows agent code will live in a new `windows-agent/` directory in the repo.

#### E. Backfill Script
A one-time `--queue-failed-thumbs` CLI flag on the bridge agent that queries all assets where `thumbnail_url IS NULL AND file_type = 'ai'` and populates the render queue.

---

## Part 2: File Movement Tracking

### Problem
Currently, when a file is copied to a new folder (same hash), the scanner skips it because it already "knows" that hash. The old database path becomes stale. If the file is then edited, it gets a new hash and is ingested as a brand-new duplicate.

### Solution

#### A. Database Changes
- Add `workflow_status` column (nullable text) to `assets` -- derived from folder name (e.g., `in_process`, `customer_adopted`, `licensor_approved`)
- Create `asset_path_history` table to log movements:
  - `id` (uuid, primary key)
  - `asset_id` (uuid, references assets)
  - `old_path` (text)
  - `new_path` (text)
  - `detected_at` (timestamp)

#### B. Scanner Changes
This is the key logic change. Currently line 120 in scanner.ts does:
```
if (knownSet.has(hash)) continue;  // skip known files entirely
```

The new logic will be:
1. Keep a mapping of `hash -> file_path` (not just a set of hashes)
2. When a known hash is found at a different path, call a new `move-asset` API action instead of skipping
3. When a known hash is found at the same path, skip as before (no change)

The scanner state file changes from `knownHashes: string[]` to `knownFiles: { hash: string, path: string }[]`

#### C. Agent API Changes
- Add `move-asset` action: accepts `file_path` (old) and `new_file_path`, finds the asset by old path, updates `file_path`, derives `workflow_status` from folder name, and logs the movement in `asset_path_history`
- Workflow status derivation: configurable folder-name-to-status mapping (e.g., folder containing "in process" maps to `in_process`)

#### D. UI Changes
- Show `workflow_status` as a filterable badge on asset cards
- Show path history in the asset detail panel

---

## How File Movement Scenarios Play Out After This Change

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| Copy file to new folder (same content) | Scanner skips it; old path goes stale | Scanner detects moved hash, updates path + workflow status |
| Copy then edit within 10 min | New hash = duplicate asset created | Move is detected on next scan; edit creates new hash but scanner now maps hash-to-asset properly |
| Delete from old folder after copy | Old path stays in DB forever | Path was already updated to new location |

---

## Implementation Sequence

1. **Database migrations** -- add columns and tables (quick, no risk)
2. **Scanner movement detection** -- update scanner logic + new API action (core fix)
3. **Thumbnail error flagging** -- update bridge agent to flag failures + new API actions
4. **UI for workflow status** -- badges and filters
5. **Windows Render Agent** -- separate app, requires Windows machine setup
6. **Backfill** -- queue existing failed thumbnails

---

## Technical Details

### New Database Tables/Columns

```sql
-- Assets table additions
ALTER TABLE public.assets ADD COLUMN thumbnail_error text;
ALTER TABLE public.assets ADD COLUMN workflow_status text;

-- Render queue
CREATE TABLE public.render_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  status text NOT NULL DEFAULT 'pending',
  claimed_by text,
  claimed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_render_queue_status ON public.render_queue(status);

-- Path history
CREATE TABLE public.asset_path_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  old_path text NOT NULL,
  new_path text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_path_history_asset ON public.asset_path_history(asset_id);
```

### Scanner State Format Change

From:
```json
{ "lastScanTime": "...", "knownHashes": ["abc123", "def456"] }
```

To:
```json
{ "lastScanTime": "...", "knownFiles": [
  { "hash": "abc123", "path": "/mnt/nas/mac/Decor/..." },
  { "hash": "def456", "path": "/mnt/nas/mac/Decor/..." }
]}
```

### Files Modified
- `supabase/functions/agent-api/index.ts` -- 3 new actions (move-asset, queue-render, claim-render, complete-render)
- `bridge-agent/src/scanner.ts` -- hash-to-path mapping, movement detection
- `bridge-agent/src/thumbnail.ts` -- structured error returns for AI files
- `bridge-agent/src/index.ts` -- handle thumbnail errors, queue renders, new CLI flags
- `bridge-agent/src/api.ts` -- new API helper functions
- `src/components/dam/AssetCard.tsx` -- workflow status badge
- `src/components/dam/AssetDetailPanel.tsx` -- path history display
- `src/components/dam/FilterSidebar.tsx` -- workflow status filter
- New: `windows-agent/` directory with the Windows render agent code

