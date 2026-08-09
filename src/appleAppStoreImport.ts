const APPLE_SCREENSHOT_URL = /https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"'\s]+\/([^/"'\s]+\.(?:png|jpe?g))\/(\d+)x(\d+)bb(?:-\d+)?\.webp/g;

export interface AppleAppStoreScreenshot {
  index: number;
  url: string;
  width: number;
  height: number;
}

function appleScreenshotAssetKey(url: string): string {
  return url
    .replace(/^https:\/\/is\d+-ssl\.mzstatic\.com/, "")
    .replace(/\/\d+x\d+bb(?:-\d+)?\.(?:png|webp|jpe?g)$/, "");
}

/**
 * Apple only server-renders the first carousel page, while Lookup can expose
 * the remaining items. Use the longer feed only when its leading assets match
 * the live shelf exactly, so stale or unrelated Lookup results cannot replace
 * the listing the curator supplied.
 */
export function completeAppleAppStoreScreenshots(
  live: AppleAppStoreScreenshot[],
  lookup: AppleAppStoreScreenshot[],
): AppleAppStoreScreenshot[] {
  if (live.length === 0) return lookup;
  if (lookup.length <= live.length) return live;
  const lookupKeys = lookup.map(({ url }) => appleScreenshotAssetKey(url));
  const liveMatchesLookup = live.every(
    ({ url }, index) => appleScreenshotAssetKey(url) === lookupKeys[index],
  );
  return liveMatchesLookup ? lookup : live;
}

/**
 * iTunes Lookup is Apple's complete device screenshot feed. Its URLs often
 * point at a small PNG or JPEG rendition, but the same asset supports the full-size
 * WebP rendition used by our importer.
 */
export function appleAppStoreLookupScreenshots(
  value: unknown,
  device: "iphone" | "ipad" = "iphone",
): AppleAppStoreScreenshot[] {
  if (!value || typeof value !== "object") return [];
  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results) || !results[0] || typeof results[0] !== "object") return [];
  const urls = (results[0] as { screenshotUrls?: unknown; ipadScreenshotUrls?: unknown })[
    device === "ipad" ? "ipadScreenshotUrls" : "screenshotUrls"
  ];
  if (!Array.isArray(urls)) return [];
  return urls.flatMap((raw, index) => {
    if (typeof raw !== "string") return [];
    const match = raw.match(/^https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^\s]+\/(\d+)x(\d+)bb(?:-\d+)?\.(?:png|webp|jpe?g)$/);
    if (!match) return [];
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 150 || height < width * 1.25) return [];
    return [{
      index: index + 1,
      url: raw.replace(/\/\d+x\d+bb(?:-\d+)?\.(?:png|webp|jpe?g)$/, "/600x1300bb.webp"),
      width: 600,
      height: 1300,
    }];
  });
}

// App Store pages expose every responsive rendition in the SSR markup, including
// images outside the visible scroll region. Keep the largest rendition per shelf
// item so an importer is not coupled to the rendered viewport. The source asset
// path is stable across responsive renditions; filenames are not unique (Apple
// commonly reuses `pr_source.png` for several different shelf images).
export function appleAppStoreScreenshots(
  html: string,
  expectedCount: number | null = 5,
): AppleAppStoreScreenshot[] {
  const candidates = new Map<string, AppleAppStoreScreenshot>();
  // Some App Store SSR responses JSON-escape their URLs while others embed
  // literal URLs. Normalize escaped solidi before looking for shelf images.
  for (const match of html.replaceAll("\\/", "/").matchAll(APPLE_SCREENSHOT_URL)) {
    const key = match[0].replace(/https:\/\/is\d+-ssl\.mzstatic\.com/, "")
      .replace(/\/\d+x\d+bb(?:-\d+)?\.webp$/, "");
    const width = Number(match[2]);
    const height = Number(match[3]);
    // App Store pages put an app icon beside the screenshot shelf. A mobile
    // screen is portrait and materially larger than those square assets.
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 150 || height < width * 1.25) continue;
    const existing = candidates.get(key);
    if (!existing || width * height > existing.width * existing.height) {
      candidates.set(key, {
        index: existing?.index ?? candidates.size + 1,
        url: match[0],
        width,
        height,
      });
    }
  }
  const screenshots = [...candidates.values()].sort((left, right) => left.index - right.index);
  if (expectedCount !== null && screenshots.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} static App Store screenshots; found ${screenshots.length}`);
  }
  return screenshots;
}
