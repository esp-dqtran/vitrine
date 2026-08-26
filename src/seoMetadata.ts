export const SITE_ORIGIN = "https://vitrines.ai";
export const SITE_NAME = "Vitrines";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/landing/vitrines-social-card-v6.png`;

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  robots: "index, follow" | "noindex, nofollow";
  ogType?: "website" | "article";
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const DEFAULT_DESCRIPTION =
  "Explore real apps, sites, screens, flows, and UI patterns. Turn product evidence into decisions and shareable handoff with Vitrines.";

const trimSlug = (value: string, fallback: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 120) : fallback;
};

const pathForApp = (appId: string) => `/browse/${encodeURIComponent(appId)}`;
const pathForSite = (siteSlug: string) => `/browse/sites/${encodeURIComponent(siteSlug)}`;
const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function metadataForPath(pathname: string, search = ""): SeoMetadata {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const hasQuery = Boolean(search && search !== "?");

  if (normalizedPath === "/" || normalizedPath === "/landing") {
    return {
      title: "Vitrines — Product research for decisions that ship",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: "/",
      robots: "index, follow",
      ogType: "website",
      image: DEFAULT_SOCIAL_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
      },
    };
  }

  if (normalizedPath === "/browse") {
    return {
      title: "Browse app references — Vitrines",
      description: "Browse captured apps, screens, flows, and product patterns across iOS, Android, and the web.",
      canonicalPath: "/browse",
      robots: hasQuery ? "noindex, nofollow" : "index, follow",
      ogType: "website",
      image: DEFAULT_SOCIAL_IMAGE,
    };
  }

  if (normalizedPath === "/browse/flows") {
    return {
      title: "Product flows and user journeys — Vitrines",
      description: "Explore observed product flows and user journeys captured from real apps.",
      canonicalPath: "/browse/flows",
      robots: hasQuery ? "noindex, nofollow" : "index, follow",
      ogType: "website",
      image: DEFAULT_SOCIAL_IMAGE,
    };
  }

  if (normalizedPath === "/browse/sites") {
    return {
      title: "Website design references — Vitrines",
      description: "Browse real website captures, pages, sections, styles, and design patterns.",
      canonicalPath: "/browse/sites",
      robots: hasQuery ? "noindex, nofollow" : "index, follow",
      ogType: "website",
      image: DEFAULT_SOCIAL_IMAGE,
    };
  }

  const appMatch = normalizedPath.match(/^\/browse\/([^/]+)$/);
  if (appMatch) {
    const appId = decodePathSegment(appMatch[1]);
    const titleName = trimSlug(appId, "App reference");
    return {
      title: `${titleName} app reference — Vitrines`,
      description: `Explore captured screens, flows, and UI patterns from ${titleName} in the Vitrines product research catalog.`,
      canonicalPath: pathForApp(appId),
      robots: hasQuery ? "noindex, nofollow" : "index, follow",
      ogType: "article",
      image: DEFAULT_SOCIAL_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${titleName} app reference`,
        url: `${SITE_ORIGIN}${pathForApp(appId)}`,
        description: `Captured product research references for ${titleName}.`,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_ORIGIN}/` },
      },
    };
  }

  const siteMatch = normalizedPath.match(/^\/browse\/sites\/([^/]+)$/);
  if (siteMatch) {
    const siteSlug = decodePathSegment(siteMatch[1]);
    const titleName = trimSlug(siteSlug.replace(/-\d+$/, "").replace(/-/g, " "), "Website reference");
    return {
      title: `${titleName} website reference — Vitrines`,
      description: `Explore captured pages, sections, and design patterns from ${titleName} in the Vitrines website reference catalog.`,
      canonicalPath: pathForSite(siteSlug),
      robots: hasQuery ? "noindex, nofollow" : "index, follow",
      ogType: "article",
      image: DEFAULT_SOCIAL_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${titleName} website reference`,
        url: `${SITE_ORIGIN}${pathForSite(siteSlug)}`,
        description: `Captured website design references for ${titleName}.`,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_ORIGIN}/` },
      },
    };
  }

  const indexedStaticPages: Record<string, Pick<SeoMetadata, "title" | "description">> = {
    "/pricing": {
      title: "Vitrines pricing — Product research that ships",
      description: "Choose the Vitrines plan for product research, captured references, flows, and design handoff.",
    },
    "/browse/pricing": {
      title: "Vitrines pricing — Product research that ships",
      description: "Choose the Vitrines plan for product research, captured references, flows, and design handoff.",
    },
    "/build-in-public": {
      title: "Building Vitrines in public",
      description: "Follow the work behind Vitrines, a product research catalog built around evidence that teams can use.",
    },
    "/browse/build-in-public": {
      title: "Building Vitrines in public",
      description: "Follow the work behind Vitrines, a product research catalog built around evidence that teams can use.",
    },
    "/terms": {
      title: "Terms of Service — Vitrines",
      description: "The Vitrines Terms of Service.",
    },
    "/privacy": {
      title: "Privacy Policy — Vitrines",
      description: "The Vitrines Privacy Policy.",
    },
    "/refunds": {
      title: "Refund Policy — Vitrines",
      description: "The Vitrines Refund Policy.",
    },
    "/components": {
      title: "UI component references — Vitrines",
      description: "Explore reconstructed UI component references and observed product patterns in Vitrines.",
    },
  };
  const staticPage = indexedStaticPages[normalizedPath];
  if (staticPage) {
    return {
      ...staticPage,
      canonicalPath: normalizedPath,
      robots: "index, follow",
      ogType: "website",
      image: DEFAULT_SOCIAL_IMAGE,
    };
  }

  return {
    title: "Vitrines — Product research for decisions that ship",
    description: DEFAULT_DESCRIPTION,
    canonicalPath: normalizedPath,
    robots: "noindex, nofollow",
    ogType: "website",
    image: DEFAULT_SOCIAL_IMAGE,
  };
}

export function metadataForApp(
  app: {
    id: string;
    app: string;
    description?: string | null;
    iconUrl?: string | null;
    websiteUrl?: string | null;
    categories?: Array<{ name: string }>;
    platforms?: readonly string[];
  },
  search = "",
): SeoMetadata {
  const base = metadataForPath(pathForApp(app.id), search);
  const titleName = trimSlug(app.app, app.id);
  const description = trimSlug(
    app.description ?? `Explore captured screens, flows, and UI patterns from ${titleName}.`,
    base.description,
  );
  return {
    ...base,
    title: `${titleName} app reference — Vitrines`,
    description,
    image: app.iconUrl ?? DEFAULT_SOCIAL_IMAGE,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${titleName} app reference`,
      url: `${SITE_ORIGIN}${pathForApp(app.id)}`,
      description,
      image: app.iconUrl ?? undefined,
      about: {
        "@type": "SoftwareApplication",
        name: titleName,
        applicationCategory: app.categories?.map((category) => category.name).join(", ") || "BusinessApplication",
        operatingSystem: app.platforms?.join(", ") || "Web",
        url: app.websiteUrl ?? undefined,
      },
    },
  };
}

export function metadataForSite(
  site: {
    routeSlug: string;
    name: string;
    description?: string;
    logoUrl?: string | null;
    sourceUrl?: string;
  },
  search = "",
): SeoMetadata {
  const base = metadataForPath(pathForSite(site.routeSlug), search);
  const description = trimSlug(
    site.description ?? `Explore captured pages, sections, and design patterns from ${site.name}.`,
    base.description,
  );
  return {
    ...base,
    title: `${site.name} website reference — Vitrines`,
    description,
    image: site.logoUrl ?? DEFAULT_SOCIAL_IMAGE,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${site.name} website reference`,
      url: `${SITE_ORIGIN}${pathForSite(site.routeSlug)}`,
      description,
      image: site.logoUrl ?? undefined,
      about: { "@type": "WebSite", name: site.name, url: site.sourceUrl ?? undefined },
    },
  };
}
