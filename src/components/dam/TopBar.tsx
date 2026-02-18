import { Search, SlidersHorizontal, LayoutGrid, List, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortField = "modified_at" | "filename" | "file_size" | "ingested_at";
export type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  modified_at: "Date Modified",
  filename: "Name",
  file_size: "Size",
  ingested_at: "Recently Added",
};

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  totalAssets: number;
  filteredCount: number;
  onToggleFilters: () => void;
  onSync: () => void;
  isSyncing?: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField, dir: SortDir) => void;
  activeFilterCount?: number;
  onClearAllFilters?: () => void;
}

const TopBar = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalAssets,
  filteredCount,
  onToggleFilters,
  onSync,
  isSyncing,
  sortField,
  sortDir,
  onSortChange,
  activeFilterCount = 0,
  onClearAllFilters,
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
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {activeFilterCount > 0 && onClearAllFilters && (
        <Button variant="ghost" size="sm" onClick={onClearAllFilters} className="gap-1 text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
          Clear filters
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            {SORT_LABELS[sortField]}
            {sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuRadioGroup
            value={sortField}
            onValueChange={(v) => onSortChange(v as SortField, sortDir)}
          >
            {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
              <DropdownMenuRadioItem key={f} value={f}>
                {SORT_LABELS[f]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sortDir}
            onValueChange={(v) => onSortChange(sortField, v as SortDir)}
          >
            <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={onSync} disabled={isSyncing}>
        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
        Sync
      </Button>
    </div>
  );
};

export default TopBar;
