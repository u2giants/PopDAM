import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterCounts {
  file_type: Record<string, number>;
  workflow_status: Record<string, number>;
  image_type: Record<string, number>;
  is_licensed: Record<string, number>;
}

export function useFilterCounts() {
  return useQuery({
    queryKey: ["filter-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_filter_counts");
      if (error) throw error;
      return (data as unknown as FilterCounts) ?? {
        file_type: {},
        workflow_status: {},
        image_type: {},
        is_licensed: {},
      };
    },
    refetchInterval: 30000,
  });
}
