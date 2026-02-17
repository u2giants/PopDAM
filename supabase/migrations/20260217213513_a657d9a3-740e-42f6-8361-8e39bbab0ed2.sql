
-- Function to get counts by file_type
CREATE OR REPLACE FUNCTION public.get_filter_counts()
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'file_type', (
      SELECT json_object_agg(file_type, cnt)
      FROM (SELECT file_type, count(*)::int AS cnt FROM public.assets GROUP BY file_type) t
    ),
    'workflow_status', (
      SELECT json_object_agg(coalesce(workflow_status, 'none'), cnt)
      FROM (SELECT workflow_status, count(*)::int AS cnt FROM public.assets GROUP BY workflow_status) t
    ),
    'image_type', (
      SELECT json_object_agg(tag, cnt)
      FROM (
        SELECT lower(unnest(tags)) AS tag, count(*)::int AS cnt
        FROM public.assets
        WHERE tags IS NOT NULL
        GROUP BY lower(unnest(tags))
      ) t
    )
  );
$$;
