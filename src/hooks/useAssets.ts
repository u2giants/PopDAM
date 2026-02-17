import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DbAsset = Tables<"assets"> & {
  characters: { id: string; name: string }[];
  property: { id: string; name: string; licensor: { id: string; name: string } } | null;
  product_subtype: {
    id: string;
    name: string;
    product_type: { id: string; name: string; product_category: { id: string; name: string } } | null;
  } | null;
};

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const selectQuery = `
        *,
        asset_characters(
          character:characters(id, name)
        ),
        property:properties(id, name, licensor:licensors(id, name)),
        product_subtype:product_subtypes(
          id, name,
          product_type:product_types(id, name, product_category:product_categories(id, name))
        )
      `;

      const batchSize = 1000;
      let allData: any[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("assets")
          .select(selectQuery)
          .order("ingested_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      // Flatten characters
      return allData.map((row: any) => ({
        ...row,
        characters: (row.asset_characters || []).map((ac: any) => ac.character).filter(Boolean),
        asset_characters: undefined,
      })) as DbAsset[];
    },
  });
}

export function useLicensors() {
  return useQuery({
    queryKey: ["licensors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licensors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, licensor:licensors(id, name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCharacters() {
  return useQuery({
    queryKey: ["characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*, property:properties(id, name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductSubtypes() {
  return useQuery({
    queryKey: ["product_subtypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_subtypes")
        .select("*, product_type:product_types(id, name, product_category:product_categories(id, name))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
