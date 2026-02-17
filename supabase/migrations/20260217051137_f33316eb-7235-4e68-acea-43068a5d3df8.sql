-- Add filesystem creation date column (distinct from DB created_at)
ALTER TABLE public.assets
ADD COLUMN file_created_at TIMESTAMP WITH TIME ZONE;

-- Comment for clarity
COMMENT ON COLUMN public.assets.file_created_at IS 'Filesystem creation date (birthtime) from the NAS, NOT the database insertion date';
COMMENT ON COLUMN public.assets.created_at IS 'Database row creation timestamp (when the asset was ingested into this system)';
COMMENT ON COLUMN public.assets.modified_at IS 'Filesystem last-modified date from the NAS';