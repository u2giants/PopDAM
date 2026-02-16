
-- ============================================
-- LOOKUP TABLES (synced from external system)
-- ============================================

CREATE TABLE public.licensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licensor_id uuid NOT NULL REFERENCES public.licensors(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.product_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- USER PROFILES
-- ============================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ASSETS
-- ============================================

CREATE TYPE public.asset_type AS ENUM ('art_piece', 'product');
CREATE TYPE public.art_source AS ENUM ('freelancer', 'straight_style_guide', 'style_guide_composition');
CREATE TYPE public.asset_status AS ENUM ('pending', 'processing', 'tagged', 'error');
CREATE TYPE public.file_type AS ENUM ('psd', 'ai');

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_path text NOT NULL,
  file_type public.file_type NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  width int NOT NULL DEFAULT 0,
  height int NOT NULL DEFAULT 0,
  thumbnail_url text,
  color_placeholder text,
  artboards int NOT NULL DEFAULT 1,

  -- Classification
  is_licensed boolean NOT NULL DEFAULT false,
  licensor_id uuid REFERENCES public.licensors(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  product_subtype_id uuid REFERENCES public.product_subtypes(id) ON DELETE SET NULL,
  asset_type public.asset_type,
  art_source public.art_source,

  -- Generic asset fields
  big_theme text,
  little_theme text,

  -- External system references
  design_ref text,
  design_style text,

  -- AI
  ai_description text,

  -- Status & timestamps
  status public.asset_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_licensor ON public.assets(licensor_id);
CREATE INDEX idx_assets_property ON public.assets(property_id);
CREATE INDEX idx_assets_product_subtype ON public.assets(product_subtype_id);
CREATE INDEX idx_assets_is_licensed ON public.assets(is_licensed);

-- Junction table: assets ↔ characters (many-to-many)
CREATE TABLE public.asset_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  UNIQUE(asset_id, character_id)
);

CREATE INDEX idx_asset_characters_asset ON public.asset_characters(asset_id);
CREATE INDEX idx_asset_characters_character ON public.asset_characters(character_id);

-- ============================================
-- AGENT REGISTRATIONS & PROCESSING QUEUE
-- ============================================

CREATE TABLE public.agent_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  agent_key text NOT NULL UNIQUE,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.queue_status AS ENUM ('pending', 'claimed', 'processing', 'completed', 'failed');

CREATE TABLE public.processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agent_registrations(id) ON DELETE SET NULL,
  status public.queue_status NOT NULL DEFAULT 'pending',
  job_type text NOT NULL DEFAULT 'thumbnail',
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_status ON public.processing_queue(status);
CREATE INDEX idx_queue_agent ON public.processing_queue(agent_id);

-- Atomic job claim function
CREATE OR REPLACE FUNCTION public.claim_jobs(p_agent_id uuid, p_batch_size int DEFAULT 5)
RETURNS SETOF public.processing_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.processing_queue
  SET status = 'claimed',
      agent_id = p_agent_id,
      claimed_at = now()
  WHERE id IN (
    SELECT pq.id FROM public.processing_queue pq
    WHERE pq.status = 'pending'
    ORDER BY pq.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  RETURNING *;
END;
$$;

-- Reset stale claimed jobs (heartbeat timeout)
CREATE OR REPLACE FUNCTION public.reset_stale_jobs(p_timeout_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  UPDATE public.processing_queue
  SET status = 'pending',
      agent_id = NULL,
      claimed_at = NULL
  WHERE status IN ('claimed', 'processing')
    AND claimed_at < now() - (p_timeout_minutes || ' minutes')::interval;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_licensors_updated_at BEFORE UPDATE ON public.licensors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_types_updated_at BEFORE UPDATE ON public.product_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_subtypes_updated_at BEFORE UPDATE ON public.product_subtypes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
-- Agents use service_role key (bypasses RLS).
-- Authenticated users get read access to assets & lookups,
-- and can manage their own profile.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subtypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Assets: all authenticated can read
CREATE POLICY "Authenticated users can read assets" ON public.assets FOR SELECT TO authenticated USING (true);

-- Asset characters: all authenticated can read
CREATE POLICY "Authenticated users can read asset_characters" ON public.asset_characters FOR SELECT TO authenticated USING (true);

-- Lookup tables: all authenticated can read
CREATE POLICY "Read licensors" ON public.licensors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read characters" ON public.characters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read product_categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read product_types" ON public.product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read product_subtypes" ON public.product_subtypes FOR SELECT TO authenticated USING (true);

-- Agent tables: no user access (agents use service_role which bypasses RLS)
-- No policies = deny all for authenticated users
