import pg from "pg";
import type { DesignSystemSnapshot } from "./designSystem.ts";
import type { GetDesignAppMapping } from "./getdesignCatalog.ts";

export interface ReplaceImportedDesignSystemInput {
  runId: string;
  app: string;
  platform: "web";
  sourceSlug: string;
  sourceHash: string;
  snapshot: DesignSystemSnapshot;
  allowCreateWebPlatform: boolean;
}

async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function inspectGetDesignTarget(
  pool: pg.Pool,
  mapping: Pick<GetDesignAppMapping, "app" | "platform">,
): Promise<{ appFound: boolean; webPlatformFound: boolean }> {
  const result = await pool.query<{ id: number; web_platform_found: boolean }>(`SELECT a.id,
    EXISTS (SELECT 1 FROM platforms p WHERE p.app_id = a.id AND p.name = 'web') AS web_platform_found
    FROM apps a WHERE a.name = $1`, [mapping.app]);
  return { appFound: Boolean(result.rowCount), webPlatformFound: result.rows[0]?.web_platform_found ?? false };
}

export async function replaceImportedDesignSystem(
  pool: pg.Pool,
  input: ReplaceImportedDesignSystemInput,
): Promise<{ historyId?: string; changed: boolean; createdPlatform: boolean }> {
  return transaction(pool, async (client) => {
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1 FOR UPDATE", [input.app]);
    if (!app.rowCount) throw new Error(`Mapped app not found: ${input.app}`);
    const appId = app.rows[0].id;
    const platform = await client.query("SELECT id FROM platforms WHERE app_id = $1 AND name = 'web'", [appId]);
    const createdPlatform = !platform.rowCount;
    if (createdPlatform && !input.allowCreateWebPlatform) {
      throw new Error(`Mapped app web platform is missing: ${input.app}`);
    }
    if (createdPlatform) await client.query("INSERT INTO platforms (app_id, name) VALUES ($1, 'web')", [appId]);

    const previous = await client.query<{ snapshot: DesignSystemSnapshot; origin: "observed" | "imported" }>(
      "SELECT snapshot, origin FROM design_systems WHERE app_id = $1 AND platform = 'web' FOR UPDATE",
      [appId],
    );
    const latest = await client.query<{ source_hash: string }>(`SELECT source_hash
      FROM design_system_import_history WHERE app_id = $1 AND platform = 'web' AND rolled_back_at IS NULL
      ORDER BY created_at DESC, id DESC LIMIT 1`, [appId]);
    if (previous.rows[0]?.origin === "imported" && latest.rows[0]?.source_hash === input.sourceHash) {
      return { changed: false, createdPlatform: false };
    }

    const history = await client.query<{ id: string }>(`INSERT INTO design_system_import_history
      (run_id, app_id, platform, source_slug, source_hash, previous_origin, previous_snapshot, imported_snapshot, created_platform)
      VALUES ($1, $2, 'web', $3, $4, $5, $6::jsonb, $7::jsonb, $8) RETURNING id`, [
      input.runId, appId, input.sourceSlug, input.sourceHash, previous.rows[0]?.origin ?? null,
      previous.rows[0] ? JSON.stringify(previous.rows[0].snapshot) : null,
      JSON.stringify(input.snapshot), createdPlatform,
    ]);
    await client.query(`INSERT INTO design_systems (app_id, platform, snapshot, origin)
      VALUES ($1, 'web', $2::jsonb, 'imported')
      ON CONFLICT (app_id, platform) DO UPDATE
      SET snapshot = EXCLUDED.snapshot, origin = 'imported', updated_at = now()`, [appId, JSON.stringify(input.snapshot)]);
    return { historyId: history.rows[0].id, changed: true, createdPlatform };
  });
}

export async function getImportedCurrentDesignSystem(
  pool: pg.Pool,
  app: string,
  platform: string,
): Promise<DesignSystemSnapshot | undefined> {
  const result = await pool.query<{ snapshot: DesignSystemSnapshot }>(`SELECT ds.snapshot
    FROM apps a JOIN design_systems ds ON ds.app_id = a.id
    WHERE a.name = $1 AND ds.platform = $2 AND ds.origin = 'imported'`, [app, platform]);
  return result.rows[0]?.snapshot;
}

export async function rollbackImportedDesignSystem(
  pool: pg.Pool,
  app: string,
): Promise<{ historyId: string }> {
  return transaction(pool, async (client) => {
    const appRow = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1 FOR UPDATE", [app]);
    if (!appRow.rowCount) throw new Error(`Mapped app not found: ${app}`);
    const appId = appRow.rows[0].id;
    const history = await client.query<{
      id: string; previous_origin: "observed" | "imported" | null;
      previous_snapshot: DesignSystemSnapshot | null; created_platform: boolean;
    }>(`SELECT id, previous_origin, previous_snapshot, created_platform
      FROM design_system_import_history
      WHERE app_id = $1 AND platform = 'web' AND rolled_back_at IS NULL
      ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, [appId]);
    if (!history.rowCount) throw new Error(`No active GetDesign import exists for ${app}`);
    const row = history.rows[0];
    if (row.previous_snapshot) {
      await client.query(`UPDATE design_systems SET snapshot = $2::jsonb, origin = $3, updated_at = now()
        WHERE app_id = $1 AND platform = 'web'`, [appId, JSON.stringify(row.previous_snapshot), row.previous_origin ?? "observed"]);
    } else {
      await client.query("DELETE FROM design_systems WHERE app_id = $1 AND platform = 'web'", [appId]);
    }
    if (row.created_platform) {
      const referenced = await client.query<{ referenced: boolean }>(`SELECT
        EXISTS (SELECT 1 FROM images i JOIN platforms p ON p.id = i.platform_id WHERE p.app_id = $1 AND p.name = 'web')
        OR EXISTS (SELECT 1 FROM app_versions av WHERE av.app_id = $1 AND av.platform = 'web') AS referenced`, [appId]);
      if (referenced.rows[0].referenced) throw new Error(`Cannot remove imported web platform with references: ${app}`);
      await client.query("DELETE FROM platforms WHERE app_id = $1 AND name = 'web'", [appId]);
    }
    await client.query("UPDATE design_system_import_history SET rolled_back_at = now() WHERE id = $1", [row.id]);
    return { historyId: row.id };
  });
}
