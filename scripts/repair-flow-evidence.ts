import { pathToFileURL } from "node:url";
import pg from "pg";
import { remapFlowEvidence } from "./merge-catalog-databases.ts";

type FlowSetRow = { app_id: number; platform: string; flows: unknown };
type InvalidMappingRow = {
  app_id: number;
  platform: string;
  old_id: string | number;
  candidate_ids: Array<string | number>;
};

const contextKey = (appId: number, platform: string) => `${appId}\u0000${platform}`;
const evidenceKey = (appId: number, platform: string, imageId: number) => `${contextKey(appId, platform)}\u0000${imageId}`;

async function invalidReferenceCount(client: pg.PoolClient): Promise<number> {
  const result = await client.query<{ invalid: string }>(`
    WITH evidence AS (
      SELECT a.id AS app_id, af.platform, (e #>> '{}')::bigint AS image_id
      FROM app_flows af
      JOIN apps a ON a.id = af.app_id
      CROSS JOIN LATERAL jsonb_array_elements(af.flows) f
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f->'steps', '[]'::jsonb)) s
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s->'evidence', '[]'::jsonb)) e
    )
    SELECT count(*) FILTER (
      WHERE i.id IS NULL OR p.app_id <> evidence.app_id OR p.name <> evidence.platform
    )::text AS invalid
    FROM evidence
    LEFT JOIN images i ON i.id = evidence.image_id
    LEFT JOIN platforms p ON p.id = i.platform_id`);
  return Number(result.rows[0].invalid);
}

async function repair(client: pg.PoolClient): Promise<{ changedFlowSets: number; remappedReferences: number }> {
  const flowSets = await client.query<FlowSetRow>(
    "SELECT app_id, platform, flows FROM app_flows ORDER BY app_id, platform",
  );
  const validImages = await client.query<{ app_id: number; platform: string; image_id: number }>(
    `SELECT p.app_id, p.name AS platform, i.id AS image_id
     FROM images i JOIN platforms p ON p.id = i.platform_id`,
  );
  const invalidMappings = await client.query<InvalidMappingRow>(`
      WITH invalid AS MATERIALIZED (
        SELECT DISTINCT a.id AS app_id, af.platform, (e #>> '{}')::bigint AS old_id
        FROM app_flows af
        JOIN apps a ON a.id = af.app_id
        CROSS JOIN LATERAL jsonb_array_elements(af.flows) f
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f->'steps', '[]'::jsonb)) s
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s->'evidence', '[]'::jsonb)) e
        LEFT JOIN images existing ON existing.id = (e #>> '{}')::bigint
        LEFT JOIN platforms existing_platform ON existing_platform.id = existing.platform_id
        WHERE existing.id IS NULL
           OR existing_platform.app_id <> a.id
           OR existing_platform.name <> af.platform
      ), legacy_objects AS MATERIALIZED (
        SELECT ((regexp_match(object_key, '^images/([0-9]+)/'))[1])::bigint AS old_id, sha256
        FROM stored_objects
        WHERE object_key ~ '^images/[0-9]+/'
      ), target_by_sha AS MATERIALIZED (
        SELECT p.app_id, p.name AS platform, so.sha256, i.id
        FROM images i
        JOIN platforms p ON p.id = i.platform_id
        JOIN stored_objects so ON so.object_key = i.object_key
      )
      SELECT invalid.app_id, invalid.platform, invalid.old_id,
             COALESCE(array_agg(DISTINCT target.id) FILTER (WHERE target.id IS NOT NULL), '{}') AS candidate_ids
      FROM invalid
      LEFT JOIN legacy_objects legacy ON legacy.old_id = invalid.old_id
      LEFT JOIN target_by_sha target
        ON target.app_id = invalid.app_id
       AND target.platform = invalid.platform
       AND target.sha256 = legacy.sha256
      GROUP BY invalid.app_id, invalid.platform, invalid.old_id
      ORDER BY invalid.app_id, invalid.platform, invalid.old_id`);

  const validByContext = new Map<string, Set<number>>();
  for (const row of validImages.rows) {
    const key = contextKey(Number(row.app_id), row.platform);
    const ids = validByContext.get(key) ?? new Set<number>();
    ids.add(Number(row.image_id));
    validByContext.set(key, ids);
  }

  const replacements = new Map<string, number>();
  for (const row of invalidMappings.rows) {
    const candidates = row.candidate_ids.map(Number);
    if (candidates.length !== 1) {
      throw new Error(
        `Flow evidence ${row.old_id} for app ${row.app_id}/${row.platform} has ${candidates.length} target candidates`,
      );
    }
    replacements.set(evidenceKey(Number(row.app_id), row.platform, Number(row.old_id)), candidates[0]);
  }

  let changedFlowSets = 0;
  let remappedReferences = 0;
  for (const row of flowSets.rows) {
    const appId = Number(row.app_id);
    const valid = validByContext.get(contextKey(appId, row.platform)) ?? new Set<number>();
    let changed = 0;
    const repaired = remapFlowEvidence(row.flows, (imageId) => {
      if (valid.has(imageId)) return imageId;
      const replacement = replacements.get(evidenceKey(appId, row.platform, imageId));
      if (!replacement) throw new Error(`Unresolved flow evidence ${imageId} for app ${appId}/${row.platform}`);
      changed++;
      return replacement;
    });
    if (changed === 0) continue;
    await client.query(
      "UPDATE app_flows SET flows = $3::jsonb, updated_at = now() WHERE app_id = $1 AND platform = $2",
      [appId, row.platform, JSON.stringify(repaired)],
    );
    changedFlowSets++;
    remappedReferences += changed;
  }
  return { changedFlowSets, remappedReferences };
}

export async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Pass exactly one of --dry-run or --apply");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '180s'");
    const invalidBefore = await invalidReferenceCount(client);
    const result = await repair(client);
    const invalidAfter = await invalidReferenceCount(client);
    if (invalidAfter !== 0) throw new Error(`Flow evidence repair left ${invalidAfter} invalid references`);
    if (apply) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      invalidBefore,
      invalidAfter,
      ...result,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
