import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScanProgress {
  status: "scanning" | "processing" | "idle";
  scanned_count: number;
  new_count: number;
  total_estimate: number;
  updated_at: string;
}

export interface TransferPoint {
  bytes_per_sec: number;
  bytes_uploaded: number;
  files_uploaded: number;
  ts: string;
}

export interface TransferCurrent {
  bytes_uploaded: number;
  files_uploaded: number;
  elapsed_ms: number;
  bytes_per_sec: number;
}

export interface AgentStatus {
  id: string;
  agent_name: string;
  agent_key: string;
  last_heartbeat: string;
  isOnline: boolean;
  metadata: {
    hostname?: string;
    scan_roots?: string[];
    started_at?: string;
    scan_requested?: boolean;
    scan_requested_at?: string;
    scan_progress?: ScanProgress;
    transfer_history?: TransferPoint[];
    transfer_current?: TransferCurrent;
  } | null;
}

export function useAgentStatus() {
  return useQuery({
    queryKey: ["agent_status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_registrations")
        .select("*")
        .order("last_heartbeat", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const lastBeat = new Date(data.last_heartbeat).getTime();
      const now = Date.now();
      const isOnline = now - lastBeat < 10 * 60 * 1000;

      return {
        id: data.id,
        agent_name: data.agent_name,
        agent_key: data.agent_key,
        last_heartbeat: data.last_heartbeat,
        isOnline,
        metadata: data.metadata as AgentStatus["metadata"],
      } as AgentStatus;
    },
    refetchInterval: 5_000, // poll every 5s for scan progress
  });
}
