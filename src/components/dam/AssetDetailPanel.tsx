import { useState } from "react";
import { DbAsset } from "@/hooks/useAssets";
import { X, Copy, FileType, Calendar, HardDrive, Tag, Sparkles, FolderOpen, RefreshCw, CloudCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePathDisplay, isSynologyConfigured } from "@/hooks/usePathDisplay";
import AssetOperationsPanel from "./AssetOperationsPanel";
import SynologyDriveSetupDialog from "./SynologyDriveSetupDialog";

interface AssetDetailPanelProps {
  asset: DbAsset | null;
  onClose: () => void;
  onTagSuccess?: (taggedAssetIds: string[]) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const placeholderColors = [
  "from-red-900/40 to-red-800/20",
  "from-blue-900/40 to-blue-800/20",
  "from-purple-900/40 to-purple-800/20",
  "from-green-900/40 to-green-800/20",
  "from-amber-900/40 to-amber-800/20",
];

const AssetDetailPanel = ({ asset, onClose, onTagSuccess }: AssetDetailPanelProps) => {
  const { toast } = useToast();
  const { hostMode, cycleHostMode, displayPath, modeLabel } = usePathDisplay();
  const [synologyDialogOpen, setSynologyDialogOpen] = useState(false);

  if (!asset) return null;

  const mappedPath = displayPath(asset.file_path);

  const copyPath = () => {
    navigator.clipboard.writeText(mappedPath);
    toast({ title: "Path copied", description: "File path copied to clipboard" });
  };

  const colorPlaceholder = asset.color_placeholder || placeholderColors[asset.id.charCodeAt(0) % placeholderColors.length];

  return (
    <div className="w-96 border-l border-border bg-surface-overlay h-full overflow-y-auto scrollbar-thin animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Asset Details</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview */}
      <div className={`aspect-[4/3] bg-gradient-to-br ${colorPlaceholder} flex items-center justify-center m-4 rounded-lg overflow-hidden`}>
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.filename} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
            <FileType className="h-12 w-12" />
            <span className="text-sm font-mono uppercase">.{asset.file_type}</span>
            <span className="text-xs">Preview unavailable</span>
            <span className="text-[10px] text-muted-foreground/40">Requires NAS agent connection</span>
          </div>
        )}
      </div>

      {/* Filename */}
      <div className="px-4 pb-3">
        <h3 className="text-sm font-semibold text-foreground break-all">{asset.filename}</h3>
      </div>

      {/* AI Description */}
      {asset.ai_description && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Description</span>
          </div>
          <p className="text-sm text-secondary-foreground leading-relaxed">{asset.ai_description}</p>
        </div>
      )}

      <Separator />

      {/* Tags */}
      {asset.tags && asset.tags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] bg-tag text-tag-foreground border-0 px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Operations */}
      <div className="p-4">
        <AssetOperationsPanel asset={asset} onTagSuccess={onTagSuccess} />
      </div>

      <Separator />

      {/* File Path */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {hostMode.startsWith("synology") ? "Local Path" : "Server Path"}
          </span>
        </div>
        <div className="bg-secondary rounded-md p-2 font-mono text-xs text-secondary-foreground break-all leading-relaxed">
          {mappedPath}
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={copyPath} className="text-xs gap-1.5 flex-1">
            <Copy className="h-3 w-3" /> Copy Path
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={cycleHostMode} className="text-xs gap-1.5 flex-1" title="Cycle path display mode">
            <RefreshCw className="h-3 w-3" /> {modeLabel()}
          </Button>
          {!isSynologyConfigured() && (
            <Button variant="outline" size="sm" onClick={() => setSynologyDialogOpen(true)} className="text-xs gap-1.5" title="Set up Synology Drive path">
              <CloudCog className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <SynologyDriveSetupDialog
        open={synologyDialogOpen}
        onOpenChange={setSynologyDialogOpen}
        onComplete={() => {}}
      />

      <Separator />

      {/* Metadata */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">File Info</span>
        </div>
        {[
          ["Type", asset.file_type === "psd" ? "Adobe Photoshop" : "Adobe Illustrator"],
          ["Size", formatFileSize(asset.file_size)],
          ["Dimensions", `${asset.width} × ${asset.height} px`],
          ["Artboards", String(asset.artboards)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs text-foreground font-mono">{value}</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Dates */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dates</span>
        </div>
        {[
          ["Created", formatDate(asset.created_at)],
          ["Modified", formatDate(asset.modified_at)],
          ["Ingested", formatDate(asset.ingested_at)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetDetailPanel;
