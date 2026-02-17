import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StatusCounts {
  tagged: number;
  processing: number;
  pending: number;
  error: number;
  preview_ready: number;
}

export function useStatusCounts() {
  return useQuery({
    queryKey: ["status-counts"],
    queryFn: async () => {
      // Get counts by status
      const { data, error } = await supabase
        .from("assets")
        .select("status, thumbnail_url");

      if (error) throw error;

      const counts: StatusCounts = {
        tagged: 0,
        processing: 0,
        pending: 0,
        error: 0,
        preview_ready: 0,
      };

      // We need to paginate to get all rows since default limit is 1000
      // Use RPC or count queries instead
      // Actually let's do separate count queries for accuracy
      const [tagged, processing, pending, errored, previewReady] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "tagged"),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "processing"),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "pending").is("thumbnail_url", null),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "error"),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "pending").not("thumbnail_url", "is", null),
      ]);

      return {
        tagged: tagged.count ?? 0,
        processing: processing.count ?? 0,
        pending: pending.count ?? 0,
        error: errored.count ?? 0,
        preview_ready: previewReady.count ?? 0,
      } as StatusCounts;
    },
    refetchInterval: 30000,
  });
}
