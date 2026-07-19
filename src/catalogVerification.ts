import type pg from "pg";
import {
  planCatalogRepair,
  type CatalogArtifactCounts,
  type CatalogRepairPhases,
} from "./progress.ts";

export interface CatalogPersistenceSnapshot {
  app: string;
  platform: string;
  screens: number;
  uiElements: number;
  flows: number;
  invalidFlowReferences: number;
  missingScreenObjects: number;
  missingUiElementObjects: number;
  missingFlowObjects: number;
}

interface CatalogPersistenceRow {
  app: string;
  platform: string;
  screens: number | string;
  ui_elements: number | string;
  flows: number | string;
  invalid_flow_references: number | string;
  missing_screen_objects: number | string;
  missing_ui_element_objects: number | string;
  missing_flow_objects: number | string;
}

export function catalogJobKey(app: string, platform: string): string {
  return `${app}\u0000${platform}`;
}

export function emptyCatalogPersistence(app: string, platform: string): CatalogPersistenceSnapshot {
  return {
    app,
    platform,
    screens: 0,
    uiElements: 0,
    flows: 0,
    invalidFlowReferences: 0,
    missingScreenObjects: 0,
    missingUiElementObjects: 0,
    missingFlowObjects: 0,
  };
}

export function catalogPersistenceRepair(
  expected: CatalogArtifactCounts,
  persisted: CatalogPersistenceSnapshot,
): CatalogRepairPhases {
  const counts = planCatalogRepair({
    expected,
    persisted: {
      screens: persisted.screens,
      uiElements: persisted.uiElements,
      flows: persisted.flows,
    },
    invalidFlowReferences: persisted.invalidFlowReferences,
  });
  return {
    screens: counts.screens || persisted.missingScreenObjects > 0,
    uiElements: counts.uiElements || persisted.missingUiElementObjects > 0,
    flows: counts.flows || persisted.missingFlowObjects > 0,
  };
}

export async function loadCatalogPersistence(
  pool: Pick<pg.Pool, "query">,
  jobs: Array<{ app: string; platform: string }>,
): Promise<Map<string, CatalogPersistenceSnapshot>> {
  const result = await pool.query<CatalogPersistenceRow>(`
    WITH wanted AS (
      SELECT DISTINCT app, platform
      FROM jsonb_to_recordset($1::jsonb) AS x(app text, platform text)
    ), image_counts AS (
      SELECT wanted.app, wanted.platform,
             count(*) FILTER (WHERE i.kind = 'screen')::int AS screens,
             count(*) FILTER (WHERE i.kind = 'ui_element')::int AS ui_elements,
             count(*) FILTER (WHERE i.kind = 'screen' AND so.object_key IS NULL)::int AS missing_screen_objects,
             count(*) FILTER (WHERE i.kind = 'ui_element' AND so.object_key IS NULL)::int AS missing_ui_element_objects
      FROM wanted
      LEFT JOIN apps a ON a.name = wanted.app
      LEFT JOIN platforms p ON p.app_id = a.id AND p.name = wanted.platform
      LEFT JOIN images i ON i.platform_id = p.id
      LEFT JOIN stored_objects so ON so.object_key = i.object_key
      GROUP BY wanted.app, wanted.platform
    ), flow_counts AS (
      SELECT wanted.app, wanted.platform,
             COALESCE(jsonb_array_length(af.flows), 0)::int AS flows
      FROM wanted
      LEFT JOIN apps a ON a.name = wanted.app
      LEFT JOIN app_flows af ON af.app_id = a.id AND af.platform = wanted.platform
    ), evidence_counts AS (
      SELECT wanted.app, wanted.platform,
             count(*) FILTER (
               WHERE e IS NOT NULL
                 AND (i.id IS NULL OR evidence_platform.app_id <> a.id OR evidence_platform.name <> wanted.platform)
             )::int AS invalid_flow_references,
             count(*) FILTER (
               WHERE e IS NOT NULL AND i.id IS NOT NULL AND so.object_key IS NULL
             )::int AS missing_flow_objects
      FROM wanted
      LEFT JOIN apps a ON a.name = wanted.app
      LEFT JOIN app_flows af ON af.app_id = a.id AND af.platform = wanted.platform
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(af.flows, '[]'::jsonb)) f ON true
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(f->'steps', '[]'::jsonb)) s ON true
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(s->'evidence', '[]'::jsonb)) e ON true
      LEFT JOIN images i ON i.id = CASE WHEN e IS NULL THEN NULL ELSE (e #>> '{}')::bigint END
      LEFT JOIN platforms evidence_platform ON evidence_platform.id = i.platform_id
      LEFT JOIN stored_objects so ON so.object_key = i.object_key
      GROUP BY wanted.app, wanted.platform
    )
    SELECT image_counts.app, image_counts.platform, image_counts.screens, image_counts.ui_elements,
           flow_counts.flows, evidence_counts.invalid_flow_references,
           image_counts.missing_screen_objects, image_counts.missing_ui_element_objects,
           evidence_counts.missing_flow_objects
    FROM image_counts
    JOIN flow_counts USING (app, platform)
    JOIN evidence_counts USING (app, platform)
    ORDER BY image_counts.app, image_counts.platform`, [JSON.stringify(jobs)]);

  return new Map(result.rows.map((row) => {
    const snapshot: CatalogPersistenceSnapshot = {
      app: row.app,
      platform: row.platform,
      screens: Number(row.screens),
      uiElements: Number(row.ui_elements),
      flows: Number(row.flows),
      invalidFlowReferences: Number(row.invalid_flow_references),
      missingScreenObjects: Number(row.missing_screen_objects),
      missingUiElementObjects: Number(row.missing_ui_element_objects),
      missingFlowObjects: Number(row.missing_flow_objects),
    };
    return [catalogJobKey(row.app, row.platform), snapshot];
  }));
}
