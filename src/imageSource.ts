import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "mobbin-bulk:" refs come from bulkDownload, "capture:" refs from the smart crawler's own
// screenshots — both point at data/images/<app>/<hash>.<ext> and serve through /api/media.
const BULK_REF = /^(?:mobbin-bulk|capture):([0-9a-f]{16})$/;
const BULK_HASH = /^[0-9a-f]{16}$/;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export function isAppSlug(value: string): boolean {
  return APP_SLUG.test(value);
}

export function bulkImageHash(source: string): string | undefined {
  return source.match(BULK_REF)?.[1];
}

export function findBulkImage(dataDir: string, app: string, hash: string): string | undefined {
  if (!isAppSlug(app) || !BULK_HASH.test(hash)) return undefined;
  for (const extension of IMAGE_EXTENSIONS) {
    const path = join(dataDir, "images", app, `${hash}.${extension}`);
    if (existsSync(path)) return path;
  }
  return undefined;
}

export function publicImageUrl(app: string, source: string): string {
  const hash = bulkImageHash(source);
  return hash && isAppSlug(app) ? `/api/media/${app}/${hash}` : source;
}
