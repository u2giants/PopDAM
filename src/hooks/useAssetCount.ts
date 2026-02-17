import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAssetCount() {
  return useQuery({
    queryKey: ["asset_count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_asset_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}
