const GOOGLE_PLAY_SCREENSHOT_HOST = "play-lh.googleusercontent.com";
const ANDROID_PACKAGE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;

export interface GooglePlayListing {
  packageId: string;
  url: string;
}

export interface GooglePlayScreenshot {
  index: number;
  url: string;
}

export interface GooglePlayRenderedScreenshot {
  url: string;
  width: number;
  height: number;
}

export function googlePlayListing(value: string): GooglePlayListing {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname !== "play.google.com"
    || parsed.pathname !== "/store/apps/details") {
    throw new Error("--listing must be an official Google Play app details URL");
  }
  const packageId = parsed.searchParams.get("id")?.trim() ?? "";
  if (!ANDROID_PACKAGE.test(packageId)) {
    throw new Error("--listing must contain a valid Android package id");
  }
  const canonical = new URL("https://play.google.com/store/apps/details");
  canonical.searchParams.set("id", packageId);
  const language = parsed.searchParams.get("hl")?.trim();
  const country = parsed.searchParams.get("gl")?.trim();
  if (language) canonical.searchParams.set("hl", language);
  if (country) canonical.searchParams.set("gl", country);
  return { packageId, url: canonical.toString() };
}

export function googlePlayScreenshotAssetKey(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname !== GOOGLE_PLAY_SCREENSHOT_HOST) {
    throw new Error("Google Play screenshot must use the official image host");
  }
  const asset = `${parsed.origin}${parsed.pathname.replace(/=[^/]*$/, "")}`;
  if (asset.length < 80) throw new Error("Google Play screenshot asset is invalid");
  return asset;
}

export function googlePlayOriginalScreenshotUrl(value: string): string {
  return `${googlePlayScreenshotAssetKey(value)}=s0`;
}

export function googlePlayScreenshots(values: string[]): GooglePlayScreenshot[] {
  const urls = new Map<string, string>();
  for (const value of values) {
    try {
      const key = googlePlayScreenshotAssetKey(value);
      if (!urls.has(key)) urls.set(key, `${key}=s0`);
    } catch {
      // The live page also contains icons, avatars, and recommendation art.
      // Only official Google Play image assets selected from the screenshot
      // shelf are accepted by this parser.
    }
  }
  return [...urls.values()].map((url, index) => ({ index: index + 1, url }));
}

export function googlePlayPhoneScreenshots(
  values: GooglePlayRenderedScreenshot[],
): GooglePlayScreenshot[] {
  const phoneAssets = values.filter(({ width, height }) => {
    if (width <= 0 || height <= 0) return false;
    const ratio = width / height;
    return ratio <= 0.6 || ratio >= 1 / 0.6;
  });
  const portraitAssets = phoneAssets.filter(({ width, height }) => width / height <= 0.6);
  const landscapeAssets = phoneAssets.filter(({ width, height }) => width / height >= 1 / 0.6);
  const shelfAssets = portraitAssets.length && landscapeAssets.length
    ? portraitAssets.length >= landscapeAssets.length ? portraitAssets : landscapeAssets
    : phoneAssets;
  // Google Play accepts at most eight screenshots for each device type. The
  // page can include a single opposite-orientation promo/video image before
  // the real shelf. Keep the shelf's dominant orientation without excluding
  // apps whose screenshots are all landscape.
  return googlePlayScreenshots(shelfAssets.map(({ url }) => url)).slice(0, 8);
}

function nameWords(value: string): string[] {
  return value.normalize("NFKD").toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function googlePlayTitleMatches(expected: string, actual: string): boolean {
  const expectedWords = nameWords(expected);
  const actualWords = nameWords(actual);
  return expectedWords.length > 0 && actualWords.length >= expectedWords.length
    && expectedWords.every((word, index) => actualWords[index] === word);
}

function normalizedHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLocaleLowerCase().replace(/^(?:www\.|m\.)/, "");
  } catch {
    return null;
  }
}

export function googlePlayWebsiteMatches(expected: string, actual: string): boolean {
  const expectedHost = normalizedHostname(expected);
  const actualHost = normalizedHostname(actual);
  if (!expectedHost || !actualHost) return false;
  return expectedHost === actualHost
    || expectedHost.endsWith(`.${actualHost}`)
    || actualHost.endsWith(`.${expectedHost}`);
}

export function googlePlayListingsInHtml(html: string): GooglePlayListing[] {
  const decoded = html.replaceAll("&amp;", "&").replaceAll("\\u0026", "&");
  const values = decoded.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?[^"'<>\s]+/g) ?? [];
  const listings = new Map<string, GooglePlayListing>();
  for (const value of values) {
    try {
      const parsed = googlePlayListing(value.replace(/^http:/, "https:"));
      if (!listings.has(parsed.packageId)) listings.set(parsed.packageId, parsed);
    } catch {
      // Ignore unrelated and malformed store links embedded in the page.
    }
  }
  return [...listings.values()];
}
