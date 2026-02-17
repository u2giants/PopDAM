# DAM Windows Render Agent

Runs on a Windows PC with Adobe Illustrator installed. Picks up `.ai` files that the Linux bridge agent couldn't thumbnail (no PDF compatibility) and uses Illustrator's ExtendScript automation to export JPEG previews.

## Prerequisites

- **Windows 10/11** with **Adobe Illustrator** (2023 or later recommended)
- **Node.js 18+**
- **Network access** to the Synology NAS (via Tailscale or direct LAN)
- The NAS share (`\\edgesynology2\mac`) must be accessible from this machine

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   copy .env.example .env
   notepad .env
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build and run:
   ```
   npm run build
   npm start
   ```

   Or for development:
   ```
   npm run dev
   ```

## How It Works

1. The agent polls the `render_queue` table every 30 seconds
2. Claims pending jobs (up to 3 at a time)
3. For each job:
   - Opens the `.ai` file using Illustrator's ExtendScript API
   - Exports a JPEG thumbnail (800px max dimension)
   - Uploads to DigitalOcean Spaces
   - Updates the asset record with the new thumbnail URL
4. If Illustrator fails, marks the job as failed with an error message

## Troubleshooting

- **Illustrator path**: If Illustrator is installed in a non-standard location, set `ILLUSTRATOR_PATH` in `.env`
- **NAS access**: Make sure `\\edgesynology2\mac` is accessible from this machine. Try opening it in File Explorer first.
- **Firewall**: Ensure outbound HTTPS is allowed for the API and DO Spaces endpoints
