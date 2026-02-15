export interface AssetTag {
  id: string;
  name: string;
  category: "license" | "character" | "product" | "scene";
  count: number;
}

export interface Asset {
  id: string;
  filename: string;
  filePath: string;
  fileType: "psd" | "ai";
  fileSize: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  previewUrl: string;
  colorPlaceholder: string;
  tags: AssetTag[];
  aiDescription: string;
  createdAt: string;
  modifiedAt: string;
  ingestedAt: string;
  artboards: number;
  status: "pending" | "processing" | "tagged" | "error";
}

export type TagCategory = AssetTag["category"];
export type AssetStatus = Asset["status"];
export type FileType = Asset["fileType"];
