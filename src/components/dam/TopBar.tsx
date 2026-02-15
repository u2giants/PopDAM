import { Search, SlidersHorizontal, LayoutGrid, List, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  totalAssets: number;
  filteredCount: number;
  onToggleFilters: () => void;
}

const TopBar = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalAssets,
  filteredCount,
  onToggleFilters,
}: TopBarProps) => {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by filename, tag, description..."
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <Button variant="outline" size="sm" onClick={onToggleFilters} className="gap-2">
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </Button>

      <div className="flex items-center border border-border rounded-md">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("grid")}
          className="rounded-r-none"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("list")}
          className="rounded-l-none"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      <Badge variant="outline" className="text-muted-foreground font-mono text-xs">
        {filteredCount === totalAssets
          ? `${totalAssets} assets`
          : `${filteredCount} / ${totalAssets}`}
      </Badge>

      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
        <RefreshCw className="h-4 w-4" />
        Sync
      </Button>
    </div>
  );
};

export default TopBar;
