import path from "path";

export const config = {
  // API
  supabaseUrl: env("SUPABASE_URL"),
  supabaseAnonKey: env("SUPABASE_ANON_KEY"),

  // Agent identity
  agentName: env("AGENT_NAME", "edgesynology2"),
  agentKey: env("AGENT_KEY", "bridge-agent-edgesynology2"),

  // Scanning
  scanRoots: env("SCAN_ROOTS", "/mnt/nas/Design")
    .split(",")
    .map((s) => s.trim()),
  scanMinDate: env("SCAN_MIN_DATE", "2020-01-01"),
  scanIntervalMinutes: parseInt(env("SCAN_INTERVAL_MINUTES", "10"), 10),
  scanExtensions: env("SCAN_EXTENSIONS", "psd,ai")
    .split(",")
    .map((s) => s.trim().toLowerCase()),

  // Thumbnails
  thumbnailMaxSize: parseInt(env("THUMBNAIL_MAX_SIZE", "800"), 10),
  thumbnailQuality: parseInt(env("THUMBNAIL_QUALITY", "85"), 10),

  // Internal paths
  dataDir: env("DATA_DIR", path.join(process.cwd(), "data")),
};

function env(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined) return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}
