import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);
  // path: /agent-api/{action}
  const action = path[path.length - 1];

  try {
    // --- REGISTER ---
    if (action === "register" && req.method === "POST") {
      const { agent_name, agent_key, metadata } = await req.json();
      if (!agent_name || !agent_key) {
        return json({ error: "agent_name and agent_key required" }, 400);
      }

      // Upsert by agent_key
      const { data, error } = await supabase
        .from("agent_registrations")
        .upsert(
          { agent_name, agent_key, metadata, last_heartbeat: new Date().toISOString() },
          { onConflict: "agent_key" }
        )
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ agent: data });
    }

    // --- HEARTBEAT ---
    if (action === "heartbeat" && req.method === "POST") {
      const { agent_key } = await req.json();
      const { data, error } = await supabase
        .from("agent_registrations")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("agent_key", agent_key)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ agent: data });
    }

    // --- CLAIM JOBS ---
    if (action === "claim" && req.method === "POST") {
      const { agent_id, batch_size } = await req.json();
      if (!agent_id) return json({ error: "agent_id required" }, 400);

      const { data, error } = await supabase.rpc("claim_jobs", {
        p_agent_id: agent_id,
        p_batch_size: batch_size || 5,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ jobs: data });
    }

    // --- COMPLETE JOB ---
    if (action === "complete" && req.method === "POST") {
      const { job_id, status, error_message, asset_updates } = await req.json();
      if (!job_id) return json({ error: "job_id required" }, 400);

      const jobStatus = status === "failed" ? "failed" : "completed";

      // Update the job
      const { error: jobError } = await supabase
        .from("processing_queue")
        .update({
          status: jobStatus,
          completed_at: new Date().toISOString(),
          error_message: error_message || null,
        })
        .eq("id", job_id);

      if (jobError) return json({ error: jobError.message }, 500);

      // If asset updates provided (thumbnail_url, ai_description, etc.), apply them
      if (asset_updates && asset_updates.asset_id) {
        const { asset_id, ...updates } = asset_updates;
        const { error: assetError } = await supabase
          .from("assets")
          .update(updates)
          .eq("id", asset_id);

        if (assetError) return json({ error: assetError.message }, 500);
      }

      return json({ success: true });
    }

    // --- SUBMIT ASSET (ingest a new file) ---
    if (action === "ingest" && req.method === "POST") {
      const { filename, file_path, file_type, file_size, width, height, artboards, color_placeholder } = await req.json();
      if (!filename || !file_path || !file_type) {
        return json({ error: "filename, file_path, and file_type required" }, 400);
      }

      // Create asset record
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .insert({
          filename,
          file_path,
          file_type,
          file_size: file_size || 0,
          width: width || 0,
          height: height || 0,
          artboards: artboards || 1,
          color_placeholder: color_placeholder || null,
          status: "pending",
        })
        .select()
        .single();

      if (assetError) return json({ error: assetError.message }, 500);

      // Queue a tagging job
      const { error: queueError } = await supabase
        .from("processing_queue")
        .insert({ asset_id: asset.id, job_type: "tag", status: "pending" });

      if (queueError) return json({ error: queueError.message }, 500);

      return json({ asset, queued: true });
    }

    // --- UPDATE ASSET (e.g. thumbnail_url, dimensions) ---
    if (action === "update-asset" && req.method === "POST") {
      const { asset_id, ...updates } = await req.json();
      if (!asset_id) return json({ error: "asset_id required" }, 400);

      const { data, error } = await supabase
        .from("assets")
        .update(updates)
        .eq("id", asset_id)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ asset: data });
    }

    // --- RESET STALE ---
    if (action === "reset-stale" && req.method === "POST") {
      const { timeout_minutes } = await req.json().catch(() => ({}));
      const { data, error } = await supabase.rpc("reset_stale_jobs", {
        p_timeout_minutes: timeout_minutes || 30,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ reset_count: data });
    }

    return json({ error: "Unknown action: " + action }, 404);
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
