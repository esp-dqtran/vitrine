import { createHash } from "node:crypto";
import sharp from "sharp";
import { downloadIcon } from "./appIconResolver.ts";
import { query as databaseQuery } from "./db.ts";
import {
  appIconObjectKey,
  siteIconObjectKey,
  type ObjectMetadata,
  type ObjectStore,
} from "./objectStore.ts";

export type DatabaseQuery = (sql: string, values?: readonly unknown[]) => Promise<unknown>;

export interface AppIconStoreDependencies {
  objectStore: ObjectStore;
  download?(url: string): Promise<Buffer>;
  runQuery?: DatabaseQuery;
}

// Catalog icons render at 52px and never larger, so 256px covers 2x displays
// with room to spare. WebP keeps every source format (PNG, JPEG, SVG) as one
// content type the object store already allows.
const ICON_EDGE = 256;

const liveQuery: DatabaseQuery = (sql, values) => databaseQuery(sql, values ? [...values] : undefined);

/**
 * Downloads an app icon, stores it in the object store, and points the app at
 * the stored copy. Returns the `/assets/<key>` path the browser loads.
 *
 * `icon_url` holds that path because every consumer already reads it; the
 * `icon_object_key` reference is what keeps the object alive for GC.
 */
export async function storeAppIcon(
  deps: AppIconStoreDependencies,
  appId: number,
  sourceUrl: string,
): Promise<string> {
  return storeIcon(deps, { table: "apps", id: appId, key: appIconObjectKey }, sourceUrl);
}

/** Stores trusted icon bytes discovered while inspecting the official website. */
export async function storeAppIconBuffer(
  deps: AppIconStoreDependencies,
  appId: number,
  source: Buffer,
): Promise<string> {
  return storeIcon(deps, { table: "apps", id: appId, key: appIconObjectKey }, source);
}

/**
 * Same pipeline for a Site logo. Site cards render the tile at 44px and the
 * sources are a mix of favicons, wordmarks and formats sharp cannot decode, so
 * a resolved square copy is what makes them look consistent.
 */
export async function storeSiteIcon(
  deps: AppIconStoreDependencies,
  siteId: number,
  sourceUrl: string,
): Promise<string> {
  return storeIcon(deps, { table: "sites", id: siteId, key: siteIconObjectKey }, sourceUrl);
}

async function storeIcon(
  deps: AppIconStoreDependencies,
  target: { table: "apps" | "sites"; id: number; key: (id: number, sha256: string) => string },
  sourceInput: string | Buffer,
): Promise<string> {
  const download = deps.download ?? downloadIcon;
  const runQuery = deps.runQuery ?? liveQuery;
  const source = typeof sourceInput === "string" ? await download(sourceInput) : sourceInput;
  const body = await sharp(source, { limitInputPixels: 64 * 1024 * 1024 })
    .resize(ICON_EDGE, ICON_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  if (!body.byteLength) throw new Error("Icon conversion produced no bytes");

  const sha256 = createHash("sha256").update(body).digest("hex");
  const metadata: ObjectMetadata = {
    key: target.key(target.id, sha256),
    sha256,
    byteSize: body.byteLength,
    contentType: "image/webp",
    // Icons are already shown to signed-out visitors, so the Worker serves
    // this prefix straight from R2.
    accessClass: "public-preview",
  };
  await deps.objectStore.put({ ...metadata, body });

  // The key embeds the content hash, so an existing row is the same object.
  await runQuery(
    `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (object_key) DO NOTHING`,
    [metadata.key, metadata.sha256, metadata.byteSize, metadata.contentType, metadata.accessClass],
  );
  const path = `/assets/${metadata.key}`;
  const urlColumn = target.table === "apps" ? "icon_url" : "logo_url";
  await runQuery(
    `UPDATE ${target.table} SET icon_object_key = $1, ${urlColumn} = $2 WHERE id = $3`,
    [metadata.key, path, target.id],
  );
  // The Site catalog listing reads the logo from the version snapshot, so a
  // Site whose parent row moved but whose snapshot did not would still hotlink.
  if (target.table === "sites") {
    await runQuery(
      `UPDATE site_versions
       SET catalog_snapshot = jsonb_set(catalog_snapshot, '{logoUrl}', to_jsonb($1::text), true),
           updated_at = now()
       WHERE site_id = $2`,
      [path, target.id],
    );
  }
  return path;
}
