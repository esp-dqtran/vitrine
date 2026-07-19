import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "mobbin-bulk:" refs come from bulkDownload, "capture:" refs from the smart crawler's own
// screenshots — both point at data/images/<app>/<hash>.<ext> and serve through /api/media.
//
// Grammar: <prefix>[:<kind>]:<hash>[:<index>]. Screens use the bare two-part form; derived
// crops (ui_element, flow_step) carry their kind, and a trailing index disambiguates several
// crops taken from one source screen. The hash identifies the SOURCE screen, so it is shared
// between a screen and its crops — kind is what tells them apart and must survive into the URL.
const BULK_REF = /^(?:mobbin-bulk|capture):(?:([a-z_]+):)?([0-9a-f]{16})(?::(\d+))?$/;
const BULK_HASH = /^[0-9a-f]{16}$/;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type ParsedImageSource =
  | { kind: "legacy"; hash: string; imageKind?: string; index?: string }
  | { kind: "external"; url: string };

/**
 * The part of a legacy ref after the "mobbin-bulk:"/"capture:" prefix — i.e. the value the
 * media lookups compare against. Screens collapse to the bare hash (unchanged behaviour);
 * crops keep their kind/index so they can't be confused with their source screen.
 */
export function legacyRefSuffix(parsed: { hash: string; imageKind?: string; index?: string }): string {
  return [parsed.imageKind, parsed.hash, parsed.index].filter(Boolean).join(":");
}

export function isAppSlug(value: string): boolean {
  return APP_SLUG.test(value);
}

export function parseImageSource(source: string): ParsedImageSource | undefined {
  const legacy = source.match(BULK_REF);
  if (legacy) {
    const [, imageKind, hash, index] = legacy;
    return { kind: "legacy", hash, ...(imageKind ? { imageKind } : {}), ...(index ? { index } : {}) };
  }
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
    // kind/i ride as query params (like `variant`) rather than changing the path shape, so
    // existing screen URLs stay byte-identical and only crops gain the extra qualifiers.
    const params = new URLSearchParams();
    if (variant) params.set("variant", variant);
    if (parsed.imageKind) params.set("kind", parsed.imageKind);
    if (parsed.index) params.set("i", parsed.index);
    const search = params.toString();
    return `/api/media/${app}/${parsed.hash}${search ? `?${search}` : ""}`;
  }
  // External sources (e.g. curated icon URLs) have no separate thumbnail — same URL either way.
  return parsed?.kind === "external" ? parsed.url : "";
}
