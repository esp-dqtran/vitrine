import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { BrowserContext, Page, Response } from "playwright";
import { launchMobbinContext, type MobbinContextOptions } from "./crawler.ts";
import {
  siteObjectKey,
  type ObjectMetadata,
  type ObjectStore,
  type StoredContentType,
} from "./objectStore.ts";
import {
  canonicalMobbinSitesUrl,
  parseSiteImport,
  type SiteImport,
} from "./sites.ts";
import { decodeMobbinSitesSource } from "./sitesSource.ts";
import type { CompletedSiteImport, SitesStore } from "./sitesStore.ts";

const MAX_MEDIA_BYTES = 64 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 45_000;

export class SiteImportCancelledError extends Error {
  constructor() {
    super("Site import cancelled");
    this.name = "SiteImportCancelledError";
  }
}

export class PermanentSiteImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentSiteImportError";
  }
}

export interface DownloadedSiteAsset {
  body: Buffer;
  contentType: string;
  contentLength?: number;
  finalUrl?: string;
}

export interface SitesCrawlerDependencies {
  captureSource(url: string): Promise<SiteImport>;
  download(url: string): Promise<DownloadedSiteAsset>;
  objectStore: ObjectStore;
  sitesStore: Pick<SitesStore, "beginImport" | "completeImport" | "failImport">;
  isCancelled(): Promise<boolean>;
  report?(message: string): Promise<void>;
}

export interface MobbinSitesBrowserPorts {
  captureSource(url: string): Promise<SiteImport>;
  download(url: string): Promise<DownloadedSiteAsset>;
  close(): Promise<void>;
}

export async function crawlMobbinSite(
  url: string,
  deps: SitesCrawlerDependencies,
): Promise<{
  siteId: number;
  versionId: number;
  pageCount: number;
  sectionCount: number;
}> {
  const identity = canonicalMobbinSitesUrl(url);
  await assertNotCancelled(deps);
  await deps.report?.("Inspecting Site");
  const graph = parseSiteImport(await deps.captureSource(identity.canonicalUrl));
  await assertNotCancelled(deps);
  await deps.sitesStore.beginImport(identity, graph);

  try {
    const objects = new Map<string, ObjectMetadata>();
    const objectKeys: CompletedSiteImport["objectKeys"] = {
      source: "",
      preview: "",
      pages: {},
      sections: {},
    };

    await assertNotCancelled(deps);
    const normalizedSource = Buffer.from(JSON.stringify(graph));
    if (normalizedSource.byteLength > MAX_MEDIA_BYTES) {
      throw new PermanentSiteImportError("Mobbin Sites source exceeds the 64 MiB media ceiling");
    }
    const sourceMetadata = await putVerifiedObject(deps.objectStore, {
      key: siteObjectKey(
        identity.sourceSiteId,
        identity.sourceVersionId,
        "source",
        "graph",
        sha256(normalizedSource),
        "json",
      ),
      body: normalizedSource,
      contentType: "application/json",
      accessClass: "internal",
    });
    objectKeys.source = sourceMetadata.key;
    objects.set(sourceMetadata.key, sourceMetadata);

    await deps.report?.("Saving Site preview");
    const preview = await downloadAndStore(
      deps,
      identity,
      "preview",
      "preview",
      graph.version.previewVideoUrl,
    );
    objectKeys.preview = preview.key;
    objects.set(preview.key, preview);

    for (const page of graph.pages) {
      await deps.report?.(`Saving Site page ${page.position + 1}/${graph.pages.length}`);
      const pageObject = await downloadAndStore(
        deps,
        identity,
        "page",
        page.sourceId,
        page.fullPageImageUrl,
      );
      objectKeys.pages[page.sourceId] = pageObject.key;
      objects.set(pageObject.key, pageObject);

      for (const section of page.sections) {
        const media = await downloadAndStore(
          deps,
          identity,
          "section",
          section.sourceId,
          section.mediaUrl,
        );
        objects.set(media.key, media);
        let poster: string | undefined;
        if (section.posterUrl) {
          if (section.posterUrl === page.fullPageImageUrl) {
            poster = pageObject.key;
          } else {
            const posterObject = await downloadAndStore(
              deps,
              identity,
              "poster",
              section.sourceId,
              section.posterUrl,
            );
            objects.set(posterObject.key, posterObject);
            poster = posterObject.key;
          }
        }
        objectKeys.sections[section.sourceId] = {
          media: media.key,
          ...(poster ? { poster } : {}),
        };
      }
    }

    await assertNotCancelled(deps);
    await deps.report?.("Finalizing Site import");
    const completedInput: CompletedSiteImport = { identity, graph, objectKeys };
    const completed = await deps.sitesStore.completeImport(
      completedInput,
      [...objects.values()],
    );
    return {
      ...completed,
      pageCount: graph.pages.length,
      sectionCount: graph.pages.reduce((total, page) => total + page.sections.length, 0),
    };
  } catch (error) {
    await deps.sitesStore
      .failImport(identity.canonicalUrl, safeImportFailure(error))
      .catch(() => undefined);
    throw error;
  }
}

async function downloadAndStore(
  deps: SitesCrawlerDependencies,
  identity: ReturnType<typeof canonicalMobbinSitesUrl>,
  kind: "preview" | "page" | "section" | "poster",
  recordIdentity: string,
  url: string,
): Promise<ObjectMetadata> {
  await assertNotCancelled(deps);
  assertPublicHttpsUrl(url);
  const downloaded = await deps.download(url);
  const finalUrl = downloaded.finalUrl ?? url;
  assertPublicHttpsUrl(finalUrl);
  const body = Buffer.from(downloaded.body);
  if (
    downloaded.contentLength !== undefined &&
    (!Number.isSafeInteger(downloaded.contentLength) ||
      downloaded.contentLength <= 0 ||
      downloaded.contentLength > MAX_MEDIA_BYTES)
  ) {
    throw new PermanentSiteImportError("Mobbin Site media has an invalid declared size");
  }
  if (body.byteLength === 0 || body.byteLength > MAX_MEDIA_BYTES) {
    throw new PermanentSiteImportError("Mobbin Site media exceeds the 64 MiB media ceiling");
  }
  if (
    downloaded.contentLength !== undefined &&
    downloaded.contentLength !== body.byteLength
  ) {
    throw new PermanentSiteImportError("Mobbin Site media byte size changed during download");
  }
  const media = verifiedMediaType(downloaded.contentType, body);
  return putVerifiedObject(deps.objectStore, {
    key: siteObjectKey(
      identity.sourceSiteId,
      identity.sourceVersionId,
      kind,
      recordIdentity,
      sha256(body),
      media.extension,
    ),
    body,
    contentType: media.contentType,
    accessClass: "protected",
  });
}

async function putVerifiedObject(
  objectStore: ObjectStore,
  input: {
    key: string;
    body: Buffer;
    contentType: StoredContentType;
    accessClass: ObjectMetadata["accessClass"];
  },
): Promise<ObjectMetadata> {
  const metadata: ObjectMetadata = {
    key: input.key,
    sha256: sha256(input.body),
    byteSize: input.body.byteLength,
    contentType: input.contentType,
    accessClass: input.accessClass,
  };
  const stored = await objectStore.put({ ...metadata, body: input.body });
  if (
    stored.metadata.key !== metadata.key ||
    stored.metadata.sha256 !== metadata.sha256 ||
    stored.metadata.byteSize !== metadata.byteSize ||
    stored.metadata.contentType !== metadata.contentType ||
    stored.metadata.accessClass !== metadata.accessClass
  ) {
    throw new Error("Object store returned different Site metadata");
  }
  return stored.metadata;
}

function verifiedMediaType(
  value: string,
  body: Buffer,
): { contentType: "image/png" | "image/jpeg" | "image/webp" | "video/mp4"; extension: "png" | "jpg" | "webp" | "mp4" } {
  const contentType = value.split(";", 1)[0].trim().toLowerCase();
  if (
    contentType === "image/png" &&
    body.length >= 8 &&
    body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType, extension: "png" };
  }
  if (
    contentType === "image/jpeg" &&
    body.length >= 3 &&
    body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
  ) {
    return { contentType, extension: "jpg" };
  }
  if (
    contentType === "image/webp" &&
    body.length >= 12 &&
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { contentType, extension: "webp" };
  }
  if (
    contentType === "video/mp4" &&
    body.length >= 8 &&
    body.toString("ascii", 4, 8) === "ftyp"
  ) {
    return { contentType, extension: "mp4" };
  }
  throw new PermanentSiteImportError("Mobbin Site media type or signature is unsupported");
}

async function assertNotCancelled(deps: SitesCrawlerDependencies): Promise<void> {
  if (await deps.isCancelled()) throw new SiteImportCancelledError();
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function safeImportFailure(error: unknown): string {
  if (error instanceof SiteImportCancelledError) return "Site import cancelled";
  if (error instanceof PermanentSiteImportError) return error.message.slice(0, 500);
  return "Site import failed";
}

function assertPublicHttpsUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PermanentSiteImportError("Mobbin Site media URL is invalid");
  }
  const rawHost = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const host = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1)
    : rawHost;
  const ip = isIP(host);
  const privateIpv4 = ip === 4 && nonPublicIpv4(host);
  const privateIpv6 = ip === 6 && (
    host === "::" || host === "::1" || /^(?:fc|fd|fe[89ab]|ff)/i.test(host)
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    [...parsed.searchParams.keys()].some((key) =>
      /(?:auth|credential|enc|expires|key|password|policy|secret|signature|token)/i.test(key)
    ) ||
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    privateIpv4 ||
    privateIpv6
  ) {
    throw new PermanentSiteImportError("Mobbin Site media URL is not public HTTPS");
  }
}

function nonPublicIpv4(value: string): boolean {
  const [a, b] = value.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

export async function createMobbinSitesBrowserPorts(
  options: MobbinContextOptions,
): Promise<MobbinSitesBrowserPorts> {
  const context = await launchMobbinContext(options);
  const page = await freshPage(context);
  return {
    captureSource: (url) => captureSitesSource(page, url),
    async download(url) {
      assertPublicHttpsUrl(url);
      const response = await context.request.get(url, {
        failOnStatusCode: false,
        maxRedirects: 5,
        timeout: 60_000,
      });
      const status = response.status();
      if (status === 401 || status === 403) {
        throw new PermanentSiteImportError("Mobbin authentication required");
      }
      if (status >= 400 && status < 500) {
        throw new PermanentSiteImportError("Mobbin Site media is unavailable");
      }
      if (status < 200 || status >= 300) throw new Error("Mobbin Site media request failed");
      const headers = response.headers();
      const rawLength = headers["content-length"];
      const contentLength = rawLength === undefined ? undefined : Number(rawLength);
      return {
        body: await response.body(),
        contentType: headers["content-type"] ?? "",
        ...(contentLength === undefined ? {} : { contentLength }),
        finalUrl: response.url(),
      };
    },
    async close() {
      await context.close();
    },
  };
}

async function freshPage(context: BrowserContext): Promise<Page> {
  for (const page of context.pages()) await page.close().catch(() => undefined);
  return context.newPage();
}

async function captureSitesSource(page: Page, url: string): Promise<SiteImport> {
  const identity = canonicalMobbinSitesUrl(url);
  const sectionsPath = `/sites/${identity.sourceSiteId}/${identity.sourceVersionId}/sections`;
  let timer: NodeJS.Timeout | undefined;
  let settled = false;
  let resolveCapture!: (graph: SiteImport) => void;
  let rejectCapture!: (error: Error) => void;
  const captured = new Promise<SiteImport>((resolve, reject) => {
    resolveCapture = resolve;
    rejectCapture = reject;
  });
  const finish = (work: () => void) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    work();
  };
  const onResponse = async (response: Response) => {
    try {
      const responseUrl = new URL(response.url());
      if (responseUrl.origin !== "https://mobbin.com" || responseUrl.pathname !== sectionsPath) return;
      if (response.status() === 401 || response.status() === 403) {
        finish(() => rejectCapture(new PermanentSiteImportError("Mobbin authentication required")));
        return;
      }
      if (
        response.status() !== 200 ||
        !response.headers()["content-type"]?.toLowerCase().startsWith("text/x-component")
      ) return;
      const graph = decodeMobbinSitesSource(await response.text());
      finish(() => resolveCapture(graph));
    } catch {
      finish(() => rejectCapture(new PermanentSiteImportError("Mobbin Sites source changed")));
    }
  };
  page.on("response", onResponse);
  timer = setTimeout(() => {
    finish(() => rejectCapture(new Error("Mobbin Sites source response timed out")));
  }, SOURCE_TIMEOUT_MS);
  try {
    const navigation = await page.goto(identity.canonicalUrl, {
      waitUntil: "domcontentloaded",
      timeout: SOURCE_TIMEOUT_MS,
    });
    if (navigation?.status() === 401 || navigation?.status() === 403) {
      throw new PermanentSiteImportError("Mobbin authentication required");
    }
    const finalUrl = new URL(page.url());
    if (finalUrl.origin !== "https://mobbin.com" || /\/(?:login|sign-in)(?:\/|$)/.test(finalUrl.pathname)) {
      throw new PermanentSiteImportError("Mobbin authentication required");
    }
    if (!settled) {
      const link = page.getByRole("link", { name: "Sections", exact: true });
      if (await link.count() !== 1) {
        throw new PermanentSiteImportError("Mobbin Sites navigation changed");
      }
      await link.click();
    }
    return await captured;
  } finally {
    if (timer) clearTimeout(timer);
    page.off("response", onResponse);
  }
}
