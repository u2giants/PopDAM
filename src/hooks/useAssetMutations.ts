import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ assetId, updates }: { assetId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("assets")
        .update(updates)
        .eq("id", assetId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["status-counts"] });
      toast({ title: "Asset updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateAssetCharacters() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ assetId, characterIds }: { assetId: string; characterIds: string[] }) => {
      // Clear existing
      await supabase.from("asset_characters").delete().eq("asset_id", assetId);
      // Insert new
      if (characterIds.length > 0) {
        const { error } = await supabase.from("asset_characters").insert(
          characterIds.map((cid) => ({ asset_id: assetId, character_id: cid }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Characters updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useAiTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { data, error } = await supabase.functions.invoke("ai-tag", {
        body: { asset_ids: assetIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["status-counts"] });
      const results = data?.results || [];
      const successCount = results.filter((r: any) => r.success).length;
      const failCount = results.filter((r: any) => !r.success).length;
      toast({
        title: "AI Tagging Complete",
        description: `${successCount} tagged${failCount > 0 ? `, ${failCount} failed` : ""}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "AI Tagging failed", description: err.message, variant: "destructive" });
    },
  });
}
