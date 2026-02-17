import { useState, useEffect, useRef } from "react";
import { Server, Wifi, WifiOff, Clock, HardDrive, ChevronDown, ChevronUp } from "lucide-react";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { formatDistanceToNow } from "date-fns";

const MAX_POINTS = 60;

const NasConnectionPanel = () => {
  const { data: agent, isLoading } = useAgentStatus();
  const [expanded, setExpanded] = useState(false);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [currentKbps, setCurrentKbps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulate bandwidth monitoring (real implementation would need a metrics endpoint)
  useEffect(() => {
    if (!expanded || !agent?.isOnline) return;

    const interval = setInterval(() => {
      // Simulated throughput based on activity — in production this would come from agent metrics
      const base = agent.isOnline ? 12 + Math.random() * 45 : 0;
      const spike = Math.random() > 0.85 ? Math.random() * 200 : 0;
      const kbps = Math.round(base + spike);

      setCurrentKbps(kbps);
      setThroughputHistory((prev) => {
        const next = [...prev, kbps];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expanded, agent?.isOnline]);

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

    // Grid lines
    ctx.strokeStyle = "hsla(var(--border), 0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) {
      const y = h - (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Fill gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "hsla(var(--primary), 0.3)");
    gradient.addColorStop(1, "hsla(var(--primary), 0.02)");

    ctx.beginPath();
    const startX = w - (throughputHistory.length - 1) * step;
    ctx.moveTo(startX, h);

    throughputHistory.forEach((val, i) => {
      const x = startX + i * step;
      const y = h - (val / maxVal) * (h - 4);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.lineTo(startX + (throughputHistory.length - 1) * step, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = "hsl(var(--primary))";
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

  const formatBandwidth = (kbps: number) => {
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
    return `${kbps} Kbps`;
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
  const agentName = agent?.agent_name ?? "Unknown";

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

          {/* Live Bandwidth Chart */}
          {isOnline && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Throughput</span>
                <span className="font-mono text-foreground">{formatBandwidth(currentKbps)}</span>
              </div>
              <div className="bg-secondary/50 rounded-md p-1">
                <canvas
                  ref={canvasRef}
                  className="w-full h-16 rounded"
                  style={{ display: "block" }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>60s ago</span>
                <span>now</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NasConnectionPanel;
