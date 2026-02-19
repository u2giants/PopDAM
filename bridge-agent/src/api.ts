import { config } from "./config";

const baseUrl = `${config.supabaseUrl}/functions/v1/agent-api`;

const headers = {
  "Content-Type": "application/json",
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${config.supabaseAnonKey}`,
  "x-agent-key": config.agentKey,
};

async function post(action: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${baseUrl}/${action}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API ${action} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

/** Register or re-register this agent */
export async function registerAgent() {
  const result = await post("register", {
    agent_name: config.agentName,
    agent_key: config.agentKey,
    metadata: {
      hostname: config.agentName,
      scan_roots: config.scanRoots,
      started_at: new Date().toISOString(),
    },
  });
  console.log(`[API] Registered as agent ${result.agent.id}`);
  return result.agent;
}

/** Send heartbeat with optional transfer stats */
export async function heartbeat(transferStats?: {
  bytes_uploaded: number;
  files_uploaded: number;
  elapsed_ms: number;
  bytes_per_sec: number;
}) {
  return post("heartbeat", {
    agent_key: config.agentKey,
    transfer_stats: transferStats || null,
  });
}

/** Ingest a new asset */
export async function ingestAsset(asset: {
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  width: number;
  height: number;
  artboards: number;
  color_placeholder?: string;
  thumbnail_url?: string;
  modified_at?: string;
  file_created_at?: string;
}) {
  return post("ingest", asset);
}

/** Claim processing jobs */
export async function claimJobs(agentId: string, batchSize = 5) {
  return post("claim", { agent_id: agentId, batch_size: batchSize });
}

/** Update an asset (e.g. thumbnail, dimensions) */
export async function updateAsset(assetId: string, updates: Record<string, unknown>) {
  return post("update-asset", { asset_id: assetId, ...updates });
}

/** Complete a job */
export async function completeJob(
  jobId: string,
  status: "completed" | "failed",
  assetUpdates?: Record<string, unknown>,
  errorMessage?: string
) {
  return post("complete", {
    job_id: jobId,
    status,
    asset_updates: assetUpdates,
    error_message: errorMessage,
  });
}

/** Report a file movement (hash found at new path) */
export async function moveAsset(oldPath: string, newPath: string) {
  return post("move-asset", { old_path: oldPath, new_path: newPath });
}

/** Queue a render job for the Windows agent */
export async function queueRender(assetId: string, reason: string) {
  return post("queue-render", { asset_id: assetId, reason });
}

/** Claim render jobs (used by Windows agent) */
export async function claimRenderJobs(agentName: string, batchSize = 5) {
  return post("claim-render", { agent_name: agentName, batch_size: batchSize });
}

/** Complete a render job (used by Windows agent) */
export async function completeRender(
  jobId: string,
  status: "completed" | "failed",
  thumbnailUrl?: string,
  errorMessage?: string
) {
  return post("complete-render", {
    job_id: jobId,
    status,
    thumbnail_url: thumbnailUrl,
    error_message: errorMessage,
  });
}

/** Check if UI has requested a scan */
export async function checkScanRequest() {
  return post("check-scan-request", { agent_key: config.agentKey });
}

/** Report scan progress to the API */
export async function reportScanProgress(scanStatus: string, scannedCount: number, newCount: number, totalEstimate?: number) {
  return post("scan-progress", {
    agent_key: config.agentKey,
    scan_status: scanStatus,
    scanned_count: scannedCount,
    new_count: newCount,
    total_estimate: totalEstimate || 0,
  });
}

/** Report ingestion progress (how many scanned files have been processed) */
export async function reportIngestionProgress(total: number, done: number) {
  return post("ingestion-progress", {
    agent_key: config.agentKey,
    ingestion_total: total,
    ingestion_done: done,
  });
}

/** Fetch configured scan roots from the API (set via admin UI) */
export async function getConfiguredScanRoots(): Promise<string[] | null> {
  try {
    const result = await post("get-scan-roots", { agent_key: config.agentKey });
    return result.scan_roots || null;
  } catch {
    return null;
  }
}
