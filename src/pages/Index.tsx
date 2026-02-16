import { useState, useMemo } from "react";
import { useAssets, DbAsset } from "@/hooks/useAssets";
import AppHeader from "@/components/dam/AppHeader";
import TopBar from "@/components/dam/TopBar";
import FilterSidebar from "@/components/dam/FilterSidebar";
import AssetGrid from "@/components/dam/AssetGrid";
import AssetDetailPanel from "@/components/dam/AssetDetailPanel";

const Index = () => {
  const { data: assets = [], isLoading } = useAssets();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<DbAsset | null>(null);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLicensorIds, setSelectedLicensorIds] = useState<string[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          asset.filename.toLowerCase().includes(q) ||
          (asset.ai_description || "").toLowerCase().includes(q) ||
          asset.characters.some((c) => c.name.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (selectedFileTypes.length > 0 && !selectedFileTypes.includes(asset.file_type)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(asset.status)) return false;
      if (selectedLicensorIds.length > 0) {
        if (!asset.property?.licensor?.id || !selectedLicensorIds.includes(asset.property.licensor.id)) return false;
      }
      if (selectedPropertyIds.length > 0) {
        if (!asset.property?.id || !selectedPropertyIds.includes(asset.property.id)) return false;
      }

      return true;
    });
  }, [assets, searchQuery, selectedFileTypes, selectedStatuses, selectedLicensorIds, selectedPropertyIds]);

  const toggleInList = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (val: string) =>
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  const clearAll = () => {
    setSelectedFileTypes([]);
    setSelectedStatuses([]);
    setSelectedLicensorIds([]);
    setSelectedPropertyIds([]);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalAssets={assets.length}
        filteredCount={filteredAssets.length}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar
          selectedFileTypes={selectedFileTypes}
          onFileTypeToggle={toggleInList(setSelectedFileTypes)}
          selectedStatuses={selectedStatuses}
          onStatusToggle={toggleInList(setSelectedStatuses)}
          selectedLicensorIds={selectedLicensorIds}
          onLicensorToggle={toggleInList(setSelectedLicensorIds)}
          selectedPropertyIds={selectedPropertyIds}
          onPropertyToggle={toggleInList(setSelectedPropertyIds)}
          onClearAll={clearAll}
          isOpen={filtersOpen}
        />
        <AssetGrid assets={filteredAssets} onAssetClick={setSelectedAsset} isLoading={isLoading} />
        <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    </div>
  );
};

export default Index;
