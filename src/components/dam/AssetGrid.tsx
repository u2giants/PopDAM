import { Asset } from "@/types/dam";
import AssetCard from "./AssetCard";

interface AssetGridProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
}

const AssetGrid = ({ assets, onAssetClick }: AssetGridProps) => {
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
