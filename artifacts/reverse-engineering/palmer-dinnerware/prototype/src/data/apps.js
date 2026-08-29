export const APP_CATALOG_PAGE_SIZE = 24;

export const appSwatches = {
  Green: "#0e9f6e",
  Orange: "#f0763b",
  Pink: "#e0518a",
  Cyan: "#0891b2",
  Purple: "#7c3aed",
  Blue: "#3b6ef6",
};

export const appFacets = {
  colors: Object.keys(appSwatches),
  types: [
    "AI",
    "Business",
    "Developer Tools",
    "Photo & Video",
    "Productivity",
    "Education",
    "Collaboration",
    "Graphics & Design",
  ],
  sizes: [0, 5000],
};

function rgb(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex.slice(1) : "3b6ef6";
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function nearestSwatchName(accent) {
  const [red, green, blue] = rgb(accent);
  return Object.entries(appSwatches).reduce((nearest, [name, value]) => {
    const [nextRed, nextGreen, nextBlue] = rgb(value);
    const distance = (red - nextRed) ** 2 + (green - nextGreen) ** 2 + (blue - nextBlue) ** 2;
    return distance < nearest.distance ? { name, distance } : nearest;
  }, { name: "Blue", distance: Infinity }).name;
}

export function catalogAppsToItems(apps) {
  return apps.map((app) => {
    const categories = (app.categories ?? []).map((category) => (
      typeof category === "string" ? category : category.name
    )).filter(Boolean);
    const preview = app.previewScreens?.find((screen) => screen.thumbnailUrl || screen.url);
    return {
      index: app.id,
      id: app.id,
      name: app.app,
      collection: app.app,
      collectionSlug: app.id,
      localImage: app.iconUrl ?? app.previewUrl ?? preview?.thumbnailUrl ?? preview?.url ?? null,
      image: { width: 400, height: 400 },
      color: nearestSwatchName(app.accent),
      accent: app.accent || "#3b6ef6",
      type: categories[0] ?? "Digital product",
      categories,
      size: app.totalScreens,
      totalScreens: app.totalScreens,
      analyzedScreens: Number.isFinite(app.analyzedScreens) ? app.analyzedScreens : null,
      description: typeof app.description === "string" && app.description.trim()
        ? app.description.trim()
        : null,
      platforms: [...new Set((app.platforms ?? []).filter(Boolean))],
      lastCapturedAt: app.lastCapturedAt ?? null,
      websiteUrl: app.websiteUrl ?? null,
      appUrl: `https://vitrines.ai/apps/${app.id}`,
    };
  });
}

export function relatedCategoryItems(items, selected) {
  if (!selected) return [];
  const selectedCategories = new Set(
    (selected.categories?.length ? selected.categories : [selected.type])
      .filter(Boolean)
      .map((category) => category.toLocaleLowerCase()),
  );
  const peers = items.filter((item) => (
    item.id === selected.id
    || (item.categories?.length ? item.categories : [item.type])
      .some((category) => selectedCategories.has(category.toLocaleLowerCase()))
  ));
  return [selected, ...peers.filter((item) => item.id !== selected.id)];
}
