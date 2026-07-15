import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "mobbin-bulk:" refs come from bulkDownload, "capture:" refs from the smart crawler's own
// screenshots — both point at data/images/<app>/<hash>.<ext> and serve through /api/media.
const BULK_REF = /^(?:mobbin-bulk|capture):([0-9a-f]{16})$/;
const BULK_HASH = /^[0-9a-f]{16}$/;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type ParsedImageSource =
  | { kind: "legacy"; hash: string }
  | { kind: "external"; url: string };

export function isAppSlug(value: string): boolean {
  return APP_SLUG.test(value);
}

export function parseImageSource(source: string): ParsedImageSource | undefined {
  const legacy = source.match(BULK_REF)?.[1];
  if (legacy) return { kind: "legacy", hash: legacy };
  if (source.length === 0 || source.length > 2_048 || source.includes("\0")) return undefined;
  try {
    const parsed = new URL(source);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      return undefined;
    }
    return { kind: "external", url: source };
  } catch {
    return undefined;
  }
}

export function bulkImageHash(source: string): string | undefined {
  const parsed = parseImageSource(source);
  return parsed?.kind === "legacy" ? parsed.hash : undefined;
}

export function findBulkImage(dataDir: string, app: string, hash: string): string | undefined {
  if (!isAppSlug(app) || !BULK_HASH.test(hash)) return undefined;
  for (const extension of IMAGE_EXTENSIONS) {
    const path = join(dataDir, "images", app, `${hash}.${extension}`);
    if (existsSync(path)) return path;
  }
  return undefined;
}

export function publicImageUrl(app: string, source: string, variant?: "thumb"): string {
  const parsed = parseImageSource(source);
  if (parsed?.kind === "legacy" && isAppSlug(app)) {
    return `/api/media/${app}/${parsed.hash}${variant ? `?variant=${variant}` : ""}`;
  }
  // External sources (e.g. curated icon URLs) have no separate thumbnail — same URL either way.
  return parsed?.kind === "external" ? parsed.url : "";
}
