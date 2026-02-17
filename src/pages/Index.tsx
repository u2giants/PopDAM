import { useState, useMemo, useCallback, useRef } from "react";
import { useAssets, DbAsset } from "@/hooks/useAssets";
import { useAssetCount } from "@/hooks/useAssetCount";
import { useQueryClient } from "@tanstack/react-query";
import AppHeader from "@/components/dam/AppHeader";
import TopBar from "@/components/dam/TopBar";
import FilterSidebar from "@/components/dam/FilterSidebar";
import AssetGrid from "@/components/dam/AssetGrid";
import AssetDetailPanel from "@/components/dam/AssetDetailPanel";
import BulkActionBar from "@/components/dam/BulkActionBar";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets = [], isLoading, isFetching } = useAssets();
  const { data: totalAssetCount } = useAssetCount();

  const handleSync = () => {
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["asset-count"] });
    queryClient.invalidateQueries({ queryKey: ["status-counts"] });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [selectedAssetId, assets]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [selectedLicensorIds, setSelectedLicensorIds] = useState<string[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);

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
      if (selectedStatuses.length > 0) {
        const hasPreviewReady = selectedStatuses.includes("preview_ready");
        const dbStatuses = selectedStatuses.filter((s) => s !== "preview_ready");
        const matchesDbStatus = dbStatuses.length > 0 && dbStatuses.includes(asset.status);
        const matchesPreviewReady = hasPreviewReady && asset.thumbnail_url != null && asset.status === "pending";
        if (!matchesDbStatus && !matchesPreviewReady) return false;
      }
      if (selectedImageTypes.length > 0) {
        const assetTags = (asset.tags || []).map((t) => t.toLowerCase());
        if (!selectedImageTypes.some((it) => assetTags.includes(it))) return false;
      }
      if (selectedLicensorIds.length > 0) {
        if (!asset.property?.licensor?.id || !selectedLicensorIds.includes(asset.property.licensor.id)) return false;
      }
      if (selectedPropertyIds.length > 0) {
        if (!asset.property?.id || !selectedPropertyIds.includes(asset.property.id)) return false;
      }

      return true;
    });
  }, [assets, searchQuery, selectedFileTypes, selectedStatuses, selectedImageTypes, selectedLicensorIds, selectedPropertyIds]);

  const toggleInList = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (val: string) =>
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  const clearAll = () => {
    setSelectedFileTypes([]);
    setSelectedStatuses([]);
    setSelectedImageTypes([]);
    setSelectedLicensorIds([]);
    setSelectedPropertyIds([]);
  };

  const handleSelect = useCallback((asset: DbAsset, e: React.MouseEvent) => {
    const currentIndex = filteredAssets.findIndex((a) => a.id === asset.id);

    if (e.shiftKey && lastSelectedIndex.current !== null) {
      // Shift+click: select range
      const start = Math.min(lastSelectedIndex.current, currentIndex);
      const end = Math.max(lastSelectedIndex.current, currentIndex);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(filteredAssets[i].id);
        }
        return next;
      });
    } else {
      // Ctrl/Cmd+click or plain click: toggle individual
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(asset.id)) {
          next.delete(asset.id);
        } else {
          next.add(asset.id);
        }
        return next;
      });
    }
    lastSelectedIndex.current = currentIndex;
  }, [filteredAssets]);

  // After AI tagging, switch filter to "tagged" and highlight the asset
  const handleTagSuccess = useCallback((taggedAssetIds: string[]) => {
    setSelectedStatuses(["tagged"]);
    if (taggedAssetIds.length === 1) {
      setSelectedAssetId(taggedAssetIds[0]);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalAssets={totalAssetCount ?? assets.length}
        filteredCount={filteredAssets.length}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        onSync={handleSync}
        isSyncing={isFetching}
      />
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar
          selectedFileTypes={selectedFileTypes}
          onFileTypeToggle={toggleInList(setSelectedFileTypes)}
          selectedStatuses={selectedStatuses}
          onStatusToggle={toggleInList(setSelectedStatuses)}
          selectedImageTypes={selectedImageTypes}
          onImageTypeToggle={toggleInList(setSelectedImageTypes)}
          selectedLicensorIds={selectedLicensorIds}
          onLicensorToggle={toggleInList(setSelectedLicensorIds)}
          selectedPropertyIds={selectedPropertyIds}
          onPropertyToggle={toggleInList(setSelectedPropertyIds)}
          onClearAll={clearAll}
          isOpen={filtersOpen}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AssetGrid
            assets={filteredAssets}
            onAssetClick={(a) => setSelectedAssetId(a.id)}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            selectionMode={selectedIds.size > 0}
          />
          <BulkActionBar
            selectedIds={Array.from(selectedIds)}
            onClearSelection={() => setSelectedIds(new Set())}
            totalCount={filteredAssets.length}
            onTagSuccess={handleTagSuccess}
          />
        </div>
        <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAssetId(null)} onTagSuccess={handleTagSuccess} />
      </div>
    </div>
  );
};

export default Index;
