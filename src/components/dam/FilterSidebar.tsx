import { useState } from "react";
import { ChevronDown, ChevronRight, Server, Clock, FileType } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLicensors, useProperties } from "@/hooks/useAssets";

interface FilterSidebarProps {
  selectedFileTypes: string[];
  onFileTypeToggle: (type: string) => void;
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  selectedLicensorIds: string[];
  onLicensorToggle: (id: string) => void;
  selectedPropertyIds: string[];
  onPropertyToggle: (id: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
}

const FilterSidebar = ({
  selectedFileTypes,
  onFileTypeToggle,
  selectedStatuses,
  onStatusToggle,
  selectedLicensorIds,
  onLicensorToggle,
  selectedPropertyIds,
  onPropertyToggle,
  onClearAll,
  isOpen,
}: FilterSidebarProps) => {
  const { data: licensors = [] } = useLicensors();
  const { data: properties = [] } = useProperties();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["fileType", "status", "licensors", "properties"])
  );

  if (!isOpen) return null;

  const toggleSection = (s: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const totalSelected =
    selectedFileTypes.length + selectedStatuses.length + selectedLicensorIds.length + selectedPropertyIds.length;

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

      {/* Licensors */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection("licensors")}
          className="w-full flex items-center gap-2 p-4 hover:bg-secondary/50 transition-colors"
        >
          <span className="text-sm">🏷️</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
            Licensors
          </span>
          {expandedSections.has("licensors") ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        {expandedSections.has("licensors") && (
          <div className="px-4 pb-4 space-y-2">
            {licensors.length === 0 ? (
              <span className="text-xs text-muted-foreground">No licensors yet</span>
            ) : (
              licensors.map((l) => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedLicensorIds.includes(l.id)}
                    onCheckedChange={() => onLicensorToggle(l.id)}
                  />
                  <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors flex-1">
                    {l.name}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Properties */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection("properties")}
          className="w-full flex items-center gap-2 p-4 hover:bg-secondary/50 transition-colors"
        >
          <span className="text-sm">🎬</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
            Properties
          </span>
          {expandedSections.has("properties") ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        {expandedSections.has("properties") && (
          <div className="px-4 pb-4 space-y-2">
            {properties.length === 0 ? (
              <span className="text-xs text-muted-foreground">No properties yet</span>
            ) : (
              properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedPropertyIds.includes(p.id)}
                    onCheckedChange={() => onPropertyToggle(p.id)}
                  />
                  <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors flex-1">
                    {p.name}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

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
