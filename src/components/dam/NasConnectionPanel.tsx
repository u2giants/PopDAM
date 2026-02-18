import { useState, useEffect, useRef } from "react";
import { Server, Wifi, WifiOff, Clock, HardDrive, ChevronDown, ChevronUp, Play, Loader2 } from "lucide-react";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_POINTS = 60;

const NasConnectionPanel = () => {
  const { data: agent, isLoading } = useAgentStatus();
  const [expanded, setExpanded] = useState(false);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [currentBps, setCurrentBps] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scanProgress = agent?.metadata?.scan_progress;
  const isScanning = scanProgress?.status === "scanning" || scanProgress?.status === "processing";
  const scanRequested = agent?.metadata?.scan_requested;

  const handleTriggerScan = async () => {
    if (!agent?.agent_key) return;
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-api/trigger-scan", {
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

  // Use real transfer data from agent heartbeats
  useEffect(() => {
    if (!agent?.metadata?.transfer_history) return;

    const history = agent.metadata.transfer_history;
    const bpsValues = history.map((p) => p.bytes_per_sec);
    setThroughputHistory(bpsValues);

    const current = agent.metadata.transfer_current;
    setCurrentBps(current?.bytes_per_sec ?? 0);
  }, [agent?.metadata?.transfer_history, agent?.metadata?.transfer_current]);

  // Draw chart
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
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `hsla(${primary}, 0.3)`);
    gradient.addColorStop(1, `hsla(${primary}, 0.02)`);

    ctx.beginPath();
    const startX = w - (throughputHistory.length - 1) * step;
    ctx.moveTo(startX, h);

    throughputHistory.forEach((val, i) => {
      const x = startX + i * step;
      const y = h - (val / maxVal) * (h - 4);
      ctx.lineTo(x, y);
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
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }, [throughputHistory, expanded]);

  const formatBandwidth = (bps: number) => {
    if (bps === 0) return "0 B/s";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`;
    return `${bps} B/s`;
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3 w-3 animate-pulse" />
          <span>Checking connection...</span>
        </div>
      </div>
    );
  }

  const isOnline = agent?.isOnline ?? false;
  const agentName = agent?.agent_name ?? "No agent registered";

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
      >
        {isOnline ? (
          <Wifi className="h-3 w-3 text-success" />
        ) : (
          <WifiOff className="h-3 w-3 text-destructive" />
        )}
        <span className="font-medium text-foreground">{agentName}</span>
        <span className="text-muted-foreground">via Tailscale</span>
        <span className={`w-2 h-2 rounded-full ml-auto ${isOnline ? "bg-success" : "bg-destructive"}`} />
        <span className={isOnline ? "text-success" : "text-destructive"}>
          {isOnline ? "Connected" : "Offline"}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Scan Controls */}
          {isOnline && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={handleTriggerScan}
                  disabled={triggering || isScanning || !!scanRequested}
                >
                  {isScanning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isScanning ? "Scanning..." : scanRequested ? "Scan Queued" : "Trigger Scan"}
                </Button>
                {scanProgress && scanProgress.status !== "idle" && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {scanProgress.scanned_count.toLocaleString()} files scanned
                    {scanProgress.new_count > 0 && ` · ${scanProgress.new_count} new`}
                  </span>
                )}
              </div>

              {/* Progress bar during active scan */}
              {isScanning && (
                <div className="space-y-1">
                  <Progress value={undefined} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{scanProgress?.status === "scanning" ? "Scanning filesystem..." : "Processing new files..."}</span>
                    <span>{scanProgress?.scanned_count.toLocaleString()} files</span>
                  </div>
                </div>
              )}

              {/* Last scan result when idle */}
              {scanProgress?.status === "idle" && scanProgress.updated_at && (
                <div className="text-[10px] text-muted-foreground">
                  Last scan: {formatDistanceToNow(new Date(scanProgress.updated_at), { addSuffix: true })}
                  {" · "}
                  {scanProgress.scanned_count.toLocaleString()} files checked
                  {scanProgress.new_count > 0
                    ? ` · ${scanProgress.new_count} new found`
                    : " · no new files"}
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
                {agent?.last_heartbeat
                  ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Hostname:</span>
              <span className="text-foreground ml-auto font-mono">
                {agent?.metadata?.hostname ?? agentName}
              </span>
            </div>
            {agent?.metadata?.scan_roots && (
              <div className="space-y-1">
                <span className="text-muted-foreground">Scan roots:</span>
                {agent.metadata.scan_roots.map((root, i) => (
                  <div key={i} className="text-foreground font-mono text-[10px] pl-5 truncate" title={root}>
                    {root}
                  </div>
                ))}
              </div>
            )}
            {agent?.metadata?.started_at && (
              <div className="flex items-center gap-2">
                <Server className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Uptime:</span>
                <span className="text-foreground ml-auto">
                  {formatDistanceToNow(new Date(agent.metadata.started_at))}
                </span>
              </div>
            )}
          </div>

          {/* Live Upload Throughput Chart */}
          {isOnline && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Upload Throughput</span>
                <span className="font-mono text-foreground">{formatBandwidth(currentBps)}</span>
              </div>
              {throughputHistory.length > 0 ? (
                <>
                  <div className="bg-secondary/50 rounded-md p-1">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-16 rounded"
                      style={{ display: "block" }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{throughputHistory.length}m ago</span>
                    <span>now</span>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground">
                  Waiting for transfer data from agent heartbeats...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NasConnectionPanel;
