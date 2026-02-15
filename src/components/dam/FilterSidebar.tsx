import { useState } from "react";
import { AssetTag, TagCategory } from "@/types/dam";
import { ChevronDown, ChevronRight, X, Server, Clock, FileType } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface FilterSidebarProps {
  tags: AssetTag[];
  selectedTags: string[];
  onTagToggle: (tagId: string) => void;
  selectedFileTypes: string[];
  onFileTypeToggle: (type: string) => void;
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
}

const categoryLabels: Record<TagCategory, string> = {
  license: "License / IP",
  character: "Characters",
  product: "Product Type",
  scene: "Scene Type",
};

const categoryIcons: Record<TagCategory, string> = {
  license: "🏷️",
  character: "🦸",
  product: "📦",
  scene: "🎬",
};

const FilterSidebar = ({
  tags,
  selectedTags,
  onTagToggle,
  selectedFileTypes,
  onFileTypeToggle,
  selectedStatuses,
  onStatusToggle,
  onClearAll,
  isOpen,
}: FilterSidebarProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["license", "character", "product", "scene"])
  );

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const grouped = tags.reduce<Record<TagCategory, AssetTag[]>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<TagCategory, AssetTag[]>);

  const totalSelected = selectedTags.length + selectedFileTypes.length + selectedStatuses.length;

  return (
    <div className="w-64 border-r border-border bg-surface-overlay h-full overflow-y-auto scrollbar-thin animate-slide-in-right">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Filters</span>
        {totalSelected > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs text-primary h-auto py-1 px-2">
            Clear all ({totalSelected})
          </Button>
        )}
      </div>

      {/* File Type */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileType className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File Type</span>
        </div>
        <div className="space-y-2">
          {["psd", "ai"].map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={selectedFileTypes.includes(type)}
                onCheckedChange={() => onFileTypeToggle(type)}
              />
              <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors">
                .{type}
              </span>
              <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                {type === "psd" ? "Photoshop" : "Illustrator"}
              </Badge>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        </div>
        <div className="space-y-2">
          {[
            { value: "tagged", label: "Tagged", color: "bg-success" },
            { value: "processing", label: "Processing", color: "bg-primary" },
            { value: "pending", label: "Pending", color: "bg-muted-foreground" },
            { value: "error", label: "Error", color: "bg-destructive" },
          ].map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={selectedStatuses.includes(s.value)}
                onCheckedChange={() => onStatusToggle(s.value)}
              />
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Tag Categories */}
      {(Object.entries(grouped) as [TagCategory, AssetTag[]][]).map(([category, catTags]) => (
        <div key={category} className="border-b border-border">
          <button
            onClick={() => toggleCategory(category)}
            className="w-full flex items-center gap-2 p-4 hover:bg-secondary/50 transition-colors"
          >
            <span className="text-sm">{categoryIcons[category]}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
              {categoryLabels[category]}
            </span>
            {expandedCategories.has(category) ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          {expandedCategories.has(category) && (
            <div className="px-4 pb-4 space-y-2">
              {catTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => onTagToggle(tag.id)}
                  />
                  <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors flex-1">
                    {tag.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{tag.count}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* NAS Status */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3 w-3" />
          <span>NAS01 via Tailscale</span>
          <span className="w-2 h-2 rounded-full bg-success ml-auto" />
          <span className="text-success">Connected</span>
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
