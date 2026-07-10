import type { CrawledImage } from "./db.ts";
import { publicImageUrl } from "./imageSource.ts";

const APP_META: Record<string, { label: string; cat: string; accent: string }> = {
  linear: { label: "Linear", cat: "Productivity", accent: "#5E6AD2" },
  airbnb: { label: "Airbnb", cat: "Travel", accent: "#FF5A5F" },
};

const FALLBACK_ACCENTS = ["#3b6ef6", "#0e9f6e", "#e0518a", "#f0763b", "#7c3aed", "#0891b2"];
const MAX_SCREENS_PER_APP = 120;

function appMeta(app: string) {
  if (APP_META[app]) return APP_META[app];
  const hue = [...app].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    label: app[0].toUpperCase() + app.slice(1),
    cat: "Design inspiration",
    accent: FALLBACK_ACCENTS[hue % FALLBACK_ACCENTS.length],
  };
}

export function buildGalleryApps(images: CrawledImage[]) {
  const byApp = new Map<string, CrawledImage[]>();
  for (const image of images) byApp.set(image.app, [...(byApp.get(image.app) ?? []), image]);

  return [...byApp.entries()].map(([app, appImages]) => {
    const meta = appMeta(app);
    return {
      id: app,
      app: meta.label,
      cat: meta.cat,
      accent: meta.accent,
      totalScreens: appImages.length,
      screens: appImages.slice(0, MAX_SCREENS_PER_APP).map((image) => ({
        id: image.id,
        type: image.analysis?.pageType ?? "Unclassified",
        productArea: image.analysis?.productArea ?? "Unclassified",
        theme: image.analysis?.theme ?? "mixed",
        visibleStates: image.analysis?.visibleStates ?? [],
        platform: image.platform,
        description: image.description,
        url: publicImageUrl(app, image.image_url),
      })),
    };
  });
}
