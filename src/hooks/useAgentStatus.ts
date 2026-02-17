import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentStatus {
  id: string;
  agent_name: string;
  last_heartbeat: string;
  isOnline: boolean;
  metadata: {
    hostname?: string;
    scan_roots?: string[];
    started_at?: string;
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
        .single();

      if (error) throw error;

      const lastBeat = new Date(data.last_heartbeat).getTime();
      const now = Date.now();
      const isOnline = now - lastBeat < 10 * 60 * 1000; // 10 min

      return {
        id: data.id,
        agent_name: data.agent_name,
        last_heartbeat: data.last_heartbeat,
        isOnline,
        metadata: data.metadata as AgentStatus["metadata"],
      } as AgentStatus;
    },
    refetchInterval: 30_000, // poll every 30s
  });
}
