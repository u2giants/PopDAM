
CREATE OR REPLACE FUNCTION public.get_asset_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*) FROM public.assets;
$$;
