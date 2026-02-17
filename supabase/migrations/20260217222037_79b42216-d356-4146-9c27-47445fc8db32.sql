
CREATE OR REPLACE FUNCTION public.get_filter_counts()
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'file_type', (
      SELECT coalesce(json_object_agg(file_type, cnt), '{}')
      FROM (SELECT file_type, count(*) AS cnt FROM assets GROUP BY file_type) t
    ),
    'workflow_status', (
      SELECT coalesce(json_object_agg(coalesce(workflow_status, 'none'), cnt), '{}')
      FROM (SELECT workflow_status, count(*) AS cnt FROM assets GROUP BY workflow_status) t
    ),
    'image_type', (
      SELECT coalesce(json_object_agg(tag_val, cnt), '{}')
      FROM (
        SELECT lower(unnest(tags)) AS tag_val, count(*) AS cnt
        FROM assets WHERE tags IS NOT NULL
        GROUP BY tag_val
      ) t
    ),
    'is_licensed', (
      SELECT json_build_object(
        'licensed', (SELECT count(*) FROM assets WHERE is_licensed = true),
        'generic', (SELECT count(*) FROM assets WHERE is_licensed = false)
      )
    )
  );
$$;
