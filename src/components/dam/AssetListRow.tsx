import { DbAsset } from "@/hooks/useAssets";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";

interface AssetListRowProps {
  asset: DbAsset;
  onClick: (asset: DbAsset) => void;
  isSelected: boolean;
  onSelect?: (asset: DbAsset, e: React.MouseEvent) => void;
  selectionMode: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  tagged: "bg-green-500/20 text-green-400",
  error: "bg-red-500/20 text-red-400",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const AssetListRow = ({ asset, onClick, isSelected, onSelect, selectionMode }: AssetListRowProps) => {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
        isSelected ? "bg-primary/10" : ""
      }`}
      onClick={() => onClick(asset)}
    >
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(asset, e as unknown as React.MouseEvent);
          }}
        />
      )}

      {/* Thumbnail */}
      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {asset.file_type.toUpperCase()}
          </div>
        )}
      </div>

      {/* Filename */}
      <span className="flex-1 text-sm truncate">{asset.filename}</span>

      {/* Status */}
      <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status] || ""}`}>
        {asset.status}
      </Badge>

      {/* File type */}
      <span className="text-xs text-muted-foreground uppercase w-8">{asset.file_type}</span>

      {/* Size */}
      <span className="text-xs text-muted-foreground w-16 text-right">{formatSize(asset.file_size)}</span>

      {/* Dimensions */}
      <span className="text-xs text-muted-foreground w-20 text-right">
        {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
      </span>

      {/* Modified */}
      <span className="text-xs text-muted-foreground w-24 text-right">
        {formatDistanceToNow(new Date(asset.modified_at), { addSuffix: true })}
      </span>
    </div>
  );
};

export default AssetListRow;
