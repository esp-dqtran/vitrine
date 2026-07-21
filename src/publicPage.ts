import { isIP } from "node:net";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_EDGE = 100_000;
const MAX_SECTIONS = 200;

export class PublicPageValidationError extends Error {
  constructor(message = "Invalid public page capture") {
    super(message);
    this.name = "PublicPageValidationError";
  }
}

export interface PublicPageIdentity {
  requestedUrl: string;
  sourceDomain: string;
  appSlug: string;
}

export interface PublicPageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PublicPageSection {
  position: number;
  selector: string;
  tagName: string;
  role?: string;
  heading?: string;
  text: string;
  bounds: PublicPageBounds;
}

export interface PublicPageCapture {
  requestedUrl: string;
  canonicalUrl: string;
  metadata: {
    name: string;
    description: string;
    category: string;
    accent: string;
    iconUrl?: string;
  };
  viewport: { width: 1440; height: 900 };
  document: { width: number; height: number };
  html: string;
  sections: PublicPageSection[];
}

export function canonicalPublicPageUrl(value: unknown): PublicPageIdentity {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048 || value.includes("\0")) {
    throw new PublicPageValidationError("Public page URL is invalid");
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new PublicPageValidationError("Public page URL is invalid");
  }
  const host = normalizedHost(parsed.hostname);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    !host ||
    !isPublicLiteralOrHostname(host)
  ) {
    throw new PublicPageValidationError("Public page URL must use a public HTTP(S) host");
  }
  parsed.hostname = host;
  parsed.hash = "";
  const sourceDomain = host.replace(/^www\./, "");
  const appSlug = sourceDomain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!appSlug) throw new PublicPageValidationError("Public page host is unsupported");
  return { requestedUrl: parsed.toString(), sourceDomain, appSlug };
}

export function parsePublicPageCapture(value: unknown): PublicPageCapture {
  const input = record(value);
  const requestedUrl = canonicalPublicPageUrl(input.requestedUrl).requestedUrl;
  const canonicalUrl = canonicalPublicPageUrl(input.canonicalUrl).requestedUrl;
  const metadataInput = record(input.metadata);
  const viewportInput = record(input.viewport);
  const documentInput = record(input.document);
  const width = boundedInteger(documentInput.width, 1, MAX_DOCUMENT_EDGE);
  const height = boundedInteger(documentInput.height, 1, MAX_DOCUMENT_EDGE);
  if (viewportInput.width !== 1440 || viewportInput.height !== 900) {
    throw new PublicPageValidationError("Public page viewport must be 1440 by 900");
  }
  const html = text(input.html, MAX_HTML_BYTES, false);
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new PublicPageValidationError("Public page HTML is too large");
  }
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > MAX_SECTIONS) {
    throw new PublicPageValidationError("Public page sections are invalid");
  }

  let previousBottom = -1;
  const sections = input.sections.map((raw, index): PublicPageSection => {
    const section = record(raw);
    if (section.position !== index) throw new PublicPageValidationError("Public page section order is invalid");
    const boundsInput = record(section.bounds);
    const bounds: PublicPageBounds = {
      x: boundedNumber(boundsInput.x, 0, width),
      y: boundedNumber(boundsInput.y, 0, height),
      width: boundedNumber(boundsInput.width, 1, width),
      height: boundedNumber(boundsInput.height, 1, height),
    };
    if (bounds.x + bounds.width > width || bounds.y + bounds.height > height || bounds.y < previousBottom) {
      throw new PublicPageValidationError("Public page section geometry is invalid");
    }
    previousBottom = bounds.y + bounds.height;
    const tagName = text(section.tagName, 80).toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(tagName)) {
      throw new PublicPageValidationError("Public page section tag is invalid");
    }
    const role = optionalText(section.role, 100);
    const heading = optionalText(section.heading, 200);
    return {
      position: index,
      selector: text(section.selector, 1_024),
      tagName,
      ...(role ? { role } : {}),
      ...(heading ? { heading } : {}),
      text: text(section.text, 1_000, false),
      bounds,
    };
  });

  const accent = text(metadataInput.accent, 32);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) {
    throw new PublicPageValidationError("Public page accent color is invalid");
  }
  const iconUrl = optionalText(metadataInput.iconUrl, 2_048);
  if (iconUrl) canonicalPublicPageUrl(iconUrl);
  return {
    requestedUrl,
    canonicalUrl,
    metadata: {
      name: text(metadataInput.name, 160),
      description: text(metadataInput.description, 500, false),
      category: text(metadataInput.category, 100),
      accent: accent.toLowerCase(),
      ...(iconUrl ? { iconUrl } : {}),
    },
    viewport: { width: 1440, height: 900 },
    document: { width, height },
    html,
    sections,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicPageValidationError();
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, required = true): string {
  if (typeof value !== "string") throw new PublicPageValidationError();
  const normalized = value.replace(/\s+/g, " ").trim();
  if ((required && !normalized) || normalized.length > max || normalized.includes("\0")) {
    throw new PublicPageValidationError();
  }
  return normalized;
}

function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return text(value, max);
}

function boundedInteger(value: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new PublicPageValidationError();
  }
  return value as number;
}

function boundedNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new PublicPageValidationError();
  }
  return value;
}

function normalizedHost(value: string): string {
  const trimmed = value.toLowerCase().replace(/\.$/, "");
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

function isPublicLiteralOrHostname(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  const kind = isIP(host);
  if (kind === 4) return !nonPublicIpv4(host);
  if (kind === 6) return !nonPublicIpv6(host);
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) && host.includes(".");
}

function nonPublicIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c <= 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113);
}

function nonPublicIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (/^(?:fc|fd|fe[89ab]|ff)/.test(normalized) || normalized.startsWith("2001:db8:")) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)?.[1];
  return mapped ? nonPublicIpv4(mapped) : false;
}
