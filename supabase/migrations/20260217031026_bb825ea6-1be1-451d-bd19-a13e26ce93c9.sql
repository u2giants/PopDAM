
-- Add filterable tags array and scene description to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS scene_description text;

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_assets_tags ON public.assets USING GIN(tags);
