import { DbAsset } from "@/hooks/useAssets";
import AssetCard from "./AssetCard";
import AssetListRow from "./AssetListRow";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetGridProps {
  assets: DbAsset[];
  onAssetClick: (asset: DbAsset) => void;
  isLoading?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (asset: DbAsset, e: React.MouseEvent) => void;
  selectionMode?: boolean;
  viewMode?: "grid" | "list";
}

const defaultSet = new Set<string>();

const AssetGrid = ({ assets, onAssetClick, isLoading, selectedIds = defaultSet, onSelect, selectionMode = false, viewMode = "grid" }: AssetGridProps) => {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/3] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">📭</div>
          <p className="text-muted-foreground text-sm">No assets match your filters</p>
        </div>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground font-medium bg-muted/30 sticky top-0">
          {selectionMode && <div className="w-4" />}
          <div className="w-10" />
          <span className="flex-1">Filename</span>
          <span className="w-16">Status</span>
          <span className="w-8">Type</span>
          <span className="w-16 text-right">Size</span>
          <span className="w-20 text-right">Dimensions</span>
          <span className="w-24 text-right">Modified</span>
        </div>
        {assets.map((asset) => (
          <AssetListRow
            key={asset.id}
            asset={asset}
            onClick={onAssetClick}
            isSelected={selectedIds.has(asset.id)}
            onSelect={onSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={onAssetClick}
            isSelected={selectedIds.has(asset.id)}
            onSelect={onSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    </div>
  );
};

export default AssetGrid;
