import type { Page, Response } from "playwright";
import { requestPinnedPublicUrl } from "./publicNetworkProxy.ts";

const DEFAULT_MAXIMUM_RESOURCES = 128;
const DEFAULT_MAXIMUM_RESOURCE_BYTES = 512 * 1_024;
const DEFAULT_MAXIMUM_TOTAL_BYTES = 8 * 1_024 * 1_024;
const MAXIMUM_SOURCE_MAPS = 16;
const MAXIMUM_SOURCE_NAMES = 512;
const MAXIMUM_SOURCE_NAME_BYTES = 512;

export interface SiteResourceEvidence {
  url: string;
  kind: "script" | "stylesheet" | "source-map";
  text: string;
}

export interface SiteResourceCollector {
  attach(page: Page): void;
  snapshot(): Promise<SiteResourceEvidence[]>;
}

export interface SiteResourceRequestResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export function createSiteResourceCollector(input: {
  validateNavigation(url: string): Promise<void>;
  maximumResources?: number;
  maximumResourceBytes?: number;
  maximumTotalBytes?: number;
  requestText?: (url: string) => Promise<SiteResourceRequestResult>;
}): SiteResourceCollector {
  const maximumResources = positiveInteger(
    input.maximumResources ?? DEFAULT_MAXIMUM_RESOURCES,
    "maximum Site resources",
  );
  const maximumResourceBytes = positiveInteger(
    input.maximumResourceBytes ?? DEFAULT_MAXIMUM_RESOURCE_BYTES,
    "maximum Site resource bytes",
  );
  const maximumTotalBytes = positiveInteger(
    input.maximumTotalBytes ?? DEFAULT_MAXIMUM_TOTAL_BYTES,
    "maximum Site resource aggregate bytes",
  );
  const requestText = input.requestText ??
    ((url: string) => requestPinnedPublicUrl(url, maximumResourceBytes));
  const retained: Array<SiteResourceEvidence & { byteLength: number }> = [];
  let totalBytes = 0;
  let queue = Promise.resolve();
  let attached = false;
  let mapsCollected = false;

  const retainResponse = async (response: Response): Promise<void> => {
    if (retained.length >= maximumResources) return;
    if (response.status() < 200 || response.status() >= 300) return;
    const resourceType = response.request().resourceType();
    if (resourceType !== "script" && resourceType !== "stylesheet") return;
    const headers = response.headers();
    const declaredLength = contentLength(headers);
    if (declaredLength !== undefined && declaredLength > maximumResourceBytes) return;
    const body = Buffer.from(await response.body().catch(() => Buffer.alloc(0)));
    if (
      body.byteLength === 0 ||
      body.byteLength > maximumResourceBytes ||
      totalBytes + body.byteLength > maximumTotalBytes
    ) return;
    retained.push({
      url: sanitizeSiteResourceUrl(response.url()),
      kind: resourceType,
      text: body.toString("utf8"),
      byteLength: body.byteLength,
    });
    totalBytes += body.byteLength;
  };

  const collectSourceMaps = async (): Promise<void> => {
    if (mapsCollected) return;
    mapsCollected = true;
    const references = unique(
      retained
        .filter((item) => item.kind === "script")
        .flatMap((item) => sourceMapReferences(item.text, item.url)),
    ).slice(0, MAXIMUM_SOURCE_MAPS);
    const responses = await Promise.all(references.map((reference) =>
      requestValidatedResource(
        reference,
        input.validateNavigation,
        requestText,
      ).catch(() => undefined)
    ));
    for (const response of responses) {
      if (retained.length >= maximumResources) break;
      if (!response || response.status < 200 || response.status >= 300) continue;
      if (
        response.body.byteLength === 0 ||
        response.body.byteLength > maximumResourceBytes ||
        totalBytes + response.body.byteLength > maximumTotalBytes
      ) continue;
      const sources = sourceMapSources(response.body.toString("utf8"));
      if (sources.length === 0) continue;
      const text = JSON.stringify(sources);
      retained.push({
        url: sanitizeSiteResourceUrl(response.url),
        kind: "source-map",
        text,
        byteLength: response.body.byteLength,
      });
      totalBytes += response.body.byteLength;
    }
  };

  return {
    attach(page) {
      if (attached) throw new Error("Site resource collector is already attached");
      attached = true;
      page.on("response", (response) => {
        queue = queue.then(() => retainResponse(response));
      });
    },
    async snapshot() {
      await queue;
      await collectSourceMaps();
      return retained.map(({ url, kind, text }) => ({ url, kind, text }));
    },
  };
}

export function sanitizeSiteResourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function sourceMapReferences(source: string, baseUrl: string): string[] {
  const references: string[] = [];
  const patterns = [
    /\/\/[#@]\s*sourceMappingURL\s*=\s*([^\s]+)/gi,
    /\/\*[#@]\s*sourceMappingURL\s*=\s*([^*\s]+)\s*\*\//gi,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const reference = match[1]?.trim().replace(/^["']|["']$/g, "");
      if (!reference || /^data:/i.test(reference)) continue;
      try {
        const resolved = new URL(reference, baseUrl);
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
        references.push(resolved.toString());
      } catch {
        // Invalid publisher source-map declarations are ignored.
      }
    }
  }
  return unique(references).slice(0, MAXIMUM_SOURCE_MAPS);
}

export function sourceMapSources(sourceMap: string): string[] {
  try {
    const parsed = JSON.parse(sourceMap) as { sources?: unknown };
    if (!Array.isArray(parsed.sources)) return [];
    return unique(parsed.sources
      .slice(0, MAXIMUM_SOURCE_NAMES)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().slice(0, MAXIMUM_SOURCE_NAME_BYTES))
      .filter(Boolean));
  } catch {
    return [];
  }
}

async function requestValidatedResource(
  initialUrl: string,
  validateNavigation: (url: string) => Promise<void>,
  requestText: (url: string) => Promise<SiteResourceRequestResult>,
): Promise<SiteResourceRequestResult> {
  let currentUrl = initialUrl;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await validateNavigation(currentUrl);
    const response = await requestText(currentUrl);
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.location;
    if (!location) return response;
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error("Site source map redirected too many times");
}

function contentLength(headers: Record<string, string>): number | undefined {
  const raw = headers["content-length"];
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${label}`);
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
