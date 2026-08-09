import { closePool, pool } from "../src/db.ts";

type Platform = "ios" | "android";

interface VersionLinkRow {
  versionId: number;
  app: string;
  platform: Platform;
  sourceUrl: string | null;
  appleIds: string[];
  playPackages: string[];
}

interface AppLinkRow {
  appId: number;
  app: string;
  websiteUrl: string | null;
  platforms: Platform[];
  appleIds: string[];
  playPackages: string[];
}

function storeIdentity(value: string | null): { platform: Platform; identity: string } | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "apps.apple.com" || parsed.hostname === "itunes.apple.com") {
      const identity = parsed.pathname.match(/\/id(\d+)\/?$/)?.[1];
      return identity ? { platform: "ios", identity } : null;
    }
    if (parsed.hostname === "play.google.com" && parsed.pathname === "/store/apps/details") {
      const identity = parsed.searchParams.get("id")?.trim();
      return identity ? { platform: "android", identity } : null;
    }
  } catch {
    return null;
  }
  return null;
}

function canonicalStoreUrl(platform: Platform, identity: string): string {
  return platform === "ios"
    ? `https://apps.apple.com/us/app/id${identity}`
    : `https://play.google.com/store/apps/details?id=${encodeURIComponent(identity)}`;
}

function single(values: string[]): string | null {
  return values.length === 1 ? values[0]! : null;
}

const apply = process.argv.includes("--apply");
const versions = await pool.query<VersionLinkRow>(
  `SELECT av.id AS "versionId", apps.name AS app, av.platform, av.source_url AS "sourceUrl",
     COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT substring(images.image_url FROM '^apple-store:([0-9]+):'))
       FILTER (WHERE images.image_url ~ '^apple-store:[0-9]+:[0-9]+$'), NULL), ARRAY[]::text[]) AS "appleIds",
     COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT substring(images.image_url FROM '^google-play:([^:]+):'))
       FILTER (WHERE images.image_url ~ '^google-play:[^:]+:[0-9]+$'), NULL), ARRAY[]::text[]) AS "playPackages"
   FROM app_versions av
   JOIN apps ON apps.id = av.app_id
   LEFT JOIN version_images membership ON membership.version_id = av.id
   LEFT JOIN images ON images.id = membership.image_id
   WHERE av.status = 'published' AND av.platform IN ('ios', 'android')
   GROUP BY av.id, apps.name, av.platform, av.source_url
   ORDER BY apps.name, av.platform`,
);

const versionRepairs: Array<VersionLinkRow & { desired: string | null; reason: string }> = [];
const conflicts: Array<{ app: string; platform: Platform; identities: string[] }> = [];
for (const version of versions.rows) {
  const identities = version.platform === "ios" ? version.appleIds : version.playPackages;
  if (identities.length > 1) {
    conflicts.push({ app: version.app, platform: version.platform, identities });
    continue;
  }
  const identity = single(identities);
  if (identity) {
    const currentStore = storeIdentity(version.sourceUrl);
    if (currentStore?.platform === version.platform && currentStore.identity === identity) continue;
    const desired = canonicalStoreUrl(version.platform, identity);
    versionRepairs.push({ ...version, desired, reason: "screenshot-provenance" });
    continue;
  }
  const currentStore = storeIdentity(version.sourceUrl);
  if (currentStore && currentStore.platform !== version.platform) {
    versionRepairs.push({ ...version, desired: null, reason: "wrong-platform-source" });
  }
}

const apps = await pool.query<AppLinkRow>(
  `SELECT apps.id AS "appId", apps.name AS app, apps.website_url AS "websiteUrl",
     COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT av.platform)
       FILTER (WHERE av.status = 'published' AND av.platform IN ('ios', 'android')), NULL), ARRAY[]::text[]) AS platforms,
     COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT substring(images.image_url FROM '^apple-store:([0-9]+):'))
       FILTER (WHERE images.image_url ~ '^apple-store:[0-9]+:[0-9]+$'), NULL), ARRAY[]::text[]) AS "appleIds",
     COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT substring(images.image_url FROM '^google-play:([^:]+):'))
       FILTER (WHERE images.image_url ~ '^google-play:[^:]+:[0-9]+$'), NULL), ARRAY[]::text[]) AS "playPackages"
   FROM apps
   LEFT JOIN app_versions av ON av.app_id = apps.id
   LEFT JOIN version_images membership ON membership.version_id = av.id
   LEFT JOIN images ON images.id = membership.image_id
   GROUP BY apps.id, apps.name, apps.website_url
   ORDER BY apps.name`,
);

const appRepairs: Array<AppLinkRow & { desired: string | null; reason: string }> = [];
for (const app of apps.rows) {
  const currentStore = storeIdentity(app.websiteUrl);
  if (!currentStore) continue;
  const identities = currentStore.platform === "ios" ? app.appleIds : app.playPackages;
  const matchingPlatformExists = app.platforms.includes(currentStore.platform);
  const identity = single(identities);
  if (matchingPlatformExists && identity && identity !== currentStore.identity) {
    const desired = app.platforms.length === 1
      ? canonicalStoreUrl(currentStore.platform, identity)
      : null;
    appRepairs.push({ ...app, desired, reason: "store-identity-mismatch" });
  }
}

if (apply) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const repair of versionRepairs) {
      await client.query("UPDATE app_versions SET source_url = $2 WHERE id = $1", [repair.versionId, repair.desired]);
    }
    for (const repair of appRepairs) {
      await client.query("UPDATE apps SET website_url = $2 WHERE id = $1", [repair.appId, repair.desired]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

console.log(JSON.stringify({
  status: apply ? "applied" : "dry-run",
  scannedVersions: versions.rowCount,
  versionRepairs: versionRepairs.length,
  appWebsiteRepairs: appRepairs.length,
  conflicts,
  versionExamples: versionRepairs.slice(0, 25).map(({ app, platform, sourceUrl, desired, reason }) => ({
    app, platform, from: sourceUrl, to: desired, reason,
  })),
  appExamples: appRepairs.slice(0, 25).map(({ app, websiteUrl, desired, reason }) => ({
    app, from: websiteUrl, to: desired, reason,
  })),
}, null, 2));

await closePool();
