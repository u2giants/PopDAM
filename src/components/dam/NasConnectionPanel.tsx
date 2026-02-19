import { useState, useEffect, useRef } from "react";
import { Server, Wifi, WifiOff, Clock, HardDrive, ChevronDown, ChevronUp, Play, Loader2, Monitor, FileImage, CheckCircle, XCircle, Timer, Layers, FolderPlus, Trash2, Save } from "lucide-react";
import { useAllAgents, AgentStatus } from "@/hooks/useAgentStatus";
import { useRenderStats } from "@/hooks/useRenderStats";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Scan Roots Editor ─── */
const ScanRootsEditor = ({ agent }: { agent: AgentStatus }) => {
  const currentRoots = agent.metadata?.configured_scan_roots || agent.metadata?.scan_roots || [];
  const [roots, setRoots] = useState<string[]>(currentRoots);
  const [newRoot, setNewRoot] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(roots) !== JSON.stringify(currentRoots);

  useEffect(() => {
    const updated = agent.metadata?.configured_scan_roots || agent.metadata?.scan_roots || [];
    setRoots(updated);
  }, [agent.metadata?.configured_scan_roots, agent.metadata?.scan_roots]);

  const handleAdd = () => {
    const trimmed = newRoot.trim();
    if (!trimmed || roots.includes(trimmed)) return;
    setRoots([...roots, trimmed]);
    setNewRoot("");
  };

  const handleRemove = (index: number) => {
    setRoots(roots.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (roots.length === 0) {
      toast.error("At least one scan root is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("agent-api/set-scan-roots", {
        body: { agent_key: agent.agent_key, scan_roots: roots },
      });
      if (error) throw error;
      toast.success("Scan roots updated — changes take effect on next scan cycle");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-xs">Scan roots:</span>
      {roots.map((root, i) => (
        <div key={i} className="flex items-center gap-1 group">
          <div className="text-foreground font-mono text-[10px] pl-3 truncate flex-1" title={root}>
            {root}
          </div>
          <button
            onClick={() => handleRemove(i)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-0.5"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1 pl-3">
        <Input
          value={newRoot}
          onChange={(e) => setNewRoot(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="/mnt/nas/mac/Decor/NewFolder"
          className="h-6 text-[10px] font-mono flex-1"
        />
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleAdd} disabled={!newRoot.trim()}>
          <FolderPlus className="h-3 w-3" />
        </Button>
      </div>
      {hasChanges && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1 ml-3"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save Changes
        </Button>
      )}
    </div>
  );
};

const MAX_POINTS = 60;

/* ─── Single Agent Card ─── */
const AgentCard = ({ agent }: { agent: AgentStatus }) => {
  const [expanded, setExpanded] = useState(false);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [currentBps, setCurrentBps] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isOnline = agent.isOnline;
  const scanProgress = agent.metadata?.scan_progress;
  const isScanning = scanProgress?.status === "scanning" || scanProgress?.status === "processing";
  const scanRequested = agent.metadata?.scan_requested;
  const hasScanCapability = !!agent.metadata?.scan_roots;
  const ingestion = agent.metadata?.ingestion_progress;
  const isIngesting = ingestion && ingestion.total > 0 && ingestion.done < ingestion.total;
  const isRenderer = !hasScanCapability;
  const { data: renderStats } = useRenderStats(isRenderer ? agent.agent_name : undefined);

  const handleTriggerScan = async () => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("agent-api/trigger-scan", {
        body: { agent_key: agent.agent_key },
      });
      if (error) throw error;
      toast.success("Scan requested — agent will start within 15 seconds");
    } catch (err: any) {
      toast.error(`Failed to trigger scan: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    if (!agent.metadata?.transfer_history) return;
    const bpsValues = agent.metadata.transfer_history.map((p) => p.bytes_per_sec);
    setThroughputHistory(bpsValues);
    setCurrentBps(agent.metadata.transfer_current?.bytes_per_sec ?? 0);
  }, [agent.metadata?.transfer_history, agent.metadata?.transfer_current]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !expanded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (throughputHistory.length < 2) return;

    const maxVal = Math.max(...throughputHistory, 100);
    const step = w / (MAX_POINTS - 1);
    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue('--primary').trim().replace(/ /g, ', ');
    const borderColor = style.getPropertyValue('--border').trim().replace(/ /g, ', ');

    ctx.strokeStyle = `hsla(${borderColor}, 0.3)`;
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) {
      const y = h - (h * i) / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `hsla(${primary}, 0.3)`);
    gradient.addColorStop(1, `hsla(${primary}, 0.02)`);

    ctx.beginPath();
    const startX = w - (throughputHistory.length - 1) * step;
    ctx.moveTo(startX, h);
    throughputHistory.forEach((val, i) => {
      ctx.lineTo(startX + i * step, h - (val / maxVal) * (h - 4));
    });
    ctx.lineTo(startX + (throughputHistory.length - 1) * step, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = `hsl(${primary})`;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    throughputHistory.forEach((val, i) => {
      const x = startX + i * step;
      const y = h - (val / maxVal) * (h - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [throughputHistory, expanded]);

  const formatBandwidth = (bps: number) => {
    if (bps === 0) return "0 B/s";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`;
    return `${bps} B/s`;
  };

  // Determine agent "role" label
  const roleLabel = hasScanCapability ? "Scanner" : "Renderer";

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
      >
        {isOnline ? (
          <Wifi className="h-3 w-3 text-success shrink-0" />
        ) : (
          <WifiOff className="h-3 w-3 text-destructive shrink-0" />
        )}
        <div className="flex flex-col items-start min-w-0">
          <span className="font-medium text-foreground truncate">{agent.agent_name}</span>
          <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ml-auto shrink-0 ${isOnline ? "bg-success" : "bg-destructive"}`} />
        <span className={`text-[10px] shrink-0 ${isOnline ? "text-success" : "text-destructive"}`}>
          {isOnline ? "Online" : "Offline"}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Scan Controls — only for scanner agents */}
          {isOnline && hasScanCapability && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={handleTriggerScan}
                  disabled={triggering || isScanning || !!scanRequested}
                >
                  {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {isScanning ? "Scanning..." : scanRequested ? "Scan Queued" : "Trigger Scan"}
                </Button>
                {scanProgress && scanProgress.status !== "idle" && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {scanProgress.scanned_count.toLocaleString()} files scanned
                    {scanProgress.new_count > 0 && ` · ${scanProgress.new_count} new`}
                  </span>
                )}
              </div>

              {isScanning && (
                <div className="space-y-1">
                  <Progress value={undefined} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{scanProgress?.status === "scanning" ? "Scanning filesystem..." : "Processing new files..."}</span>
                    <span>{scanProgress?.scanned_count.toLocaleString()} files</span>
                  </div>
                </div>
              )}

              {scanProgress?.status === "idle" && scanProgress.updated_at && (
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>
                    Last scan: {formatDistanceToNow(new Date(scanProgress.updated_at), { addSuffix: true })}
                    {" · "}
                    {scanProgress.scanned_count.toLocaleString()} files checked
                    {scanProgress.new_count > 0
                      ? ` · ${scanProgress.new_count.toLocaleString()} new found`
                      : " · no new files"}
                  </div>
                  {agent.metadata?.scan_cycles_completed != null && agent.metadata.scan_cycles_completed > 0 && (
                    <div className="text-muted-foreground/70">
                      Lifetime: {agent.metadata.scan_cycles_completed} scan{agent.metadata.scan_cycles_completed > 1 ? "s" : ""}
                      {" · "}
                      {(agent.metadata.total_scanned_lifetime ?? 0).toLocaleString()} files checked
                      {" · "}
                      {(agent.metadata.total_new_lifetime ?? 0).toLocaleString()} new ingested
                    </div>
                  )}
                </div>
              )}

              {/* Ingestion Progress */}
              {isIngesting && ingestion && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="font-medium text-foreground">Ingesting files...</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                      {ingestion.done.toLocaleString()} / {ingestion.total.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={(ingestion.done / ingestion.total) * 100} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Processing thumbnails & uploading</span>
                    <span>{Math.round((ingestion.done / ingestion.total) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connection Details */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Last heartbeat:</span>
              <span className="text-foreground ml-auto">
                {agent.last_heartbeat
                  ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Hostname:</span>
              <span className="text-foreground ml-auto font-mono">
                {agent.metadata?.hostname ?? agent.agent_name}
              </span>
            </div>
            {agent.metadata?.scan_roots && (
              <ScanRootsEditor agent={agent} />
            )}
            {agent.metadata?.started_at && (
              <div className="flex items-center gap-2">
                <Server className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Uptime:</span>
                <span className="text-foreground ml-auto">
                  {formatDistanceToNow(new Date(agent.metadata.started_at))}
                </span>
              </div>
            )}
          </div>

          {/* Render Activity — only for renderer agents */}
          {isRenderer && renderStats && (
            <div className="space-y-2.5">
              {/* 24h Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-secondary/50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-foreground">{renderStats.last24h.completed}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="h-2.5 w-2.5 text-success" />
                    Done (24h)
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-foreground">{renderStats.last24h.failed}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <XCircle className="h-2.5 w-2.5 text-destructive" />
                    Failed (24h)
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-foreground">{renderStats.pending}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <Layers className="h-2.5 w-2.5" />
                    Queued
                  </div>
                </div>
              </div>

              {/* Avg duration */}
              {renderStats.last24h.completed > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Timer className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Avg render time:</span>
                  <span className="text-foreground ml-auto font-mono">
                    {renderStats.last24h.avgDurationSec < 60
                      ? `${renderStats.last24h.avgDurationSec.toFixed(1)}s`
                      : `${(renderStats.last24h.avgDurationSec / 60).toFixed(1)}m`}
                  </span>
                </div>
              )}

              {/* Currently processing */}
              {renderStats.currentJob && (
                <div className="bg-primary/10 border border-primary/20 rounded-md p-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="font-medium text-foreground">Rendering now</span>
                  </div>
                  <div className="text-[10px] font-mono text-foreground truncate" title={renderStats.currentJob.filename}>
                    {renderStats.currentJob.filename}
                  </div>
                  {renderStats.currentJob.claimed_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Started {formatDistanceToNow(new Date(renderStats.currentJob.claimed_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              )}

              {/* Recent jobs */}
              {renderStats.recentJobs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent renders
                  </span>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {renderStats.recentJobs.slice(0, 8).map((job) => {
                      const duration =
                        job.claimed_at && job.completed_at
                          ? (new Date(job.completed_at).getTime() - new Date(job.claimed_at).getTime()) / 1000
                          : null;
                      return (
                        <div
                          key={job.id}
                          className="flex items-center gap-1.5 text-[10px] py-0.5"
                          title={job.error_message ?? undefined}
                        >
                          {job.status === "completed" ? (
                            <CheckCircle className="h-2.5 w-2.5 text-success shrink-0" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5 text-destructive shrink-0" />
                          )}
                          <span className="truncate text-foreground font-mono min-w-0">{job.filename}</span>
                          {duration !== null && (
                            <span className="text-muted-foreground ml-auto shrink-0">
                              {duration < 60 ? `${duration.toFixed(0)}s` : `${(duration / 60).toFixed(1)}m`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!renderStats.currentJob && renderStats.recentJobs.length === 0 && renderStats.pending === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-2">
                  No render jobs yet. Queue .ai files to get started.
                </div>
              )}
            </div>
          )}
          {isOnline && throughputHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Upload Throughput</span>
                <span className="font-mono text-foreground">{formatBandwidth(currentBps)}</span>
              </div>
              <div className="bg-secondary/50 rounded-md p-1">
                <canvas ref={canvasRef} className="w-full h-16 rounded" style={{ display: "block" }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{throughputHistory.length}m ago</span>
                <span>now</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Main Panel ─── */
const NasConnectionPanel = () => {
  const { data: agents, isLoading } = useAllAgents();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3 w-3 animate-pulse" />
          <span>Checking agents...</span>
        </div>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="h-3 w-3" />
          <span>No agents registered</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agents ({agents.length})
        </span>
      </div>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
};

export default NasConnectionPanel;
