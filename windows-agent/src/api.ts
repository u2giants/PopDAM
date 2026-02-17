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

export interface RenderJob {
  id: string;
  asset_id: string;
  asset: {
    id: string;
    file_path: string;
    filename: string;
    file_type: string;
  };
}

/** Claim pending render jobs */
export async function claimRenderJobs(batchSize = 3): Promise<RenderJob[]> {
  const result = await post("claim-render", {
    agent_name: config.agentName,
    batch_size: batchSize,
  });
  return result.jobs || [];
}

/** Complete a render job */
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

/** Register agent */
export async function registerAgent() {
  return post("register", {
    agent_name: config.agentName,
    agent_key: config.agentKey,
    metadata: {
      hostname: config.agentName,
      type: "windows-render",
      started_at: new Date().toISOString(),
    },
  });
}

/** Heartbeat */
export async function heartbeat() {
  return post("heartbeat", { agent_key: config.agentKey });
}
