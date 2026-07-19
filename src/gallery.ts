import type { AdminGalleryImage, CrawledImage, PublishedPreviewImage } from "./db.ts";
import { bulkImageHash, publicImageUrl } from "./imageSource.ts";

const APP_META: Record<string, { label: string; cat: string; accent: string; websiteUrl: string }> = {
  linear: { label: "Linear", cat: "Productivity", accent: "#5E6AD2", websiteUrl: "https://linear.app" },
  airbnb: { label: "Airbnb", cat: "Travel", accent: "#FF5A5F", websiteUrl: "https://airbnb.com" },
};

const FALLBACK_ACCENTS = ["#3b6ef6", "#0e9f6e", "#e0518a", "#f0763b", "#7c3aed", "#0891b2"];
const MAX_SCREENS_PER_APP = 120;

export interface CatalogScreen {
  id: number;
  type: string;
  productArea: string;
  theme: "light" | "dark" | "mixed";
  visibleStates: string[];
  platform: string;
  description: string | null;
  url: string | null;
  /** Resized grid-tile preview; falls back to the full image server-side if none was generated. */
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  layoutPatterns: string[];
  componentNames: string[];
  visibleText: string[];
  capturedAt: string | null;
  stateContext: string | null;
  confidence: number | null;
}

export interface CatalogApp {
  id: string;
  app: string;
  cat: string;
  accent: string;
  totalScreens: number;
  platforms: string[];
  previewScreens: CatalogScreen[];
  websiteUrl: string | null;
  iconUrl: string | null;
}

export interface CatalogPage {
  apps: CatalogApp[];
  nextCursor: string | null;
}

function appMeta(app: string) {
  if (APP_META[app]) return APP_META[app];
  const hue = [...app].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    label: app[0].toUpperCase() + app.slice(1),
    cat: "Design inspiration",
    accent: FALLBACK_ACCENTS[hue % FALLBACK_ACCENTS.length],
    websiteUrl: null,
  };
}

function screen(
  app: string,
  image: CrawledImage,
  previewRank?: number,
  imageUrl: (app: string, source: string, variant?: "thumb") => string = publicImageUrl,
): CatalogScreen {
  const hash = bulkImageHash(image.image_url);
  const previewUrl = hash ? `/api/preview-media/${app}/${previewRank}` : null;
  return {
    id: image.id,
    type: image.analysis?.pageType ?? "Unclassified",
    productArea: image.analysis?.productArea ?? "Unclassified",
    theme: image.analysis?.theme ?? "mixed",
    visibleStates: image.analysis?.visibleStates ?? [],
    platform: image.platform,
    description: image.description,
    sourceUrl: image.capture_url ?? null,
    layoutPatterns: image.analysis?.layoutPatterns ?? [],
    componentNames: image.analysis?.componentNames ?? [],
    visibleText: image.analysis?.visibleText ?? [],
    capturedAt: image.captured_at ?? null,
    stateContext: image.state_context ?? null,
    confidence: image.analysis?.confidence ?? null,
    url: previewRank ? previewUrl : imageUrl(app, image.image_url),
    thumbnailUrl: previewRank ? previewUrl : imageUrl(app, image.image_url, "thumb"),
  };
}

function groups<T extends CrawledImage>(images: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const image of images) result.set(image.app, [...(result.get(image.app) ?? []), image]);
  return result;
}

const encodeCursor = (value: string): string => Buffer.from(value).toString("base64url");

function decodeCursor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return Buffer.from(value, "base64url").toString();
  } catch {
    return undefined;
  }
}

function catalogApp(app: string, images: CrawledImage[], previews: PublishedPreviewImage[] = []): CatalogApp {
  const meta = appMeta(app);
  return {
    id: app,
    app: meta.label,
    cat: images[0]?.category ?? meta.cat,
    accent: meta.accent,
    totalScreens: images.length,
    platforms: [...new Set(images.map(({ platform }) => platform))],
    previewScreens: previews
      .sort((left, right) => left.preview_rank - right.preview_rank)
      .map((image) => screen(app, image, image.preview_rank)),
    websiteUrl: meta.websiteUrl,
    iconUrl: images[0]?.icon_url ?? null,
  };
}

export function buildCatalogPage(
  images: CrawledImage[],
  cursor?: string,
  requestedLimit = 24,
  previewImages: PublishedPreviewImage[] = [],
): CatalogPage {
  const byApp = groups(images);
  const previewsByApp = groups(previewImages);
  const names = [...byApp.keys()].sort();
  const after = decodeCursor(cursor);
  const start = after ? Math.max(0, names.findIndex((name) => name > after)) : 0;
  const limit = Math.min(Math.max(requestedLimit, 1), 24);
  const pageNames = names.slice(start, start + limit);
  return {
    apps: pageNames.map((name) => catalogApp(
      name,
      byApp.get(name) ?? [],
      (previewsByApp.get(name) ?? []) as PublishedPreviewImage[],
    )),
    nextCursor: start + limit < names.length ? encodeCursor(pageNames.at(-1) ?? "") : null,
  };
}

export function buildAppDetailPage(
  images: CrawledImage[],
  appSlug: string,
  cursor?: string,
  requestedLimit = 24,
  imageUrl: (app: string, source: string, variant?: "thumb") => string = publicImageUrl,
): { app: CatalogApp; screens: CatalogScreen[]; nextCursor: string | null } | undefined {
  const appImages = groups(images).get(appSlug)?.sort((a, b) => a.id - b.id);
  if (!appImages) return undefined;
  const after = Number(decodeCursor(cursor) ?? 0);
  const start = appImages.findIndex(({ id }) => id > after);
  const limit = Math.min(Math.max(requestedLimit, 1), 48);
  const page = appImages.slice(start < 0 ? appImages.length : start, (start < 0 ? appImages.length : start) + limit);
  return {
    app: catalogApp(appSlug, appImages),
    screens: page.map((image) => screen(appSlug, image, undefined, imageUrl)),
    nextCursor: page.length === limit && page.at(-1)!.id < appImages.at(-1)!.id
      ? encodeCursor(String(page.at(-1)!.id))
      : null,
  };
}

export function buildGalleryApps(images: CrawledImage[]) {
  const byApp = groups(images);

  return [...byApp.entries()].map(([app, appImages]) => {
    const meta = appMeta(app);
    return {
      id: app,
      app: meta.label,
      cat: appImages[0]?.category ?? meta.cat,
      accent: meta.accent,
      totalScreens: appImages.length,
      platforms: [...new Set(appImages.map(({ platform }) => platform))],
      websiteUrl: meta.websiteUrl,
      iconUrl: appImages[0]?.icon_url ?? null,
      screens: appImages.slice(0, MAX_SCREENS_PER_APP).map((image) => screen(app, image)),
    };
  });
}

export function buildAdminGalleryApps(images: AdminGalleryImage[]) {
  const byApp = groups(images);
  return [...byApp.entries()].map(([app, appImages]) => {
    const meta = appMeta(app);
    const summary = appImages[0];
    return {
      id: app,
      app: meta.label,
      cat: summary?.category ?? meta.cat,
      accent: meta.accent,
      totalScreens: summary?.total_screens ?? 0,
      platforms: summary?.available_platforms ?? [],
      analyzedScreens: summary?.analyzed_screens ?? 0,
      lastCapturedAt: summary?.last_captured_at ?? null,
      websiteUrl: meta.websiteUrl,
      iconUrl: summary?.icon_url ?? null,
      screens: appImages.slice(0, 5).map((image) => screen(app, image)),
    };
  });
}
