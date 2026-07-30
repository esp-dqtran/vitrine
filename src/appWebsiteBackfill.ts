import { canonicalPublicPageUrl } from "./publicPage.ts";

export interface MobbinAppWebsiteMetadata {
  appName: string | null;
  appStoreUrl: string | null;
  hasAppStoreUrlField: boolean;
}

export interface AppleSoftwareResult {
  trackName?: unknown;
  trackViewUrl?: unknown;
  sellerUrl?: unknown;
}

export interface VerifiedAppleDestination {
  url: string;
  matchedName: string;
}

function decodeSerializedString(value: string): string | null {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return null;
  }
}

function serializedString(
  payload: string,
  escapedPattern: RegExp,
  plainPattern: RegExp,
): string | null {
  const raw = payload.match(escapedPattern)?.[1] ?? payload.match(plainPattern)?.[1];
  return raw === undefined ? null : decodeSerializedString(raw);
}

export function extractMobbinAppWebsiteMetadata(
  payload: string,
): MobbinAppWebsiteMetadata {
  const appName = serializedString(
    payload,
    /\\"appName\\":\\"((?:\\\\.|[^"\\])*)\\"/,
    /"appName"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  const appStoreUrl = serializedString(
    payload,
    /\\"appStoreUrl\\":\\"((?:\\\\.|[^"\\])*)\\"/,
    /"appStoreUrl"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  return {
    appName,
    appStoreUrl,
    hasAppStoreUrlField: /\\"appStoreUrl\\":/.test(payload)
      || /"appStoreUrl"\s*:/.test(payload),
  };
}

const BLOCKED_DESTINATION_HOSTS = [
  "mobbin.com",
  "supabase.co",
  "bytescale.com",
  "cloudfront.net",
] as const;

export function verifiedAppWebsiteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const trimmed = value.trim();
    const candidate = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#].*)?$/i
      .test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
    const canonical = canonicalPublicPageUrl(candidate).requestedUrl;
    const host = new URL(canonical).hostname.toLowerCase();
    if (BLOCKED_DESTINATION_HOSTS.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`),
    )) return null;
    return canonical;
  } catch {
    return null;
  }
}

export function appWebsiteDestinationKind(
  value: string,
): "apple-app-store" | "google-play" | "website" {
  const host = new URL(value).hostname.toLowerCase();
  if (host === "apps.apple.com") return "apple-app-store";
  if (host === "play.google.com") return "google-play";
  return "website";
}

const normalizedAppName = (value: string): string => value
  .normalize("NFKD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function verifiedAppleDestination(
  appName: string,
  results: readonly AppleSoftwareResult[],
): VerifiedAppleDestination | null {
  const expected = normalizedAppName(appName);
  if (expected.length < 2) return null;
  const candidates = results.flatMap((result) => {
    if (typeof result.trackName !== "string") return [];
    const normalizedTrackName = normalizedAppName(result.trackName);
    const match = normalizedTrackName === expected
      ? "exact"
      : normalizedTrackName.startsWith(`${expected} `)
        ? "prefix"
        : null;
    if (!match) return [];
    const rawUrl = typeof result.sellerUrl === "string"
      ? result.sellerUrl
      : typeof result.trackViewUrl === "string"
        ? result.trackViewUrl
        : null;
    const url = verifiedAppWebsiteUrl(rawUrl);
    return url ? [{ match, url, matchedName: result.trackName }] : [];
  });
  const exact = candidates.filter(({ match }) => match === "exact");
  const selected = exact.length === 1
    ? exact[0]
    : exact.length === 0 && candidates.length === 1
      ? candidates[0]
      : null;
  return selected ? { url: selected.url, matchedName: selected.matchedName } : null;
}

export function mobbinRscUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "mobbin.com"
    || !url.pathname.startsWith("/apps/")) {
    throw new Error("Mobbin App source URL is invalid");
  }
  url.searchParams.set("_rsc", "website-backfill");
  return url.toString();
}
