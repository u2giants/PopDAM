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
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { asset_ids } = await req.json();
    if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
      return json({ error: "asset_ids array required" }, 400);
    }

    // Fetch assets with their thumbnail URLs
    const { data: assets, error: fetchError } = await supabase
      .from("assets")
      .select("id, filename, file_path, file_type, thumbnail_url")
      .in("id", asset_ids);

    if (fetchError) return json({ error: fetchError.message }, 500);

    // Fetch available taxonomy for the AI to use
    const [licensorsRes, propertiesRes, charactersRes, categoriesRes, typesRes, subtypesRes] = await Promise.all([
      supabase.from("licensors").select("id, name"),
      supabase.from("properties").select("id, name, licensor_id"),
      supabase.from("characters").select("id, name, property_id"),
      supabase.from("product_categories").select("id, name"),
      supabase.from("product_types").select("id, name, category_id"),
      supabase.from("product_subtypes").select("id, name, type_id"),
    ]);

    const taxonomy = {
      licensors: licensorsRes.data || [],
      properties: propertiesRes.data || [],
      characters: charactersRes.data || [],
      product_categories: categoriesRes.data || [],
      product_types: typesRes.data || [],
      product_subtypes: subtypesRes.data || [],
    };

    const results: { asset_id: string; success: boolean; error?: string }[] = [];

    for (const asset of assets || []) {
      try {
        // Build the prompt
        const prompt = buildPrompt(asset, taxonomy);

        // Call Lovable AI
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are an expert at classifying design assets for a consumer products company. You analyze file names, paths, and thumbnails to identify licensed characters, properties, product categories, and write descriptions. Always respond with valid JSON." },
              ...(asset.thumbnail_url
                ? [{ role: "user", content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: asset.thumbnail_url } },
                  ]}]
                : [{ role: "user", content: prompt }]),
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          throw new Error(`AI API error: ${aiRes.status} ${errText}`);
        }

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content;
        if (!content) throw new Error("No AI response content");

        const parsed = JSON.parse(content);

        // Apply tags
        const updates: Record<string, unknown> = {
          status: "tagged",
        };

        if (parsed.ai_description) updates.ai_description = parsed.ai_description;
        if (parsed.asset_type) updates.asset_type = parsed.asset_type;
        if (parsed.is_licensed !== undefined) updates.is_licensed = parsed.is_licensed;
        if (parsed.art_source) updates.art_source = parsed.art_source;
        if (parsed.design_ref) updates.design_ref = parsed.design_ref;
        if (parsed.design_style) updates.design_style = parsed.design_style;
        if (parsed.big_theme) updates.big_theme = parsed.big_theme;
        if (parsed.little_theme) updates.little_theme = parsed.little_theme;

        // Resolve property
        if (parsed.property_name) {
          const prop = taxonomy.properties.find(
            (p) => p.name.toLowerCase() === parsed.property_name.toLowerCase()
          );
          if (prop) {
            updates.property_id = prop.id;
            // Also set licensor from property
            updates.licensor_id = prop.licensor_id;
          }
        }

        // Resolve product subtype
        if (parsed.product_subtype_name) {
          const sub = taxonomy.product_subtypes.find(
            (s) => s.name.toLowerCase() === parsed.product_subtype_name.toLowerCase()
          );
          if (sub) updates.product_subtype_id = sub.id;
        }

        // Update asset
        const { error: updateErr } = await supabase
          .from("assets")
          .update(updates)
          .eq("id", asset.id);

        if (updateErr) throw new Error(updateErr.message);

        // Handle characters (many-to-many)
        if (parsed.character_names && Array.isArray(parsed.character_names)) {
          // Clear existing
          await supabase.from("asset_characters").delete().eq("asset_id", asset.id);

          for (const charName of parsed.character_names) {
            const char = taxonomy.characters.find(
              (c) => c.name.toLowerCase() === charName.toLowerCase()
            );
            if (char) {
              await supabase.from("asset_characters").insert({
                asset_id: asset.id,
                character_id: char.id,
              });
            }
          }
        }

        results.push({ asset_id: asset.id, success: true });
      } catch (err) {
        results.push({ asset_id: asset.id, success: false, error: err.message });
        // Mark as error
        await supabase.from("assets").update({ status: "error" }).eq("id", asset.id);
      }
    }

    return json({ results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function buildPrompt(
  asset: { filename: string; file_path: string; file_type: string },
  taxonomy: {
    licensors: { id: string; name: string }[];
    properties: { id: string; name: string }[];
    characters: { id: string; name: string }[];
    product_categories: { id: string; name: string }[];
    product_types: { id: string; name: string }[];
    product_subtypes: { id: string; name: string }[];
  }
): string {
  return `Analyze this design asset and classify it.

File: ${asset.filename}
Path: ${asset.file_path}
Type: ${asset.file_type}

Available Properties (licensed brands): ${taxonomy.properties.map((p) => p.name).join(", ")}
Available Characters: ${taxonomy.characters.map((c) => c.name).join(", ")}
Available Product Subtypes: ${taxonomy.product_subtypes.map((s) => s.name).join(", ")}

Respond with JSON:
{
  "ai_description": "A brief description of the design (1-2 sentences)",
  "is_licensed": true/false,
  "property_name": "exact name from available properties or null",
  "character_names": ["exact names from available characters"],
  "product_subtype_name": "exact name from available subtypes or null",
  "asset_type": "art_piece" or "product",
  "art_source": "freelancer" or "straight_style_guide" or "style_guide_composition" or null,
  "big_theme": "theme category or null",
  "little_theme": "specific theme or null",
  "design_ref": "design reference number if visible or null",
  "design_style": "design style number if visible or null"
}

Only use names that EXACTLY match the available options. If unsure, use null.`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
