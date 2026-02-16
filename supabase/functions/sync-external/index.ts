import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { entity, data } = body;
    // entity: "licensors" | "properties" | "characters" | "product_categories" | "product_types" | "product_subtypes"
    // data: array of records with external_id + fields

    if (!entity || !Array.isArray(data)) {
      return json({ error: "entity (string) and data (array) required" }, 400);
    }

    const validEntities = [
      "licensors",
      "properties",
      "characters",
      "product_categories",
      "product_types",
      "product_subtypes",
    ];
    if (!validEntities.includes(entity)) {
      return json({ error: `Invalid entity. Must be one of: ${validEntities.join(", ")}` }, 400);
    }

    const results = { inserted: 0, updated: 0, errors: [] as string[] };

    for (const record of data) {
      if (!record.external_id) {
        results.errors.push(`Missing external_id for record: ${JSON.stringify(record)}`);
        continue;
      }

      // Check if exists
      const { data: existing } = await supabase
        .from(entity)
        .select("id")
        .eq("external_id", record.external_id)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from(entity)
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq("external_id", record.external_id);
        if (error) {
          results.errors.push(`Update error for ${record.external_id}: ${error.message}`);
        } else {
          results.updated++;
        }
      } else {
        // Insert
        const { error } = await supabase.from(entity).insert(record);
        if (error) {
          results.errors.push(`Insert error for ${record.external_id}: ${error.message}`);
        } else {
          results.inserted++;
        }
      }
    }

    return json({ entity, results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
