import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileType } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import NasConnectionPanel from "@/components/dam/NasConnectionPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLicensors, useProperties } from "@/hooks/useAssets";
import { useStatusCounts } from "@/hooks/useStatusCounts";

interface FilterSidebarProps {
  selectedFileTypes: string[];
  onFileTypeToggle: (type: string) => void;
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  selectedImageTypes: string[];
  onImageTypeToggle: (type: string) => void;
  selectedLicensorIds: string[];
  onLicensorToggle: (id: string) => void;
  selectedPropertyIds: string[];
  onPropertyToggle: (id: string) => void;
  selectedWorkflowStatuses?: string[];
  onWorkflowStatusToggle?: (status: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
}

const FilterSidebar = ({
  selectedFileTypes,
  onFileTypeToggle,
  selectedStatuses,
  onStatusToggle,
  selectedImageTypes,
  onImageTypeToggle,
  selectedLicensorIds,
  onLicensorToggle,
  selectedPropertyIds,
  onPropertyToggle,
  selectedWorkflowStatuses = [],
  onWorkflowStatusToggle,
  onClearAll,
  isOpen,
}: FilterSidebarProps) => {
  const { data: licensors = [] } = useLicensors();
  const { data: properties = [] } = useProperties();
  const { data: statusCounts } = useStatusCounts();
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
    selectedFileTypes.length + selectedStatuses.length + selectedImageTypes.length + selectedLicensorIds.length + selectedPropertyIds.length + selectedWorkflowStatuses.length;

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
            { value: "preview_ready", label: "Preview Ready", color: "bg-primary" },
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
              <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors flex-1">
                {s.label}
              </span>
              {statusCounts && (
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {statusCounts[s.value as keyof typeof statusCounts] ?? 0}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Workflow Status */}
      {onWorkflowStatusToggle && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📂</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workflow</span>
          </div>
          <div className="space-y-2">
            {[
              { value: "in_process", label: "In Process", color: "bg-amber-500" },
              { value: "customer_adopted", label: "Customer Adopted", color: "bg-blue-500" },
              { value: "licensor_approved", label: "Licensor Approved", color: "bg-emerald-500" },
            ].map((s) => (
              <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={selectedWorkflowStatuses.includes(s.value)}
                  onCheckedChange={() => onWorkflowStatusToggle(s.value)}
                />
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors">
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Image Type */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">📷</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image Type</span>
        </div>
        <div className="space-y-2">
          {[
            { value: "amazon image", label: "Amazon Image" },
            { value: "professional photography", label: "Photography" },
            { value: "tech pack", label: "Tech Pack" },
            { value: "packaging", label: "Packaging" },
            { value: "design art", label: "Design Art" },
            { value: "lifestyle", label: "Lifestyle" },
          ].map((t) => (
            <label key={t.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={selectedImageTypes.includes(t.value)}
                onCheckedChange={() => onImageTypeToggle(t.value)}
              />
              <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors">
                {t.label}
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

      <NasConnectionPanel />
    </div>
  );
};

export default FilterSidebar;
