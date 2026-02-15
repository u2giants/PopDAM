import { useState, useMemo } from "react";
import { Asset } from "@/types/dam";
import { mockAssets, mockTags } from "@/data/mockData";
import AppHeader from "@/components/dam/AppHeader";
import TopBar from "@/components/dam/TopBar";
import FilterSidebar from "@/components/dam/FilterSidebar";
import AssetGrid from "@/components/dam/AssetGrid";
import AssetDetailPanel from "@/components/dam/AssetDetailPanel";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const filteredAssets = useMemo(() => {
    return mockAssets.filter((asset) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          asset.filename.toLowerCase().includes(q) ||
          asset.aiDescription.toLowerCase().includes(q) ||
          asset.tags.some((t) => t.name.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Tags
      if (selectedTags.length > 0) {
        if (!asset.tags.some((t) => selectedTags.includes(t.id))) return false;
      }

      // File type
      if (selectedFileTypes.length > 0) {
        if (!selectedFileTypes.includes(asset.fileType)) return false;
      }

      // Status
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(asset.status)) return false;
      }

      return true;
    });
  }, [searchQuery, selectedTags, selectedFileTypes, selectedStatuses]);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  const toggleFileType = (type: string) =>
    setSelectedFileTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  const toggleStatus = (status: string) =>
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  const clearAll = () => {
    setSelectedTags([]);
    setSelectedFileTypes([]);
    setSelectedStatuses([]);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalAssets={mockAssets.length}
        filteredCount={filteredAssets.length}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar
          tags={mockTags}
          selectedTags={selectedTags}
          onTagToggle={toggleTag}
          selectedFileTypes={selectedFileTypes}
          onFileTypeToggle={toggleFileType}
          selectedStatuses={selectedStatuses}
          onStatusToggle={toggleStatus}
          onClearAll={clearAll}
          isOpen={filtersOpen}
        />
        <AssetGrid assets={filteredAssets} onAssetClick={setSelectedAsset} />
        <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    </div>
  );
};

export default Index;
