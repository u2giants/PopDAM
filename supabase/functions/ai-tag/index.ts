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

    const { data: assets, error: fetchError } = await supabase
      .from("assets")
      .select("id, filename, file_path, file_type, thumbnail_url")
      .in("id", asset_ids);

    if (fetchError) return json({ error: fetchError.message }, 500);

    // Fetch taxonomy
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
        // Extract style number from filename before AI runs
        const filenameStyleNumber = extractStyleNumber(asset.filename);
        const prompt = buildPrompt(asset, taxonomy, filenameStyleNumber);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
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

        // Build update payload
        const updates: Record<string, unknown> = { status: "tagged" };

        // Filterable tags (lowercase, deduplicated)
        const tagSet = new Set<string>();
        if (parsed.tags && Array.isArray(parsed.tags)) {
          parsed.tags.forEach((t: string) => {
            const clean = t.toLowerCase().trim();
            if (clean) tagSet.add(clean);
          });
        }
        // Add tech pack extracted info as tags too
        if (parsed.designer) tagSet.add(`designer: ${parsed.designer.trim()}`);
        if (parsed.style_guide_ref) tagSet.add(`sg: ${parsed.style_guide_ref.trim()}`);
        if (parsed.product_size) tagSet.add(`size: ${parsed.product_size.trim()}`);
        updates.tags = [...tagSet];

        // Scene/action description (what's happening in the art)
        if (parsed.scene_description) updates.scene_description = parsed.scene_description;

        // Legacy ai_description kept for backward compat
        if (parsed.scene_description) updates.ai_description = parsed.scene_description;

        if (parsed.asset_type) updates.asset_type = parsed.asset_type;
        if (parsed.is_licensed !== undefined) updates.is_licensed = parsed.is_licensed;
        if (parsed.art_source) updates.art_source = parsed.art_source;
        // design_ref: prefer AI-extracted, fall back to filename regex
        updates.design_ref = parsed.design_ref || filenameStyleNumber || null;
        if (parsed.design_style) updates.design_style = parsed.design_style;
        if (parsed.big_theme) updates.big_theme = parsed.big_theme;
        if (parsed.little_theme) updates.little_theme = parsed.little_theme;
        // Add style number to tags if found
        const styleNum = updates.design_ref as string | null;
        if (styleNum) tagSet.add(`style: ${styleNum.toLowerCase()}`);
        // Add image category as a tag
        if (parsed.image_category) {
          const cat = parsed.image_category.trim().toLowerCase();
          if (cat !== "null") {
            tagSet.add(cat.replace(/_/g, " "));
          }
        }

        // Resolve property
        if (parsed.property_name) {
          const prop = taxonomy.properties.find(
            (p) => p.name.toLowerCase() === parsed.property_name.toLowerCase()
          );
          if (prop) {
            updates.property_id = prop.id;
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

        // Handle characters (many-to-many) with verification
        if (parsed.character_names && Array.isArray(parsed.character_names)) {
          await supabase.from("asset_characters").delete().eq("asset_id", asset.id);
          const verifiedChars: string[] = [];
          for (const charName of parsed.character_names) {
            const char = taxonomy.characters.find(
              (c) => c.name.toLowerCase() === charName.toLowerCase()
            );
            if (char) {
              // Verify: only accept characters that belong to the matched property
              if (updates.property_id) {
                const charRecord = taxonomy.characters.find(c => c.id === char.id);
                const charProperty = taxonomy.properties.find(p => p.id === charRecord?.property_id);
                if (charProperty && charProperty.id !== updates.property_id) {
                  console.warn(`Character "${charName}" belongs to property "${charProperty.name}", not the matched property. Skipping.`);
                  continue;
                }
              }
              await supabase.from("asset_characters").insert({
                asset_id: asset.id,
                character_id: char.id,
              });
              verifiedChars.push(charName);
            }
          }
          if (verifiedChars.length !== parsed.character_names.length) {
            console.warn(`Asset ${asset.id}: AI suggested ${parsed.character_names.length} characters, verified ${verifiedChars.length}. Dropped: ${parsed.character_names.filter((n: string) => !verifiedChars.some(v => v.toLowerCase() === n.toLowerCase())).join(", ")}`);
          }
        }

        results.push({ asset_id: asset.id, success: true });
      } catch (err) {
        results.push({ asset_id: asset.id, success: false, error: err.message });
        await supabase.from("assets").update({ status: "error" }).eq("id", asset.id);
      }
    }

    return json({ results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

// ── System prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert visual analyst for a consumer products company that licenses characters (Disney, Marvel, Star Wars, etc.) for products like bedding, décor, and apparel.

Your job is to analyze design asset images and produce:
1. FILTERABLE TAGS — short, lowercase keywords a designer would use to find this asset. Include: licensor name, property name, individual character names, product type, colors, design style (e.g. "allover print", "group shot", "single character", "3d lenticular", "canvas", "repeat pattern"), mood, and any other relevant search terms.
2. SCENE DESCRIPTION — one sentence describing what is happening in the artwork itself (the characters' poses, the composition, the pattern type). NOT a description of the photograph or the physical product.
3. TAXONOMY MATCHING — map to the company's internal taxonomy using exact names provided.
4. TECH PACK EXTRACTION — if the image shows a tech pack or specification sheet, extract any visible text information such as: designer name/initials, style guide reference, product dimensions/sizes, color callouts, material specs, and any reference numbers. Include these as structured fields.
5. IMAGE CLASSIFICATION — classify the image into one of these categories:
   - "amazon_image" — a person holding or modeling the product (often holding it up in front of their face/body), OR a product shot against a plain white/clean background intended for e-commerce listing
   - "lifestyle" — the product photographed in a real-life setting (bedroom, living room, etc.) showing how it looks in use
   - "professional_photography" — studio product photography with controlled lighting, styled but not in a real room setting
   - "tech_pack" — a technical specification sheet, flat sketch, or construction document
   - "packaging" — packaging design files: hang tags, sewn-in labels, box/bag artwork, UPC panels, header cards
   - "design_art" — the raw artwork/design itself (character art, pattern, composition) not on a physical product
   If unsure, use null.

CHARACTER IDENTIFICATION — CRITICAL RULES:
- You MUST identify each character INDIVIDUALLY based on their VISUAL APPEARANCE in the image, not assumptions.
- Do NOT guess character names. Only tag characters you can visually confirm.
- Pay close attention to distinguishing features: costume color, hair, accessories, body shape, logo/symbol.
- Spider-Man (Peter Parker) wears RED and BLUE. Spider-Woman (Jessica Drew) wears RED and YELLOW. Miles Morales wears BLACK and RED. Spider-Gwen wears WHITE with a hood.
- If you cannot confidently identify a specific character, describe them generically (e.g. "unidentified character") rather than guessing wrong.
- For group shots, identify EACH character separately. Do not assume a character is present just because others from the same property are.
- VERIFY each character name against the available characters list. Only use EXACT matches.

Always respond with valid JSON.`;

// ── Style number extraction from filename ─────────────────────
/**
 * Extracts style/design reference numbers from filenames.
 * Patterns like: VSZ26MVSP09, VDC83WBEF04, 0GP25DYMM01
 * Format: 3 alphanum + 2 digits + 3-4 letters + 2 digits (roughly 11 chars)
 */
function extractStyleNumber(filename: string): string | null {
  // Remove extension
  const name = filename.replace(/\.[^.]+$/, "");
  // Pattern: alphanumeric code at start or after separator, 9-12 chars of mixed letters+digits
  // Matches codes like VSZ26MVSP09, VDC83WBEF04, 0GP25DYMM01
  const match = name.match(/\b([A-Z0-9]{2,4}\d{2}[A-Z]{2,5}\d{2,3})\b/i);
  if (match) return match[1].toUpperCase();
  // Broader: any leading alphanumeric block of 9-12 chars with mixed letters and digits
  const broad = name.match(/^([A-Z0-9]{9,12})\b/i);
  if (broad && /\d/.test(broad[1]) && /[A-Z]/i.test(broad[1])) return broad[1].toUpperCase();
  return null;
}

// ── Prompt builder ─────────────────────────────────────────────
function buildPrompt(
  asset: { filename: string; file_path: string; file_type: string },
  taxonomy: {
    licensors: { id: string; name: string }[];
    properties: { id: string; name: string }[];
    characters: { id: string; name: string }[];
    product_categories: { id: string; name: string }[];
    product_types: { id: string; name: string }[];
    product_subtypes: { id: string; name: string }[];
  },
  filenameStyleNumber: string | null
): string {
  const styleHint = filenameStyleNumber
    ? `\nStyle number detected from filename: "${filenameStyleNumber}". Confirm or override if the image shows a different reference number.\n`
    : `\nNo style number detected from filename. Look carefully for any style/design reference number visible on the image (e.g. codes like VSZ26MVSP09, VDC83WBEF04) or in the filename itself.\n`;

  return `Analyze this design asset.

File: ${asset.filename}
Path: ${asset.file_path}
Type: ${asset.file_type}
${styleHint}

Available Properties (licensed brands): ${taxonomy.properties.map((p) => p.name).join(", ")}
Available Characters: ${taxonomy.characters.map((c) => c.name).join(", ")}
Available Product Subtypes: ${taxonomy.product_subtypes.map((s) => s.name).join(", ")}

Respond with JSON in this exact format:
{
  "tags": ["disney", "princess", "belle", "cinderella", "group shot", "pink", "canvas", "bedding"],
  "scene_description": "Three Disney princesses standing together in a garden setting with a floral border pattern",
  "is_licensed": true,
  "property_name": "exact name from available properties or null",
  "character_names": ["exact names from available characters"],
  "product_subtype_name": "exact name from available subtypes or null",
  "asset_type": "art_piece or product",
  "image_category": "amazon_image | lifestyle | professional_photography | tech_pack | packaging | design_art | null",
  "art_source": "freelancer or straight_style_guide or style_guide_composition or null",
  "big_theme": "theme category or null",
  "little_theme": "specific theme or null",
  "design_ref": "design reference number if visible or null",
  "design_style": "design style number if visible or null",
  "designer": "designer name or initials if visible on the image or null",
  "style_guide_ref": "style guide reference if visible or null",
  "product_size": "product dimensions/size if visible or null"
}

RULES:
- tags: 8-20 lowercase keywords. Include licensor, property, each character name, product type, dominant colors, composition style (group shot, single character, allover print, repeat pattern, 3d lenticular, etc.), mood, and any other relevant search terms.
- HIERARCHICAL TAGGING: Always include broader category tags alongside specific ones. If the product is a "coir doormat", also tag "doormat" and "floor covering". If it's a "twin comforter", also tag "comforter" and "bedding". If it's a "standard pillowcase", also tag "pillowcase" and "bedding". Think: specific item → general item type → product family. This helps designers find assets whether they search broadly or specifically.
- SYNONYM EXPANSION: For each broad category tag, also include common synonyms and alternate terms designers might search for. Examples:
  * "floor covering" → also tag "floor", "flooring"
  * "bedding" → also tag "bed", "bed linen"
  * "wall art" → also tag "wall decor", "wall hanging"
  * "throw blanket" → also tag "throw", "blanket"
  * "curtain" → also tag "drape", "drapery", "window treatment"
  * "rug" → also tag "area rug", "floor covering", "flooring"
  Apply this principle broadly: always think about what alternate words a designer might type to find this product.
- scene_description: Describe ONLY what is depicted in the artwork/design — character poses, pattern layout, composition. NOT the physical product or photograph.
- Only use property_name/character_names/product_subtype_name that EXACTLY match the available options. If unsure, use null.
- CHARACTER IDENTIFICATION IS CRITICAL: Identify each character by their VISUAL features (costume colors, accessories, hair, symbols). Do NOT assume a character is present — confirm by sight. If you cannot visually confirm a character's identity, omit them from character_names entirely.
- image_category: Classify the image. IMPORTANT filename hints:
  * If filename contains "packaging", "hangtag", "hang tag", "sewn-in", "sewin", "label", "upc", "header card" → use "packaging"
  * If filename contains "tech pack" or "techpack" → use "tech_pack"
  * If filename contains "lifestyle" or "room" → use "lifestyle"
  * If filename contains "holding" → use "amazon_image"
  * If filename contains "mockup" or "mock up" → use "professional_photography"
  * If filename contains "art" (standalone) → use "design_art"
  * Otherwise classify visually:
    - "amazon_image" = person holding/modeling product OR product on plain white background for e-commerce
    - "lifestyle" = product in a real room/setting showing real-life use
    - "professional_photography" = styled studio shot with controlled lighting
    - "tech_pack" = specification sheet, flat sketch, construction document
    - "packaging" = hang tag, sewn-in label, box/bag artwork, UPC panel, header card design
    - "design_art" = raw artwork, character art, pattern design (not on a product)
- If the image shows a tech pack / spec sheet, extract designer, style_guide_ref, product_size from visible text. Also add "tech pack" to tags.
- designer: look for text like "Designer:", "Created by:", initials, or signature text on the image.
- style_guide_ref: look for "Style Guide:", "SG#", or reference codes.
- product_size: look for dimensions, sizing info like "60x80", "Twin", "Queen", etc.`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
