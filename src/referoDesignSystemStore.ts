import pg from "pg";
import type { ReferoArchiveRecord } from "./referoDesignSystem.ts";

export interface ReferoImportResult {
  appId: number;
  app: string;
  externalChanged: boolean;
  primaryDesignSystemUpdated: boolean;
}

function appIdentity(record: ReferoArchiveRecord): {
  slug: string;
  displayName: string;
  sourceDomain?: string;
  websiteUrl?: string;
} {
  let sourceDomain: string | undefined;
  let websiteUrl: string | undefined;
  try {
    const original = new URL(record.result.meta.url);
    sourceDomain = original.hostname.replace(/^www\./, "").toLowerCase();
    websiteUrl = original.origin;
  } catch {
    // Imported records can still be archived when Refero has no valid original URL.
  }
  return {
    slug: record.snapshot.app,
    displayName: record.result.meta.siteName,
    sourceDomain,
    websiteUrl,
  };
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

async function resolveApp(
  client: pg.PoolClient,
  record: ReferoArchiveRecord,
): Promise<{ id: number; name: string }> {
  const identity = appIdentity(record);
  let existing = identity.sourceDomain
    ? await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM apps WHERE source_domain = $1 LIMIT 1 FOR UPDATE",
      [identity.sourceDomain],
    )
    : await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM apps WHERE name = $1 LIMIT 1 FOR UPDATE",
      [identity.slug],
    );
  if (!existing.rows[0] && identity.sourceDomain) {
    existing = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM apps WHERE name = $1 AND source_domain IS NULL LIMIT 1 FOR UPDATE",
      [identity.slug],
    );
  }
  if (existing.rows[0]) {
    await client.query(
      `UPDATE apps SET
         source_domain = COALESCE(source_domain, $2),
         display_name = COALESCE(display_name, $3),
         website_url = COALESCE(website_url, $4),
         description = COALESCE(description, $5),
         category = COALESCE(category, $6),
         icon_url = COALESCE(icon_url, $7)
       WHERE id = $1`,
      [
        existing.rows[0].id,
        identity.sourceDomain ?? null,
        identity.displayName,
        identity.websiteUrl ?? null,
        record.snapshot.summary ?? null,
        record.snapshot.provenance?.industry ?? null,
        record.snapshot.provenance?.thumbnailUrl ?? null,
      ],
    );
    return existing.rows[0];
  }

  let name = identity.slug;
  const collision = await client.query("SELECT 1 FROM apps WHERE name = $1", [name]);
  if (collision.rowCount) name = `${name}-${record.id.slice(0, 8)}`;
  const inserted = await client.query<{ id: number; name: string }>(
    `INSERT INTO apps
       (name, source_domain, display_name, description, website_url, category, icon_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name`,
    [
      name,
      identity.sourceDomain ?? null,
      identity.displayName,
      record.snapshot.summary ?? null,
      identity.websiteUrl ?? null,
      record.snapshot.provenance?.industry ?? null,
      record.snapshot.provenance?.thumbnailUrl ?? null,
    ],
  );
  return inserted.rows[0];
}

export function shouldReplaceReferoPrimary(
  current: { origin: string; snapshot: Record<string, unknown> } | undefined,
  record: ReferoArchiveRecord,
): boolean {
  if (!current) return true;
  if (current.origin !== "imported") return false;
  const provenance = current.snapshot?.provenance as Record<string, unknown> | undefined;
  if (provenance?.provider !== "refero") return false;
  const currentModified = typeof provenance.upstreamModifiedAt === "string" ? Date.parse(provenance.upstreamModifiedAt) : 0;
  const incomingModified = record.sitemapLastModified ? Date.parse(record.sitemapLastModified) : Date.parse(record.fetchedAt);
  return !Number.isFinite(currentModified) || !Number.isFinite(incomingModified) || incomingModified >= currentModified;
}

export async function upsertReferoDesignSystem(
  pool: pg.Pool,
  record: ReferoArchiveRecord,
): Promise<ReferoImportResult> {
  return transaction(pool, async (client) => {
    const app = await resolveApp(client, record);
    await client.query(
      "INSERT INTO platforms (app_id, name) VALUES ($1, 'web') ON CONFLICT (app_id, name) DO NOTHING",
      [app.id],
    );

    const priorExternal = await client.query<{ content_hash: string }>(
      "SELECT content_hash FROM external_design_systems WHERE provider = 'refero' AND external_id = $1 FOR UPDATE",
      [record.id],
    );
    const externalChanged = priorExternal.rows[0]?.content_hash !== record.contentHash;
    await client.query(
      `INSERT INTO external_design_systems
         (provider, external_id, app_id, source_url, original_url, screenshot_url, thumbnail_url,
          upstream_modified_at, fetched_at, content_hash, snapshot, raw_payload)
       VALUES ('refero', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
       ON CONFLICT (provider, external_id) DO UPDATE SET
         app_id = EXCLUDED.app_id,
         source_url = EXCLUDED.source_url,
         original_url = EXCLUDED.original_url,
         screenshot_url = EXCLUDED.screenshot_url,
         thumbnail_url = EXCLUDED.thumbnail_url,
         upstream_modified_at = EXCLUDED.upstream_modified_at,
         fetched_at = EXCLUDED.fetched_at,
         content_hash = EXCLUDED.content_hash,
         snapshot = EXCLUDED.snapshot,
         raw_payload = EXCLUDED.raw_payload,
         updated_at = now()`,
      [
        record.id,
        app.id,
        record.sourceUrl,
        record.result.meta.url,
        record.snapshot.provenance?.screenshotUrl ?? null,
        record.snapshot.provenance?.thumbnailUrl ?? null,
        record.sitemapLastModified ?? null,
        record.fetchedAt,
        record.contentHash,
        JSON.stringify({ ...record.snapshot, app: app.name }),
        JSON.stringify({ result: record.result, jsonLd: record.jsonLd ?? null }),
      ],
    );

    const primary = await client.query<{ origin: string; snapshot: Record<string, unknown> }>(
      "SELECT origin, snapshot FROM design_systems WHERE app_id = $1 AND platform = 'web' FOR UPDATE",
      [app.id],
    );
    const primaryDesignSystemUpdated = shouldReplaceReferoPrimary(primary.rows[0], record);
    if (primaryDesignSystemUpdated) {
      await client.query(
        `INSERT INTO design_systems (app_id, platform, snapshot, origin)
         VALUES ($1, 'web', $2::jsonb, 'imported')
         ON CONFLICT (app_id, platform) DO UPDATE SET
           snapshot = EXCLUDED.snapshot,
           origin = 'imported',
           updated_at = now()`,
        [app.id, JSON.stringify({ ...record.snapshot, app: app.name })],
      );
    }
    return { appId: app.id, app: app.name, externalChanged, primaryDesignSystemUpdated };
  });
}
