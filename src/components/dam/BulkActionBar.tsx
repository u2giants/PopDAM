import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2 } from "lucide-react";
import { useAiTag } from "@/hooks/useAssetMutations";

interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  totalCount: number;
  onTagSuccess?: (taggedAssetIds: string[]) => void;
}

const BulkActionBar = ({ selectedIds, onClearSelection, totalCount, onTagSuccess }: BulkActionBarProps) => {
  const aiTag = useAiTag();

  if (selectedIds.length === 0) return null;

  return (
    <div className="bg-primary/10 border-t border-primary/30 px-6 py-3 flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {selectedIds.length} of {totalCount} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-xs gap-1">
          <X className="h-3 w-3" /> Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => aiTag.mutate(selectedIds, { onSuccess: () => onTagSuccess?.(selectedIds) })}
          disabled={aiTag.isPending}
          className="gap-2"
        >
          {aiTag.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {aiTag.isPending ? `Tagging ${selectedIds.length}...` : `AI Tag ${selectedIds.length} Assets`}
        </Button>
      </div>
    </div>
  );
};

export default BulkActionBar;
