# DAM Bridge Agent — edgesynology2

This agent runs on your Synology NAS inside Docker. It scans shared folders for PSD/AI files, extracts thumbnails, and ingests them into the DAM via the cloud API.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker on edgesynology2                    │
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
│  │  /volume1/Design (read-only mount)      │ │
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

### 1. SSH into your Synology (or use Container Manager UI)

```bash
ssh admin@edgesynology2
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
- `SUPABASE_URL` — your DAM cloud URL
- `SUPABASE_ANON_KEY` — your DAM anon key
- Adjust `SCAN_ROOTS` if your design files are in a different shared folder

### 4. Adjust the volume mount (if needed)

In `docker-compose.yml`, update the volume mount to match your Synology shared folder:

```yaml
volumes:
  - /volume1/Design:/mnt/nas/Design:ro
```

If you have multiple shared folders with design files:
```yaml
volumes:
  - /volume1/Design:/mnt/nas/Design:ro
  - /volume1/Archive:/mnt/nas/Archive:ro
```

And update `SCAN_ROOTS` in `.env`:
```
SCAN_ROOTS=/mnt/nas/Design,/mnt/nas/Archive
```

### 5. Build and start

```bash
docker-compose up -d --build
```

### 6. Check logs

```bash
docker-compose logs -f agent
```

You should see:
```
==============================================
 DAM Bridge Agent
  Agent:  edgesynology2
  Roots:  /mnt/nas/Design
  Since:  2020-01-01
  Interval: 10m
==============================================
[API] Registered as agent abc123-...
[Scanner] Starting incremental scan since 2020-01-01T00:00:00.000Z
[Scanner] Roots: /mnt/nas/Design
[Scanner] Scanned 10000 files...
[Scanner] Complete. Scanned 145230 files, found 3421 new.
[Agent] Processing batch of 20 files
[Agent] Ingesting: SpiderMan_WallArt_v3.psd
[Agent] Thumbnail generated: 4000x3000
```

## Updating

When the agent code is updated in the repository:

```bash
cd /volume1/docker/dam-agent
git pull
cd bridge-agent
docker-compose up -d --build
```

## Troubleshooting

### "Permission denied" on scan
Make sure the Docker user has read access to the shared folder. The mount is read-only (`:ro`) by default.

### Tailscale not connecting
Check the Tailscale container logs: `docker-compose logs tailscale`
Ensure your auth key is still valid (they expire after the period you set).

### Thumbnail generation failing for AI files
AI files without PDF compatibility require Ghostscript or Inkscape. Both are included in the Docker image. Check logs for specific error messages.

### High memory usage during scan
The scanner is streaming (async generator), so it shouldn't use much memory even for millions of files. If you see high memory, check if thumbnail generation is the cause — large PSD files can use significant memory during resize.
