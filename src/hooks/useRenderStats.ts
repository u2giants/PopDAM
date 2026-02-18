import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RenderJob {
  id: string;
  asset_id: string;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  filename: string;
}

export interface RenderStats {
  currentJob: RenderJob | null;
  recentJobs: RenderJob[];
  last24h: {
    completed: number;
    failed: number;
    avgDurationSec: number;
  };
  pending: number;
}

export function useRenderStats(agentName?: string) {
  return useQuery({
    queryKey: ["render_stats", agentName],
    queryFn: async (): Promise<RenderStats> => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // Fetch current + recent jobs in parallel
      const [currentRes, recentRes, pendingRes, stats24hRes] = await Promise.all([
        // Currently processing
        supabase
          .from("render_queue")
          .select("*, assets!render_queue_asset_id_fkey(filename)")
          .in("status", ["claimed", "processing"])
          .order("claimed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Recent completed/failed (last 20)
        supabase
          .from("render_queue")
          .select("*, assets!render_queue_asset_id_fkey(filename)")
          .in("status", ["completed", "failed"])
          .order("completed_at", { ascending: false })
          .limit(20),

        // Pending count
        supabase
          .from("render_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // All completed in last 24h for stats
        supabase
          .from("render_queue")
          .select("claimed_at, completed_at, status")
          .gte("completed_at", twentyFourHoursAgo)
          .in("status", ["completed", "failed"]),
      ]);

      const mapJob = (row: any): RenderJob => ({
        id: row.id,
        asset_id: row.asset_id,
        status: row.status,
        claimed_by: row.claimed_by,
        claimed_at: row.claimed_at,
        completed_at: row.completed_at,
        error_message: row.error_message,
        created_at: row.created_at,
        filename: row.assets?.filename ?? "unknown",
      });

      const currentJob = currentRes.data ? mapJob(currentRes.data) : null;
      const recentJobs = (recentRes.data ?? []).map(mapJob);
      const pending = pendingRes.count ?? 0;

      // Calculate 24h stats
      const stats24h = stats24hRes.data ?? [];
      const completed24h = stats24h.filter((r) => r.status === "completed");
      const failed24h = stats24h.filter((r) => r.status === "failed");

      const durations = completed24h
        .filter((r) => r.claimed_at && r.completed_at)
        .map((r) => (new Date(r.completed_at!).getTime() - new Date(r.claimed_at!).getTime()) / 1000);

      const avgDurationSec =
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

      return {
        currentJob,
        recentJobs,
        last24h: {
          completed: completed24h.length,
          failed: failed24h.length,
          avgDurationSec,
        },
        pending,
      };
    },
    refetchInterval: 5_000,
    enabled: true,
  });
}
