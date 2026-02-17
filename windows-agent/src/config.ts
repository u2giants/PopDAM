import path from "path";

export const config = {
  supabaseUrl: env("SUPABASE_URL"),
  supabaseAnonKey: env("SUPABASE_ANON_KEY"),

  agentName: env("AGENT_NAME", "windows-render-01"),
  agentKey: env("AGENT_KEY", "render-agent-win01"),

  pollIntervalSeconds: parseInt(env("POLL_INTERVAL_SECONDS", "30"), 10),

  nasUncPrefix: env("NAS_UNC_PREFIX", "\\\\edgesynology2\\mac"),

  spacesKey: env("DO_SPACES_KEY", ""),
  spacesSecret: env("DO_SPACES_SECRET", ""),
  spacesRegion: env("DO_SPACES_REGION", "nyc3"),
  spacesBucket: env("DO_SPACES_BUCKET", "popdam"),

  illustratorPath: env(
    "ILLUSTRATOR_PATH",
    "C:\\Program Files\\Adobe\\Adobe Illustrator 2024\\Support Files\\Contents\\Windows\\Illustrator.exe"
  ),

  thumbnailMaxSize: parseInt(env("THUMBNAIL_MAX_SIZE", "800"), 10),
  thumbnailQuality: parseInt(env("THUMBNAIL_QUALITY", "85"), 10),

  dataDir: env("DATA_DIR", path.join(process.cwd(), "data")),
};

function env(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined) return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}
