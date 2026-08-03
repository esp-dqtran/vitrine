import { createHash } from "node:crypto";
import type {
  DesignComponent,
  DesignSystemSnapshot,
  DesignToken,
  TokenKind,
} from "./designSystem.ts";

const REFERO_ORIGIN = "https://styles.refero.design";

type JsonObject = Record<string, unknown>;

export interface ReferoSitemapEntry {
  id: string;
  url: string;
  lastModified?: string;
  imageUrl?: string;
}

export interface ReferoStyleResult {
  meta: {
    url: string;
    siteName: string;
    extractedAt?: string;
    viewport?: { width?: number; height?: number };
    [key: string]: unknown;
  };
  raw?: JsonObject;
  designSystem: JsonObject;
  screenshot?: { url?: string; thumbnail?: string };
  [key: string]: unknown;
}

export interface ReferoArchiveRecord {
  schemaVersion: 1;
  id: string;
  sourceUrl: string;
  sitemapLastModified?: string;
  fetchedAt: string;
  contentHash: string;
  jsonLd?: JsonObject;
  result: ReferoStyleResult;
  snapshot: DesignSystemSnapshot;
}

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter((item): item is string => Boolean(item)) : [];
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function tag(block: string, name: string): string | undefined {
  const match = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
  return match ? decodeXml(match[1].trim()) : undefined;
}

export function parseReferoSitemap(xml: string): ReferoSitemapEntry[] {
  const entries: ReferoSitemapEntry[] = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = tag(match[1], "loc");
    if (!url) continue;
    const id = /\/style\/([a-f0-9-]+)\/?$/i.exec(url)?.[1];
    if (!id) continue;
    entries.push({
      id,
      url,
      lastModified: tag(match[1], "lastmod"),
      imageUrl: tag(match[1], "image:loc"),
    });
  }
  return entries;
}

function decodedFlightPayloads(html: string): string[] {
  const payloads: string[] = [];
  for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const push = /^self\.__next_f\.push\((\[[\s\S]*\])\)$/.exec(script[1].trim());
    if (!push) continue;
    try {
      const frame = JSON.parse(push[1]) as unknown[];
      if (typeof frame[1] === "string") payloads.push(frame[1]);
    } catch {
      // Ignore unrelated or partially streamed script frames.
    }
  }
  return payloads;
}

function findResult(value: unknown): ReferoStyleResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as JsonObject;
  const candidate = object(item.result);
  if (candidate && object(candidate.meta) && object(candidate.designSystem)) {
    return candidate as unknown as ReferoStyleResult;
  }
  for (const child of Array.isArray(value) ? value : Object.values(item)) {
    const found = findResult(child);
    if (found) return found;
  }
  return undefined;
}

function extractResult(html: string): ReferoStyleResult {
  for (const payload of decodedFlightPayloads(html)) {
    if (!payload.includes('"result"')) continue;
    const separator = payload.indexOf(":");
    if (separator < 1) continue;
    try {
      const found = findResult(JSON.parse(payload.slice(separator + 1)));
      if (found) return found;
    } catch {
      // A different React Flight chunk may contain the complete result.
    }
  }
  throw new Error("Refero page does not contain a structured style result");
}

function extractJsonLd(html: string): JsonObject | undefined {
  const match = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return undefined;
  try {
    return object(JSON.parse(match[1]));
  } catch {
    return undefined;
  }
}

function token(
  kind: TokenKind,
  name: string,
  value: string,
  role: string,
  suffix = "",
): DesignToken {
  return {
    id: `${kind}-${slug(name)}${suffix}`,
    kind,
    name,
    value,
    role,
    evidence: [],
    source: "external_import",
  };
}

function colorTokens(system: JsonObject): DesignToken[] {
  const seen = new Set<string>();
  const colors: DesignToken[] = [];
  for (const entry of Array.isArray(system.colors) ? system.colors : []) {
    const item = object(entry);
    const value = text(item?.hex);
    const name = text(item?.name);
    if (!item || !value || !name) continue;
    const key = `${name.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(token("color", name, value, text(item.role) ?? text(item.group) ?? "Imported color token"));
  }
  return colors;
}

function typographyTokens(system: JsonObject): DesignToken[] {
  const tokens: DesignToken[] = [];
  for (const entry of Array.isArray(system.typography) ? system.typography : []) {
    const item = object(entry);
    const family = text(item?.family);
    if (!item || !family) continue;
    const declarations = [
      `font-family: ${family}`,
      text(item.weight) ? `font-weight: ${text(item.weight)}` : undefined,
      text(item.sizes) ? `font-size: ${text(item.sizes)}` : undefined,
      text(item.lineHeight) ? `line-height: ${text(item.lineHeight)}` : undefined,
      text(item.letterSpacing) ? `letter-spacing: ${text(item.letterSpacing)}` : undefined,
    ].filter(Boolean).join("; ");
    tokens.push(token("typography", family, declarations, text(item.role) ?? "Imported typography family"));
  }
  for (const entry of Array.isArray(system.typeScale) ? system.typeScale : []) {
    const item = object(entry);
    const role = text(item?.role);
    const size = typeof item?.size === "number" ? item.size : undefined;
    if (!item || !role || size == null) continue;
    const value = [
      `font-size: ${size}px`,
      typeof item.lineHeight === "number" ? `line-height: ${item.lineHeight}` : undefined,
      typeof item.letterSpacing === "number" ? `letter-spacing: ${item.letterSpacing}px` : undefined,
    ].filter(Boolean).join("; ");
    tokens.push(token("typography", role, value, `Imported ${role} type-scale step`, "-scale"));
  }
  return tokens;
}

function foundationTokens(system: JsonObject): DesignToken[] {
  const spacing = object(system.spacing);
  if (!spacing) return [];
  const tokens: DesignToken[] = [];
  for (const [name, value] of Object.entries(spacing)) {
    if (name === "radius") continue;
    const rendered = typeof value === "number" || typeof value === "string" ? String(value) : undefined;
    if (rendered) tokens.push(token("spacing", name, rendered, `Imported ${name} spacing value`));
  }
  for (const [name, value] of Object.entries(object(spacing.radius) ?? {})) {
    const rendered = typeof value === "number" || typeof value === "string" ? String(value) : undefined;
    if (rendered) tokens.push(token("radius", name, rendered, `Imported ${name} radius`));
  }
  const elevation = text(system.elevationPhilosophy);
  if (elevation) tokens.push(token("effect", "Elevation philosophy", "documented", elevation));
  return tokens;
}

function components(system: JsonObject): DesignComponent[] {
  return (Array.isArray(system.components) ? system.components : []).flatMap((entry) => {
    const item = object(entry);
    const name = text(item?.name);
    if (!item || !name) return [];
    const description = text(item.description) ?? text(item.role) ?? "Imported Refero component guidance";
    return [{
      id: slug(name),
      name,
      category: "Refero components",
      description,
      variants: [{
        id: `${slug(name)}-reference`,
        name: "Reference",
        description,
        evidence: [],
        observedProperties: text(item.role) ? [text(item.role)!] : undefined,
        source: "external_import" as const,
      }],
    }];
  });
}

function rules(system: JsonObject): NonNullable<DesignSystemSnapshot["rules"]> {
  const result: NonNullable<DesignSystemSnapshot["rules"]> = [];
  const add = (kind: "layout" | "imagery" | "content", name: string, description: string) => result.push({
    id: `${kind}-${slug(name)}-${result.length + 1}`,
    kind,
    name,
    description,
    evidence: [],
    source: "external_import",
  });
  const layout = text(system.layout);
  const imagery = text(system.imagery);
  const elevation = text(system.elevationPhilosophy);
  if (layout) add("layout", "Layout", layout);
  if (imagery) add("imagery", "Imagery", imagery);
  if (elevation) add("layout", "Elevation", elevation);
  for (const item of textList(system.dos)) add("content", "Do", item);
  for (const item of textList(system.donts)) add("content", "Don't", item);
  return result;
}

export function referoAppSlug(result: ReferoStyleResult, id: string): string {
  const siteName = slug(result.meta.siteName);
  if (siteName && siteName !== "item") return siteName;
  try {
    const host = new URL(result.meta.url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    if (base) return slug(base);
  } catch {
    // Fall back to the Refero site name.
  }
  return slug(result.meta.siteName || `refero-${id}`);
}

export function normalizeReferoDesignSystem(
  id: string,
  sourceUrl: string,
  result: ReferoStyleResult,
  fetchedAt: string,
  upstreamModifiedAt?: string,
): DesignSystemSnapshot {
  const system = result.designSystem;
  const theme = system.theme === "light" || system.theme === "dark" ? system.theme : undefined;
  const app = referoAppSlug(result, id);
  return {
    app,
    generatedAt: text(result.meta.extractedAt) ?? fetchedAt,
    summary: text(system.description) ?? text(system.northStar),
    provenance: {
      provider: "refero",
      externalId: id,
      sourceUrl,
      originalUrl: result.meta.url,
      screenshotUrl: text(result.screenshot?.url),
      thumbnailUrl: text(result.screenshot?.thumbnail),
      importedAt: fetchedAt,
      upstreamModifiedAt,
      attribution: "Imported from Refero Styles",
      theme,
      northStar: text(system.northStar),
      industry: text(system.industry),
    },
    tokens: [...colorTokens(system), ...typographyTokens(system), ...foundationTokens(system)],
    components: components(system),
    flows: [],
    rules: rules(system),
  };
}

export function parseReferoStylePage(
  html: string,
  sourceUrl: string,
  fetchedAt: string,
  sitemapLastModified?: string,
): ReferoArchiveRecord {
  const id = /\/style\/([a-f0-9-]+)\/?$/i.exec(sourceUrl)?.[1];
  if (!id) throw new Error(`Invalid Refero style URL: ${sourceUrl}`);
  const result = extractResult(html);
  if (!result.meta.url || !result.meta.siteName) throw new Error(`Refero style ${id} is missing site metadata`);
  const contentHash = createHash("sha256").update(JSON.stringify(result)).digest("hex");
  return {
    schemaVersion: 1,
    id,
    sourceUrl,
    sitemapLastModified,
    fetchedAt,
    contentHash,
    jsonLd: extractJsonLd(html),
    result,
    snapshot: normalizeReferoDesignSystem(id, sourceUrl, result, fetchedAt, sitemapLastModified),
  };
}

export const REFERO_STYLES_SITEMAP = `${REFERO_ORIGIN}/sitemaps/styles.xml`;
