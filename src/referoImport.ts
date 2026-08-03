export interface ReferoSite {
  id: number;
  domain: string;
  name: string;
  description: string | null;
}

export interface ReferoSiteDetail extends ReferoSite {
  faviconUrl: string;
  backgroundColor: string;
  categories: string[];
  screenshotsCount: number;
}

export interface ReferoRecord {
  id: number;
  width: number;
  height: number;
  url: string[];
  page_url: string | null;
  site: ReferoSite;
}

interface ReferoPagination {
  current: number;
  next: number | null;
  count: number;
}

interface ReferoSearchResponse {
  pagination: ReferoPagination;
  records: ReferoRecord[];
  searchContext: string | null;
}

export interface ReferoCapture {
  recordId: number;
  imageUrl: string;
  pageUrl: string | null;
  width: number;
  height: number;
}

export interface ReferoSiteCrawl {
  site: ReferoSite;
  captures: ReferoCapture[];
  reportedCount: number;
  complete: boolean;
  pagesFetched: number;
}

export interface ReferoFlowScreenshot {
  id: number;
  imageUrls: string[];
  previewUrl: string | null;
}

export interface ReferoFlow {
  id: number;
  name: string;
  description: string;
  site: { id: number; name: string };
  screenshots: ReferoFlowScreenshot[];
}

export interface ReferoFlowCrawl {
  flows: ReferoFlow[];
  reportedCount: number;
  complete: boolean;
  pagesFetched: number;
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

function referoHeaders(authorization?: string): Record<string, string> {
  if (authorization && !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) {
    throw new Error("Refero authorization is invalid");
  }
  return { Accept: "application/json", ...(authorization ? { Authorization: authorization } : {}) };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Refero ${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`Refero ${label} is invalid`);
  return Number(value);
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Refero ${label} is invalid`);
  return Number(value);
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new Error(`Refero ${label} is invalid`);
  }
  return value.trim();
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function trustedImageUrl(value: unknown): string {
  const raw = text(value, "image URL");
  const parsed = new URL(raw);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "images.refero.design"
    || parsed.username
    || parsed.password
    || parsed.port
  ) {
    throw new Error("Refero image URL is not trusted");
  }
  return parsed.toString();
}

function nullableTrustedImageUrl(value: unknown): string | null {
  return value === null || value === undefined ? null : trustedImageUrl(value);
}

function accentColor(value: unknown): string {
  const color = text(value, "background color");
  if (!/^[0-9a-f]{6}$/i.test(color)) throw new Error("Refero background color is invalid");
  return `#${color.toLowerCase()}`;
}

function websiteUrl(domain: string): string {
  const parsed = new URL(`https://${domain}`);
  if (parsed.hostname !== domain || parsed.port || parsed.pathname !== "/") {
    throw new Error("Refero site domain is invalid");
  }
  return parsed.toString();
}

function pageUrl(value: unknown): string | null {
  const raw = nullableText(value, "page URL");
  if (!raw) return null;
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Refero page URL is invalid");
  }
  return parsed.toString();
}

export function parseReferoSearchResponse(value: unknown): ReferoSearchResponse {
  const root = object(value, "response");
  const pagination = object(root.pagination, "pagination");
  const options = root.options === undefined ? {} : object(root.options, "options");
  const searchContext = options.search_uuid === null || options.search_uuid === undefined
    ? null
    : text(options.search_uuid, "search context");
  if (!Array.isArray(root.records)) throw new Error("Refero records are invalid");
  const records = root.records.map((candidate): ReferoRecord => {
    const record = object(candidate, "record");
    const site = object(record.site, "site");
    if (!Array.isArray(record.url) || record.url.length === 0) throw new Error("Refero image URLs are invalid");
    return {
      id: positiveInteger(record.id, "record ID"),
      width: positiveInteger(record.width, "record width"),
      height: positiveInteger(record.height, "record height"),
      url: record.url.map(trustedImageUrl),
      page_url: pageUrl(record.page_url),
      site: {
        id: positiveInteger(site.id, "site ID"),
        domain: text(site.domain, "site domain"),
        name: text(site.name, "site name"),
        description: nullableText(site.description, "site description"),
      },
    };
  });
  return {
    pagination: {
      current: positiveInteger(pagination.current, "current page"),
      next: nullablePositiveInteger(pagination.next, "next page"),
      count: positiveInteger(pagination.count, "result count"),
    },
    records,
    searchContext,
  };
}

export function parseReferoSiteDetail(value: unknown): ReferoSiteDetail {
  const site = object(value, "site detail");
  if (!Array.isArray(site.categories)) throw new Error("Refero site categories are invalid");
  const domain = text(site.domain, "site domain").toLowerCase();
  websiteUrl(domain);
  return {
    id: positiveInteger(site.id, "site ID"),
    domain,
    name: text(site.name, "site name"),
    description: nullableText(site.description, "site description"),
    faviconUrl: trustedImageUrl(site.favicon_url),
    backgroundColor: accentColor(site.background_color),
    categories: site.categories.map((candidate) => {
      const category = object(candidate, "site category");
      positiveInteger(category.id, "category ID");
      return text(category.name, "category name");
    }),
    screenshotsCount: positiveInteger(site.screenshots_count, "screenshot count"),
  };
}

interface ReferoFlowSearchResponse {
  pagination: ReferoPagination;
  records: ReferoFlow[];
  searchContext: string | null;
}

export function parseReferoFlowSearchResponse(value: unknown): ReferoFlowSearchResponse {
  const root = object(value, "flow response");
  const pagination = object(root.pagination, "flow pagination");
  const options = root.options === undefined ? {} : object(root.options, "flow options");
  const searchContext = options.search_uuid === null || options.search_uuid === undefined
    ? null
    : text(options.search_uuid, "flow search context");
  if (!Array.isArray(root.records)) throw new Error("Refero flow records are invalid");
  const records = root.records.map((candidate): ReferoFlow => {
    const flow = object(candidate, "flow");
    const site = object(flow.site, "flow site");
    if (!Array.isArray(flow.screenshots) || flow.screenshots.length === 0) {
      throw new Error("Refero flow screenshots are invalid");
    }
    return {
      id: positiveInteger(flow.id, "flow ID"),
      name: text(flow.name, "flow name"),
      description: flow.description === null || flow.description === undefined
        ? ""
        : typeof flow.description === "string" && !flow.description.includes("\0")
          ? flow.description.trim()
          : (() => { throw new Error("Refero flow description is invalid"); })(),
      site: {
        id: positiveInteger(site.id, "flow site ID"),
        name: text(site.name, "flow site name"),
      },
      screenshots: flow.screenshots.map((candidateScreenshot): ReferoFlowScreenshot => {
        const screenshot = object(candidateScreenshot, "flow screenshot");
        const rawUrls = Array.isArray(screenshot.url) ? screenshot.url : [screenshot.url];
        if (rawUrls.length === 0) throw new Error("Refero flow screenshot URLs are invalid");
        return {
          id: positiveInteger(screenshot.id, "flow screenshot ID"),
          imageUrls: rawUrls.map(trustedImageUrl),
          previewUrl: nullableTrustedImageUrl(screenshot.preview_url),
        };
      }),
    };
  });
  return {
    pagination: {
      current: positiveInteger(pagination.current, "flow current page"),
      next: nullablePositiveInteger(pagination.next, "flow next page"),
      count: nonnegativeInteger(pagination.count, "flow result count"),
    },
    records,
    searchContext,
  };
}

export async function fetchReferoSiteDetail(
  siteId: number,
  fetcher: Fetcher = fetch,
  authorization?: string,
): Promise<ReferoSiteDetail> {
  positiveInteger(siteId, "site ID");
  const result = await fetcher(`https://api.refero.design/v1/sites/${siteId}`, {
    headers: referoHeaders(authorization),
  });
  if (!result.ok) throw new Error(`Refero site detail failed (${result.status})`);
  const detail = parseReferoSiteDetail(await result.json());
  if (detail.id !== siteId) throw new Error("Refero returned another site detail");
  return detail;
}

export function referoWebsiteUrl(site: Pick<ReferoSite, "domain">): string {
  return websiteUrl(site.domain.toLowerCase());
}

function responseFingerprint(response: ReferoSearchResponse): string {
  return response.records.map((record) => `${record.id}:${record.url.join(",")}`).join("|");
}

export async function crawlReferoSite(
  siteId: number,
  fetcher: Fetcher = fetch,
  maxPages = 100,
  authorization?: string,
): Promise<ReferoSiteCrawl> {
  positiveInteger(siteId, "site ID");
  positiveInteger(maxPages, "page limit");
  const captures: ReferoCapture[] = [];
  const seenImages = new Set<string>();
  const seenPages = new Set<string>();
  let requestedPage = 1;
  let site: ReferoSite | undefined;
  let reportedCount = 0;
  let pagesFetched = 0;
  let complete = false;
  let searchContext: string | null = null;

  const headers = referoHeaders(authorization);

  while (pagesFetched < maxPages) {
    const endpoint = new URL("https://api.refero.design/v1/search");
    endpoint.searchParams.append("site_id[id][]", String(siteId));
    if (requestedPage > 1) endpoint.searchParams.set("page", String(requestedPage));
    if (searchContext) endpoint.searchParams.set("search_uuid", searchContext);
    const result = await fetcher(endpoint, {
      headers,
    });
    if (!result.ok) throw new Error(`Refero search failed (${result.status})`);
    const response = parseReferoSearchResponse(await result.json());
    pagesFetched += 1;
    const fingerprint = responseFingerprint(response);
    if (seenPages.has(fingerprint)) break;
    seenPages.add(fingerprint);
    searchContext ??= response.searchContext;
    reportedCount = response.pagination.count;

    for (const record of response.records) {
      if (record.site.id !== siteId) throw new Error("Refero returned a record for another site");
      site ??= record.site;
      if (site.id !== record.site.id || site.domain !== record.site.domain || site.name !== record.site.name) {
        throw new Error("Refero returned inconsistent site metadata");
      }
      for (const imageUrl of record.url) {
        if (seenImages.has(imageUrl)) continue;
        seenImages.add(imageUrl);
        captures.push({
          recordId: record.id,
          imageUrl,
          pageUrl: record.page_url,
          width: record.width,
          height: record.height,
        });
      }
    }

    if (response.pagination.next === null) {
      complete = true;
      break;
    }
    requestedPage = response.pagination.next;
  }

  if (!site || captures.length === 0) throw new Error(`Refero site ${siteId} returned no captures`);
  return { site, captures, reportedCount, complete, pagesFetched };
}

function flowResponseFingerprint(response: ReferoFlowSearchResponse): string {
  return response.records.map((flow) => `${flow.id}:${flow.screenshots
    .map((screenshot) => screenshot.imageUrls.join(","))
    .join("|")}`).join(";");
}

export async function crawlReferoFlows(
  siteId: number,
  fetcher: Fetcher = fetch,
  maxPages = 100,
  authorization?: string,
): Promise<ReferoFlowCrawl> {
  positiveInteger(siteId, "site ID");
  positiveInteger(maxPages, "flow page limit");
  const flows: ReferoFlow[] = [];
  const seenFlowIds = new Set<number>();
  const seenPages = new Set<string>();
  const headers = referoHeaders(authorization);
  let requestedPage = 1;
  let pagesFetched = 0;
  let reportedCount = 0;
  let searchContext: string | null = null;

  while (pagesFetched < maxPages) {
    const endpoint = new URL("https://api.refero.design/v1/search_flow");
    endpoint.searchParams.append("site_id[id][]", String(siteId));
    endpoint.searchParams.set("order", "trending");
    if (requestedPage > 1) endpoint.searchParams.set("page", String(requestedPage));
    if (searchContext) endpoint.searchParams.set("search_uuid", searchContext);
    const result = await fetcher(endpoint, { headers });
    if (!result.ok) throw new Error(`Refero flow search failed (${result.status})`);
    const response = parseReferoFlowSearchResponse(await result.json());
    pagesFetched += 1;
    reportedCount = response.pagination.count;
    searchContext ??= response.searchContext;
    const fingerprint = flowResponseFingerprint(response);
    if (seenPages.has(fingerprint)) break;
    seenPages.add(fingerprint);

    for (const flow of response.records) {
      if (flow.site.id !== siteId) throw new Error("Refero returned a flow for another site");
      if (seenFlowIds.has(flow.id)) continue;
      seenFlowIds.add(flow.id);
      flows.push(flow);
    }
    if (response.pagination.next === null) break;
    requestedPage = response.pagination.next;
  }

  return {
    flows,
    reportedCount,
    complete: flows.length === reportedCount,
    pagesFetched,
  };
}

export function referoAppSlug(site: Pick<ReferoSite, "domain" | "name">): string {
  const source = site.name.trim() || site.domain.split(".")[0];
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "refero-app";
}
