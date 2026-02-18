# DAM Bridge Agent — edgesynology2

This agent runs on your Synology NAS inside Docker. It scans shared folders for PSD/AI files, extracts thumbnails, and ingests them into the DAM via the cloud API.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker on Synology NAS                     │
│                                             │
│  ┌─────────────┐   ┌─────────────────────┐  │
│  │  Tailscale   │   │   Bridge Agent      │  │
│  │  (sidecar)   │◄──│   (Node.js)         │  │
│  │              │   │                     │  │
│  │  VPN mesh    │   │  • File scanner     │  │
│  └─────────────┘   │  • Thumbnail gen    │  │
│                     │  • API client       │  │
│                     └────────┬────────────┘  │
│                              │               │
│  ┌───────────────────────────▼─────────────┐ │
│  │  /volume1/<share> (read-only mount)     │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                       │
                       ▼ HTTPS
              ┌────────────────┐
              │  DAM Cloud API │
              │  (Edge Funcs)  │
              └────────────────┘
```

## Quick Start

### 1. SSH into your Synology

```bash
ssh admin@your-nas-hostname
```

### 2. Clone this repo

```bash
cd /volume1/docker
git clone <your-repo-url> dam-agent
cd dam-agent/bridge-agent
```

### 3. Create your `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in:
- `TAILSCALE_AUTH_KEY` — your Tailscale auth key
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — your DAM cloud credentials
- `NAS_HOST` — the NAS hostname used in UNC paths (e.g. `edgesynology2`)
- `NAS_SHARE` — the share name (e.g. `mac`)
- Optionally set `SCAN_ROOTS` to limit scanning to specific subfolders

### 4. Ensure the docker-compose volume mount matches your config

**This is the most important step.** Your volume mount in `docker-compose.yml` must match your `NAS_MOUNT_ROOT` (which defaults to `/mnt/nas/<NAS_SHARE>`).

The default mount is:
```yaml
volumes:
  - /volume1/mac:/mnt/nas/mac:ro
```

This means:
- `NAS_SHARE=mac` → `NAS_MOUNT_ROOT=/mnt/nas/mac`
- `SCAN_ROOTS` must point to paths under `/mnt/nas/mac`

**If your share is named differently** (e.g. `Design`), update both:

1. `docker-compose.yml`:
   ```yaml
   volumes:
     - /volume1/Design:/mnt/nas/Design:ro
   ```

2. `.env`:
   ```
   NAS_SHARE=Design
   # SCAN_ROOTS will default to /mnt/nas/Design
   ```

**Multiple shares:**
```yaml
volumes:
  - /volume1/Design:/mnt/nas/Design:ro
  - /volume1/Archive:/mnt/nas/Archive:ro
```
```
NAS_MOUNT_ROOT=/mnt/nas/Design
SCAN_ROOTS=/mnt/nas/Design,/mnt/nas/Archive
```

### 5. Build and start

```bash
sudo docker compose build --no-cache agent
sudo docker compose up -d
```

### 6. Check logs

```bash
sudo docker compose logs -f agent
```

You should see:
```
==============================================
 DAM Bridge Agent
  Agent:    edgesynology2
  NAS:      \\edgesynology2\mac → /mnt/nas/mac
  Roots:    /mnt/nas/mac
  Since:    2020-01-01
  Interval: 10m
  Storage:  DO Spaces (popdam.nyc3)
==============================================
[Scanner] ✓ All scan roots validated: /mnt/nas/mac
[Scanner] Starting incremental scan since 2020-01-01T00:00:00.000Z
```

### What if SCAN_ROOTS is wrong?

If your SCAN_ROOTS doesn't match the volume mount, you'll see a **clear fatal error**:

```
═══════════════════════════════════════════════════════════════
  FATAL: SCAN_ROOTS path does not exist inside the container

  Path:  /mnt/nas/Design

  This usually means your docker-compose.yml volume mount
  does not match your SCAN_ROOTS (or NAS_MOUNT_ROOT) setting.

  Current NAS_MOUNT_ROOT: /mnt/nas/mac
  Current SCAN_ROOTS:     /mnt/nas/Design
═══════════════════════════════════════════════════════════════
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `AGENT_NAME` | `edgesynology2` | Identity name for this agent (shown in UI) |
| `AGENT_KEY` | `bridge-agent-edgesynology2` | Authentication key for API calls |
| `NAS_HOST` | value of `AGENT_NAME` | NAS hostname used in UNC paths (\\NAS_HOST\...) |
| `NAS_SHARE` | `mac` | NAS share name |
| `NAS_MOUNT_ROOT` | `/mnt/nas/<NAS_SHARE>` | Container path where the share is mounted |
| `SCAN_ROOTS` | value of `NAS_MOUNT_ROOT` | Comma-separated directories to scan |
| `SCAN_MIN_DATE` | `2020-01-01` | Skip files modified before this date |
| `SCAN_EXTENSIONS` | `psd,ai` | File extensions to process |
| `SCAN_INTERVAL_MINUTES` | `10` | Minutes between automatic scans |

## Updating

```bash
cd /volume1/docker/dam-agent
git pull
cd bridge-agent
sudo docker compose build --no-cache agent
sudo docker compose up -d
```

## Troubleshooting

### "FATAL: SCAN_ROOTS path does not exist"
Your docker-compose volume mount doesn't match SCAN_ROOTS. Check the volume line in `docker-compose.yml` and ensure the container path matches what SCAN_ROOTS expects.

### "Permission denied" on scan
Make sure the Docker user has read access to the shared folder. The mount is read-only (`:ro`) by default.

### Tailscale not connecting
Check: `sudo docker compose logs tailscale`. Ensure your auth key is still valid.

### Thumbnail generation failing for AI files
AI files without PDF compatibility require Ghostscript or Inkscape. Both are included in the Docker image.

### High memory usage during scan
The scanner is streaming (async generator), so it shouldn't use much memory. If you see high memory, thumbnail generation on large PSD files may be the cause.

### Container won't stop (Ctrl+C doesn't work)
Open a second terminal and run: `sudo docker compose kill agent`
