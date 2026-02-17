import { useState, useEffect } from "react";
import { DbAsset, useLicensors, useProperties, useCharacters, useProductSubtypes } from "@/hooks/useAssets";
import { useUpdateAsset, useUpdateAssetCharacters, useAiTag } from "@/hooks/useAssetMutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Tag, Pencil, X, Check, Loader2 } from "lucide-react";

interface AssetOperationsPanelProps {
  asset: DbAsset;
  onTagSuccess?: (taggedAssetIds: string[]) => void;
}

const AssetOperationsPanel = ({ asset, onTagSuccess }: AssetOperationsPanelProps) => {
  const updateAsset = useUpdateAsset();
  const updateChars = useUpdateAssetCharacters();
  const aiTag = useAiTag();

  const { data: licensors = [] } = useLicensors();
  const { data: properties = [] } = useProperties();
  const { data: characters = [] } = useCharacters();
  const { data: subtypes = [] } = useProductSubtypes();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    propertyId: asset.property_id || "",
    characterIds: asset.characters.map((c) => c.id),
    productSubtypeId: asset.product_subtype_id || "",
    assetType: asset.asset_type || "",
    artSource: asset.art_source || "",
    designRef: asset.design_ref || "",
    designStyle: asset.design_style || "",
    bigTheme: asset.big_theme || "",
    littleTheme: asset.little_theme || "",
    isLicensed: asset.is_licensed,
  });

  // Reset form when asset changes
  useEffect(() => {
    setForm({
      propertyId: asset.property_id || "",
      characterIds: asset.characters.map((c) => c.id),
      productSubtypeId: asset.product_subtype_id || "",
      assetType: asset.asset_type || "",
      artSource: asset.art_source || "",
      designRef: asset.design_ref || "",
      designStyle: asset.design_style || "",
      bigTheme: asset.big_theme || "",
      littleTheme: asset.little_theme || "",
      isLicensed: asset.is_licensed,
    });
    setEditing(false);
  }, [asset.id]);

  const filteredProperties = form.propertyId
    ? properties
    : properties;

  const filteredCharacters = form.propertyId
    ? characters.filter((c: any) => c.property_id === form.propertyId)
    : characters;

  const handleSave = async () => {
    const selectedProp = properties.find((p: any) => p.id === form.propertyId);

    await updateAsset.mutateAsync({
      assetId: asset.id,
      updates: {
        property_id: form.propertyId || null,
        licensor_id: selectedProp?.licensor_id || null,
        product_subtype_id: form.productSubtypeId || null,
        asset_type: form.assetType || null,
        art_source: form.artSource || null,
        design_ref: form.designRef || null,
        design_style: form.designStyle || null,
        big_theme: form.bigTheme || null,
        little_theme: form.littleTheme || null,
        is_licensed: form.isLicensed,
      },
    });

    await updateChars.mutateAsync({
      assetId: asset.id,
      characterIds: form.characterIds,
    });

    setEditing(false);
  };

  const toggleCharacter = (charId: string) => {
    setForm((prev) => ({
      ...prev,
      characterIds: prev.characterIds.includes(charId)
        ? prev.characterIds.filter((id) => id !== charId)
        : [...prev.characterIds, charId],
    }));
  };

  return (
    <div className="space-y-4">
      {/* AI Auto-Tag */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Auto-Tag</span>
        </div>
        <Button
          size="sm"
          onClick={() => aiTag.mutate([asset.id], { onSuccess: () => onTagSuccess?.([asset.id]) })}
          disabled={aiTag.isPending}
          className="w-full gap-2"
        >
          {aiTag.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {aiTag.isPending ? "Analyzing..." : "Run AI Tagging"}
        </Button>
      </div>

      <Separator />

      {/* Manual Tags & Metadata */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags & Metadata</span>
          </div>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-6 px-2 text-xs gap-1">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-6 w-6 p-0">
                <X className="h-3 w-3" />
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={updateAsset.isPending} className="h-6 px-2 text-xs gap-1">
                {updateAsset.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            {/* Property */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Property</label>
              <Select value={form.propertyId} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v, characterIds: [] }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredProperties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.licensor?.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Characters */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Characters</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {filteredCharacters.map((c: any) => (
                  <Badge
                    key={c.id}
                    className={`text-[10px] cursor-pointer transition-colors ${
                      form.characterIds.includes(c.id)
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                    onClick={() => toggleCharacter(c.id)}
                  >
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Product Subtype */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Product Subtype</label>
              <Select value={form.productSubtypeId} onValueChange={(v) => setForm((f) => ({ ...f, productSubtypeId: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subtype" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {subtypes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.product_type?.product_category?.name} › {s.product_type?.name} › {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Type */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Asset Type</label>
              <Select value={form.assetType} onValueChange={(v) => setForm((f) => ({ ...f, assetType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="art_piece">Art Piece</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Art Source */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Art Source</label>
              <Select value={form.artSource} onValueChange={(v) => setForm((f) => ({ ...f, artSource: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="straight_style_guide">Straight Style Guide</SelectItem>
                  <SelectItem value="style_guide_composition">Style Guide Composition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Licensed */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Licensed</label>
              <Button
                variant={form.isLicensed ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setForm((f) => ({ ...f, isLicensed: !f.isLicensed }))}
              >
                {form.isLicensed ? "Yes" : "No"}
              </Button>
            </div>

            {/* Text fields */}
            {[
              ["Design Ref", "designRef"],
              ["Design Style", "designStyle"],
              ["Big Theme", "bigTheme"],
              ["Little Theme", "littleTheme"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <Input
                  className="h-8 text-xs"
                  value={(form as any)[key] || ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {asset.property && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Property</span>
                <span className="text-xs text-foreground">{asset.property.name}</span>
              </div>
            )}
            {asset.characters.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-xs text-muted-foreground">Characters</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {asset.characters.map((c) => (
                    <Badge key={c.id} className="text-[10px] bg-accent/20 text-accent-foreground">{c.name}</Badge>
                  ))}
                </div>
              </div>
            )}
            {asset.product_subtype && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Product</span>
                <span className="text-xs text-foreground">{asset.product_subtype.name}</span>
              </div>
            )}
            {asset.asset_type && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Type</span>
                <span className="text-xs text-foreground">{asset.asset_type === "art_piece" ? "Art Piece" : "Product"}</span>
              </div>
            )}
            {!asset.property && asset.characters.length === 0 && !asset.product_subtype && !asset.asset_type && (
              <p className="text-xs text-muted-foreground italic">No tags yet. Use AI Auto-Tag or edit manually.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetOperationsPanel;
