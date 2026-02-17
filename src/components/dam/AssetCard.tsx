import { DbAsset } from "@/hooks/useAssets";
import { FileType, Layers, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssetCardProps {
  asset: DbAsset;
  onClick: (asset: DbAsset) => void;
  isSelected?: boolean;
  onSelect?: (asset: DbAsset, e: React.MouseEvent) => void;
  selectionMode?: boolean;
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

const workflowLabels: Record<string, { label: string; color: string }> = {
  in_process: { label: "In Process", color: "bg-amber-500/20 text-amber-400" },
  customer_adopted: { label: "Adopted", color: "bg-blue-500/20 text-blue-400" },
  licensor_approved: { label: "Approved", color: "bg-emerald-500/20 text-emerald-400" },
};

function getDisplayStatus(asset: { status: string; thumbnail_url: string | null }): { label: string; colorClass: string } {
  if (asset.status === "tagged") return { label: "tagged", colorClass: statusColors.tagged };
  if (asset.status === "error") return { label: "error", colorClass: statusColors.error };
  if (asset.thumbnail_url) return { label: "preview ready", colorClass: "bg-primary/20 text-primary" };
  if (asset.status === "processing") return { label: "processing", colorClass: statusColors.processing };
  return { label: "pending", colorClass: statusColors.pending };
}

const placeholderColors = [
  "from-red-900/40 to-red-800/20",
  "from-blue-900/40 to-blue-800/20",
  "from-purple-900/40 to-purple-800/20",
  "from-green-900/40 to-green-800/20",
  "from-amber-900/40 to-amber-800/20",
  "from-cyan-900/40 to-cyan-800/20",
  "from-pink-900/40 to-pink-800/20",
  "from-indigo-900/40 to-indigo-800/20",
];

function getPlaceholder(asset: DbAsset): string {
  if (asset.color_placeholder) return asset.color_placeholder;
  const idx = asset.id.charCodeAt(0) % placeholderColors.length;
  return placeholderColors[idx];
}

const AssetCard = ({ asset, onClick, isSelected, onSelect, selectionMode }: AssetCardProps) => {
  const colorPlaceholder = getPlaceholder(asset);
  const tags = [
    ...(asset.property ? [{ label: asset.property.name, type: "property" }] : []),
    ...(asset.characters ?? []).map((c) => ({ label: c.name, type: "character" })),
    ...(asset.product_subtype ? [{ label: asset.product_subtype.name, type: "product" }] : []),
    ...(asset.tags ?? []).map((t) => ({ label: t, type: "tag" })),
  ];

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onSelect?.(asset, e);
    } else {
      onClick(asset);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`group relative bg-card rounded-lg border overflow-hidden hover:border-primary/50 hover:shadow-[var(--shadow-card)] transition-all duration-200 text-left w-full animate-fade-in ${
        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {/* Selection checkbox */}
      {(selectionMode || isSelected) && (
        <div
          className={`absolute top-2 left-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/40"
          }`}
          onClick={(e) => { e.stopPropagation(); onSelect?.(asset, e); }}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
      )}

      {/* Thumbnail Area */}
      <div className={`aspect-[4/3] bg-gradient-to-br ${colorPlaceholder} flex items-center justify-center relative overflow-hidden`}>
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.filename} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
            <FileType className="h-8 w-8" />
            <span className="text-xs font-mono uppercase">.{asset.file_type}</span>
          </div>
        )}

        <div className="absolute top-2 right-2">
          {(() => {
            const ds = getDisplayStatus(asset);
            return (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ds.colorClass}`}>
                {ds.label}
              </span>
            );
          })()}
        </div>

        {asset.artboards > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">{asset.artboards}</span>
          </div>
        )}

        {(asset as any).workflow_status && workflowLabels[(asset as any).workflow_status] && (
          <div className="absolute top-2 left-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${workflowLabels[(asset as any).workflow_status].color}`}>
              {workflowLabels[(asset as any).workflow_status].label}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {asset.filename}
        </p>
        {asset.ai_description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {asset.ai_description}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] bg-tag text-tag-foreground border-0 px-1.5 py-0">
              {tag.label}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="secondary" className="text-[10px] bg-tag text-tag-foreground border-0 px-1.5 py-0">
              +{tags.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1">
          <span>{formatFileSize(asset.file_size)}</span>
          <span>{asset.width}×{asset.height}</span>
        </div>
      </div>
    </button>
  );
};

export default AssetCard;
