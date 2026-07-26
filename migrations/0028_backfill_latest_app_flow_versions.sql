WITH latest_published AS (
  SELECT DISTINCT ON (av.app_id, av.platform)
    av.id AS version_id,
    av.app_id,
    av.platform
  FROM app_versions av
  WHERE av.status = 'published'
  ORDER BY av.app_id, av.platform, av.version_number DESC
)
INSERT INTO app_flow_versions (version_id, flows)
SELECT
  latest.version_id,
  COALESCE(af.flows, '[]'::jsonb)
FROM latest_published latest
LEFT JOIN app_flows af
  ON af.app_id = latest.app_id
  AND af.platform = latest.platform
LEFT JOIN app_flow_versions afv ON afv.version_id = latest.version_id
WHERE afv.version_id IS NULL
ON CONFLICT (version_id) DO NOTHING;
