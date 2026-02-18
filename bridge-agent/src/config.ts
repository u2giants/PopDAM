import path from "path";

export const config = {
  // API
  supabaseUrl: env("SUPABASE_URL"),
  supabaseAnonKey: env("SUPABASE_ANON_KEY"),

  // Agent identity (who this agent is — NOT the NAS hostname)
  agentName: env("AGENT_NAME", "edgesynology2"),
  agentKey: env("AGENT_KEY", "bridge-agent-edgesynology2"),

  // NAS topology
  nasHost: env("NAS_HOST", env("AGENT_NAME", "edgesynology2")),
  nasShare: env("NAS_SHARE", "mac"),
  get nasMountRoot(): string {
    return env("NAS_MOUNT_ROOT", `/mnt/nas/${this.nasShare}`);
  },

  // Scanning — defaults to nasMountRoot if not set
  get scanRoots(): string[] {
    const raw = envOptional("SCAN_ROOTS");
    if (raw) return raw.split(",").map((s) => s.trim());
    return [this.nasMountRoot];
  },
  scanMinDate: env("SCAN_MIN_DATE", "2020-01-01"),
  scanIntervalMinutes: parseInt(env("SCAN_INTERVAL_MINUTES", "10"), 10),
  scanExtensions: env("SCAN_EXTENSIONS", "psd,ai")
    .split(",")
    .map((s) => s.trim().toLowerCase()),

  // Thumbnails
  thumbnailMaxSize: parseInt(env("THUMBNAIL_MAX_SIZE", "800"), 10),
  thumbnailQuality: parseInt(env("THUMBNAIL_QUALITY", "85"), 10),

  // DigitalOcean Spaces (S3-compatible)
  spacesKey: env("DO_SPACES_KEY", ""),
  spacesSecret: env("DO_SPACES_SECRET", ""),
  spacesRegion: env("DO_SPACES_REGION", "nyc3"),
  spacesBucket: env("DO_SPACES_BUCKET", "popdam"),

  // Internal paths
  dataDir: env("DATA_DIR", path.join(process.cwd(), "data")),
};

function env(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined) return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

function envOptional(key: string): string | undefined {
  return process.env[key];
}
