import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

/** Derive workflow_status from folder path */
function deriveWorkflowStatus(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  if (lower.includes("in process") || lower.includes("in_process")) return "in_process";
  if (lower.includes("customer adopted") || lower.includes("customer_adopted")) return "customer_adopted";
  if (lower.includes("licensor approved") || lower.includes("licensor_approved")) return "licensor_approved";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);
  const action = path[path.length - 1];

  try {
    // --- REGISTER ---
    if (action === "register" && req.method === "POST") {
      const { agent_name, agent_key, metadata } = await req.json();
      if (!agent_name || !agent_key) {
        return json({ error: "agent_name and agent_key required" }, 400);
      }

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
      const { agent_key, transfer_stats } = await req.json();

      // First fetch current metadata to merge transfer stats
      const { data: current, error: fetchErr } = await supabase
        .from("agent_registrations")
        .select("id, metadata")
        .eq("agent_key", agent_key)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!current) return json({ error: "Agent not found" }, 404);

      const metadata = (current.metadata as Record<string, unknown>) || {};

      // Store transfer stats for UI throughput chart
      if (transfer_stats) {
        const history = (metadata.transfer_history as Array<unknown>) || [];
        history.push({
          bytes_per_sec: transfer_stats.bytes_per_sec,
          bytes_uploaded: transfer_stats.bytes_uploaded,
          files_uploaded: transfer_stats.files_uploaded,
          ts: new Date().toISOString(),
        });
        // Keep last 60 data points (1 per minute = 1 hour of history)
        if (history.length > 60) history.splice(0, history.length - 60);
        metadata.transfer_history = history;
        metadata.transfer_current = transfer_stats;
      }

      const { data, error } = await supabase
        .from("agent_registrations")
        .update({ last_heartbeat: new Date().toISOString(), metadata })
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

      const { error: jobError } = await supabase
        .from("processing_queue")
        .update({
          status: jobStatus,
          completed_at: new Date().toISOString(),
          error_message: error_message || null,
        })
        .eq("id", job_id);

      if (jobError) return json({ error: jobError.message }, 500);

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
      const { filename, file_path, file_type, file_size, width, height, artboards, color_placeholder, modified_at, file_created_at } = await req.json();
      if (!filename || !file_path || !file_type) {
        return json({ error: "filename, file_path, and file_type required" }, 400);
      }

      const workflow_status = deriveWorkflowStatus(file_path);

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
          modified_at: modified_at || new Date().toISOString(),
          file_created_at: file_created_at || null,
          status: "pending",
          workflow_status,
        })
        .select()
        .single();

      if (assetError) return json({ error: assetError.message }, 500);

      const { error: queueError } = await supabase
        .from("processing_queue")
        .insert({ asset_id: asset.id, job_type: "tag", status: "pending" });

      if (queueError) return json({ error: queueError.message }, 500);

      return json({ asset, queued: true });
    }

    // --- UPDATE ASSET ---
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

    // --- MOVE ASSET (file moved to new folder) ---
    if (action === "move-asset" && req.method === "POST") {
      const { old_path, new_path } = await req.json();
      if (!old_path || !new_path) {
        return json({ error: "old_path and new_path required" }, 400);
      }

      // Find asset by old path
      const { data: asset, error: findError } = await supabase
        .from("assets")
        .select("id, file_path")
        .eq("file_path", old_path)
        .maybeSingle();

      if (findError) return json({ error: findError.message }, 500);
      if (!asset) return json({ error: "Asset not found at old_path" }, 404);

      const workflow_status = deriveWorkflowStatus(new_path);

      // Update asset path + workflow status
      const updateData: Record<string, unknown> = { file_path: new_path };
      if (workflow_status) updateData.workflow_status = workflow_status;

      const { error: updateError } = await supabase
        .from("assets")
        .update(updateData)
        .eq("id", asset.id);

      if (updateError) return json({ error: updateError.message }, 500);

      // Log movement in history
      const { error: historyError } = await supabase
        .from("asset_path_history")
        .insert({ asset_id: asset.id, old_path, new_path });

      if (historyError) {
        console.error("Failed to log path history:", historyError.message);
      }

      return json({ success: true, asset_id: asset.id, workflow_status });
    }

    // --- QUEUE RENDER (bridge agent flags a failed thumbnail) ---
    if (action === "queue-render" && req.method === "POST") {
      const { asset_id, reason } = await req.json();
      if (!asset_id) return json({ error: "asset_id required" }, 400);

      // Check for existing pending/claimed job
      const { data: existing } = await supabase
        .from("render_queue")
        .select("id")
        .eq("asset_id", asset_id)
        .in("status", ["pending", "claimed"])
        .maybeSingle();

      if (existing) {
        return json({ success: true, message: "Already queued", job_id: existing.id });
      }

      const { data, error } = await supabase
        .from("render_queue")
        .insert({ asset_id, status: "pending" })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, job: data });
    }

    // --- CLAIM RENDER (Windows agent polls for work) ---
    if (action === "claim-render" && req.method === "POST") {
      const { agent_name, batch_size } = await req.json();
      if (!agent_name) return json({ error: "agent_name required" }, 400);

      const limit = batch_size || 5;
      const now = new Date().toISOString();

      // Atomically claim pending jobs
      const { data: jobs, error } = await supabase
        .from("render_queue")
        .update({ status: "claimed", claimed_by: agent_name, claimed_at: now })
        .eq("status", "pending")
        .select("id, asset_id, created_at")
        .limit(limit);

      if (error) return json({ error: error.message }, 500);

      // For each claimed job, fetch the asset's file_path
      const enrichedJobs = [];
      for (const job of jobs || []) {
        const { data: asset } = await supabase
          .from("assets")
          .select("id, file_path, filename, file_type")
          .eq("id", job.asset_id)
          .single();
        enrichedJobs.push({ ...job, asset });
      }

      return json({ jobs: enrichedJobs });
    }

    // --- COMPLETE RENDER (Windows agent reports result) ---
    if (action === "complete-render" && req.method === "POST") {
      const { job_id, status, thumbnail_url, error_message } = await req.json();
      if (!job_id) return json({ error: "job_id required" }, 400);

      const jobStatus = status === "failed" ? "failed" : "completed";
      const now = new Date().toISOString();

      // Update render queue job
      const { data: job, error: jobError } = await supabase
        .from("render_queue")
        .update({
          status: jobStatus,
          completed_at: now,
          error_message: error_message || null,
        })
        .eq("id", job_id)
        .select("asset_id")
        .single();

      if (jobError) return json({ error: jobError.message }, 500);

      // If successful, update the asset with the thumbnail
      if (jobStatus === "completed" && thumbnail_url && job) {
        const { error: assetError } = await supabase
          .from("assets")
          .update({
            thumbnail_url,
            thumbnail_error: null, // Clear the error flag
            status: "processing",
          })
          .eq("id", job.asset_id);

        if (assetError) return json({ error: assetError.message }, 500);
      }

      return json({ success: true });
    }

    // --- TRIGGER SCAN (UI requests a scan) ---
    if (action === "trigger-scan" && req.method === "POST") {
      const { agent_key } = await req.json();
      if (!agent_key) return json({ error: "agent_key required" }, 400);

      const { data: agent, error: findErr } = await supabase
        .from("agent_registrations")
        .select("id, metadata")
        .eq("agent_key", agent_key)
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (!agent) return json({ error: "Agent not found" }, 404);

      const metadata = (agent.metadata as Record<string, unknown>) || {};
      metadata.scan_requested = true;
      metadata.scan_requested_at = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("agent_registrations")
        .update({ metadata })
        .eq("id", agent.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true, message: "Scan requested" });
    }

    // --- UPDATE SCAN PROGRESS (bridge agent reports progress) ---
    if (action === "scan-progress" && req.method === "POST") {
      const { agent_key, scan_status, scanned_count, new_count, total_estimate } = await req.json();
      if (!agent_key) return json({ error: "agent_key required" }, 400);

      const { data: agent, error: findErr } = await supabase
        .from("agent_registrations")
        .select("id, metadata")
        .eq("agent_key", agent_key)
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (!agent) return json({ error: "Agent not found" }, 404);

      const metadata = (agent.metadata as Record<string, unknown>) || {};
      metadata.scan_progress = {
        status: scan_status, // "scanning" | "processing" | "idle"
        scanned_count: scanned_count || 0,
        new_count: new_count || 0,
        total_estimate: total_estimate || 0,
        updated_at: new Date().toISOString(),
      };

      // Clear request flag and accumulate lifetime stats when scan completes
      if (scan_status === "idle") {
        metadata.scan_requested = false;
        metadata.last_scan_completed_at = new Date().toISOString();
        metadata.scan_cycles_completed = ((metadata.scan_cycles_completed as number) || 0) + 1;
        metadata.total_scanned_lifetime = ((metadata.total_scanned_lifetime as number) || 0) + (scanned_count || 0);
        metadata.total_new_lifetime = ((metadata.total_new_lifetime as number) || 0) + (new_count || 0);
      }

      const { error: updateErr } = await supabase
        .from("agent_registrations")
        .update({ metadata })
        .eq("id", agent.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true });
    }

    // --- INGESTION PROGRESS (bridge agent reports processing progress) ---
    if (action === "ingestion-progress" && req.method === "POST") {
      const { agent_key, ingestion_total, ingestion_done } = await req.json();
      if (!agent_key) return json({ error: "agent_key required" }, 400);

      const { data: agent, error: findErr } = await supabase
        .from("agent_registrations")
        .select("id, metadata")
        .eq("agent_key", agent_key)
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (!agent) return json({ error: "Agent not found" }, 404);

      const metadata = (agent.metadata as Record<string, unknown>) || {};
      metadata.ingestion_progress = {
        total: ingestion_total || 0,
        done: ingestion_done || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from("agent_registrations")
        .update({ metadata })
        .eq("id", agent.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true });
    }

    // --- CHECK SCAN REQUEST (bridge agent polls) ---
    if (action === "check-scan-request" && req.method === "POST") {
      const { agent_key } = await req.json();
      if (!agent_key) return json({ error: "agent_key required" }, 400);

      const { data: agent, error: findErr } = await supabase
        .from("agent_registrations")
        .select("id, metadata")
        .eq("agent_key", agent_key)
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (!agent) return json({ error: "Agent not found" }, 404);

      const metadata = (agent.metadata as Record<string, unknown>) || {};
      return json({ scan_requested: !!metadata.scan_requested });
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
