-- Auto-queue .ai files for Windows rendering when thumbnail generation fails
-- or when a new .ai file is inserted without a thumbnail

CREATE OR REPLACE FUNCTION public.auto_queue_render()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for .ai files
  IF NEW.file_type != 'ai' THEN
    RETURN NEW;
  END IF;

  -- Queue when: thumbnail_error is set (Linux render failed)
  -- OR when inserted with no thumbnail
  IF (
    (TG_OP = 'UPDATE' AND NEW.thumbnail_error IS NOT NULL AND NEW.thumbnail_error != '' 
     AND (OLD.thumbnail_error IS NULL OR OLD.thumbnail_error = ''))
    OR
    (TG_OP = 'INSERT' AND NEW.thumbnail_url IS NULL)
  ) THEN
    -- Don't double-queue: check if already pending/claimed
    IF NOT EXISTS (
      SELECT 1 FROM public.render_queue 
      WHERE asset_id = NEW.id 
      AND status IN ('pending', 'claimed')
    ) THEN
      INSERT INTO public.render_queue (asset_id, status)
      VALUES (NEW.id, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on both INSERT and UPDATE
CREATE TRIGGER trg_auto_queue_render
  AFTER INSERT OR UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_queue_render();
