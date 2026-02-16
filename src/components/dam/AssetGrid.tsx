import { DbAsset } from "@/hooks/useAssets";
import AssetCard from "./AssetCard";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetGridProps {
  assets: DbAsset[];
  onAssetClick: (asset: DbAsset) => void;
  isLoading?: boolean;
}

const AssetGrid = ({ assets, onAssetClick, isLoading }: AssetGridProps) => {
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

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onClick={onAssetClick} />
        ))}
      </div>
    </div>
  );
};

export default AssetGrid;
