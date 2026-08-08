const APPLE_SCREENSHOT_URL = /https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"'\s]+\/([^/"'\s]+\.(?:png|jpe?g))\/(\d+)x(\d+)bb(?:-\d+)?\.webp/g;

export interface AppleAppStoreScreenshot {
  index: number;
  url: string;
  width: number;
  height: number;
}

// App Store pages expose every responsive rendition in the SSR markup, including
// images outside the visible scroll region. Keep the largest rendition per shelf
// item so an importer is not coupled to the rendered viewport. The filename is a
// stable shelf identity for both Apple URL shapes: `00.png` and named assets.
export function appleAppStoreScreenshots(
  html: string,
  expectedCount: number | null = 5,
): AppleAppStoreScreenshot[] {
  const candidates = new Map<string, AppleAppStoreScreenshot>();
  // Some App Store SSR responses JSON-escape their URLs while others embed
  // literal URLs. Normalize escaped solidi before looking for shelf images.
  for (const match of html.replaceAll("\\/", "/").matchAll(APPLE_SCREENSHOT_URL)) {
    const key = match[1];
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
