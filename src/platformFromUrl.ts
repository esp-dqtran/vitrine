export const PLATFORMS = ["ios", "android", "web"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = { ios: "iOS", android: "Android", web: "Web" };

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

// Mobbin's own app-detail URLs embed the platform right in the slug, e.g.
// ".../apps/linear-ios-<uuid>/<versionId>/screens" — pull it from there instead of asking
// callers to pass it separately. Falls back to "web" for URLs that don't match (e.g. a
// hand-typed URL, or bulk-download's appUrl reused verbatim).
export function platformFromUrl(url: string): Platform {
  const slug = new URL(url).pathname.split("/").filter(Boolean)[1] ?? "";
  const match = slug.match(/-(web|ios|android)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? (match[1].toLowerCase() as Platform) : "web";
}
