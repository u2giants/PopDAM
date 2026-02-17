
-- Assets table additions
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS thumbnail_error text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS workflow_status text;

-- Render queue for Windows agent
CREATE TABLE public.render_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  status text NOT NULL DEFAULT 'pending',
  claimed_by text,
  claimed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_render_queue_status ON public.render_queue(status);

-- RLS for render_queue (service-role access only via edge functions, anon can read)
ALTER TABLE public.render_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read render_queue" ON public.render_queue FOR SELECT USING (true);
CREATE POLICY "Allow anon insert render_queue" ON public.render_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update render_queue" ON public.render_queue FOR UPDATE USING (true);

-- Path history table
CREATE TABLE public.asset_path_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  old_path text NOT NULL,
  new_path text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_path_history_asset ON public.asset_path_history(asset_id);

-- RLS for asset_path_history
ALTER TABLE public.asset_path_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read asset_path_history" ON public.asset_path_history FOR SELECT USING (true);
CREATE POLICY "Allow anon insert asset_path_history" ON public.asset_path_history FOR INSERT WITH CHECK (true);
