import type { SeoMetadata } from "../seoMetadata.ts";
import { metadataForPath } from "../seoMetadata.ts";

const ensureMeta = (attribute: "name" | "property", key: string): HTMLMetaElement => {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const meta = document.createElement("meta");
  meta.setAttribute(attribute, key);
  document.head.append(meta);
  return meta;
};

const setMeta = (attribute: "name" | "property", key: string, content: string) => {
  ensureMeta(attribute, key).content = content;
};

const setCanonical = (href: string) => {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const link = existing ?? document.createElement("link");
  link.rel = "canonical";
  link.href = href;
  if (!existing) document.head.append(link);
};

const setJsonLd = (value: SeoMetadata["jsonLd"]) => {
  const existing = document.head.querySelector<HTMLScriptElement>('script[data-vitrines-seo="jsonld"]');
  if (!value) {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.vitrinesSeo = "jsonld";
  script.textContent = JSON.stringify(value);
  if (!existing) document.head.append(script);
};

export function applySeoMetadata(metadata: SeoMetadata): void {
  document.title = metadata.title;
  setMeta("name", "description", metadata.description);
  setMeta("name", "robots", metadata.robots);
  setCanonical(`${window.location.origin}${metadata.canonicalPath}`);
  setMeta("property", "og:type", metadata.ogType ?? "website");
  setMeta("property", "og:site_name", "Vitrines");
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:url", `${window.location.origin}${metadata.canonicalPath}`);
  setMeta("property", "og:image", metadata.image ?? `${window.location.origin}/landing/vitrines-social-card-v6.png`);
  setMeta("property", "og:image:alt", `${metadata.title} — Vitrines`);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", metadata.title);
  setMeta("name", "twitter:description", metadata.description);
  setMeta("name", "twitter:image", metadata.image ?? `${window.location.origin}/landing/vitrines-social-card-v6.png`);
  setMeta("name", "twitter:image:alt", `${metadata.title} — Vitrines`);
  setJsonLd(metadata.jsonLd);
}

export function applyRouteSeo(pathname: string, search = ""): void {
  applySeoMetadata(metadataForPath(pathname, search));
}
