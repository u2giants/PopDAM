import { Asset } from "@/types/dam";
import { X, ExternalLink, Copy, FileType, Calendar, HardDrive, Layers, Tag, Sparkles, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface AssetDetailPanelProps {
  asset: Asset | null;
  onClose: () => void;
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

const categoryColors: Record<string, string> = {
  license: "bg-info/20 text-info",
  character: "bg-primary/20 text-primary",
  product: "bg-success/20 text-success",
  scene: "bg-accent/20 text-accent-foreground",
};

const AssetDetailPanel = ({ asset, onClose }: AssetDetailPanelProps) => {
  const { toast } = useToast();

  if (!asset) return null;

  const copyPath = () => {
    navigator.clipboard.writeText(asset.filePath);
    toast({ title: "Path copied", description: "File path copied to clipboard" });
  };

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
      <div className={`aspect-[4/3] bg-gradient-to-br ${asset.colorPlaceholder} flex items-center justify-center m-4 rounded-lg`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
          <FileType className="h-12 w-12" />
          <span className="text-sm font-mono uppercase">.{asset.fileType}</span>
          <span className="text-xs">Preview unavailable</span>
          <span className="text-[10px] text-muted-foreground/40">Requires NAS agent connection</span>
        </div>
      </div>

      {/* Filename */}
      <div className="px-4 pb-3">
        <h3 className="text-sm font-semibold text-foreground break-all">{asset.filename}</h3>
      </div>

      {/* AI Description */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Description</span>
        </div>
        <p className="text-sm text-secondary-foreground leading-relaxed">{asset.aiDescription}</p>
      </div>

      <Separator />

      {/* File Path */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Server Path</span>
        </div>
        <div className="bg-secondary rounded-md p-2 font-mono text-xs text-secondary-foreground break-all leading-relaxed">
          {asset.filePath}
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={copyPath} className="text-xs gap-1.5 flex-1">
            <Copy className="h-3 w-3" />
            Copy Path
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 flex-1">
            <ExternalLink className="h-3 w-3" />
            Open in Explorer
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {asset.tags.map((tag) => (
            <Badge
              key={tag.id}
              className={`text-xs border-0 ${categoryColors[tag.category] || "bg-tag text-tag-foreground"}`}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Metadata */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">File Info</span>
        </div>
        {[
          ["Type", asset.fileType === "psd" ? "Adobe Photoshop" : "Adobe Illustrator"],
          ["Size", formatFileSize(asset.fileSize)],
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
          ["Created", formatDate(asset.createdAt)],
          ["Modified", formatDate(asset.modifiedAt)],
          ["Ingested", formatDate(asset.ingestedAt)],
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
