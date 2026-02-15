import { Asset } from "@/types/dam";
import { FileType, Layers, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssetCardProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
};

const statusColors: Record<string, string> = {
  tagged: "bg-success/20 text-success",
  processing: "bg-primary/20 text-primary",
  pending: "bg-muted text-muted-foreground",
  error: "bg-destructive/20 text-destructive",
};

const AssetCard = ({ asset, onClick }: AssetCardProps) => {
  return (
    <button
      onClick={() => onClick(asset)}
      className="group relative bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-[var(--shadow-card)] transition-all duration-200 text-left w-full animate-fade-in"
    >
      {/* Thumbnail Area */}
      <div className={`aspect-[4/3] bg-gradient-to-br ${asset.colorPlaceholder} flex items-center justify-center relative overflow-hidden`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
          <FileType className="h-8 w-8" />
          <span className="text-xs font-mono uppercase">.{asset.fileType}</span>
        </div>

        {/* Status dot */}
        <div className="absolute top-2 right-2">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[asset.status]}`}>
            {asset.status}
          </span>
        </div>

        {/* Artboards badge */}
        {asset.artboards > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">{asset.artboards}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {asset.filename}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {asset.aiDescription}
        </p>
        <div className="flex flex-wrap gap-1">
          {asset.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px] bg-tag text-tag-foreground border-0 px-1.5 py-0">
              {tag.name}
            </Badge>
          ))}
          {asset.tags.length > 3 && (
            <Badge variant="secondary" className="text-[10px] bg-tag text-tag-foreground border-0 px-1.5 py-0">
              +{asset.tags.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1">
          <span>{formatFileSize(asset.fileSize)}</span>
          <span>{asset.width}×{asset.height}</span>
        </div>
      </div>
    </button>
  );
};

export default AssetCard;
