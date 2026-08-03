import { createHash } from "node:crypto";
import sharp from "sharp";
import type {
  ObjectMetadata,
  ObjectStore,
  StoredContentType,
} from "./objectStore.ts";
import type {
  PublicPageBrowser,
  PublicPageBrowserResult,
} from "./publicPageBrowser.ts";
import {
  parseSiteAnalysis,
  type SiteAnalysis,
} from "./siteAnalysis.ts";
import { createSiteDesignSystem } from "./siteDesignSystem.ts";
import {
  analyzeSiteEvidence,
  type SiteAnalysisProvider,
} from "./siteAnalysisProvider.ts";
import { classifySiteImportUrl } from "./sites.ts";
import type { WappalyzerTechnologyDetector } from "./wappalyzerBrowser.ts";
import { mergeWappalyzerTechnology } from "./wappalyzerTechnology.ts";
import type {
  GenericSiteCompleteInput,
  GenericSitesStoreMethods,
} from "./sitesGenericStore.ts";
import { categoriesForPublicSite } from "./siteCategories.ts";

const MAXIMUM_OBJECT_BYTES = 64 * 1_024 * 1_024;
const ANALYSIS_TIMEOUT_MS = 60_000;
const DARK_PAGE_LUMINANCE = 0.4;
export const GENERIC_SITE_CAPTURE_PIPELINE_VERSION =
  "desktop-1440x900-60fps-crf25-single-fixed-overlay-v1";
const MOTION_TECHNOLOGIES = new Set([
  "Anime.js",
  "CSS Keyframes",
  "Embla",
  "Framer Motion",
  "GSAP",
  "Lenis",
  "Lottie",
  "React Spring",
  "Rive",
  "ScrollTrigger",
  "Spline",
  "SplitText",
  "Swiper",
  "Three.js",
  "Web Animations API",
  "Webflow IX2",
]);

type CapturedSection =
  PublicPageBrowserResult["capture"]["sections"][number];

function genericSectionPatterns(section: CapturedSection): string[] {
  const heading = section.heading?.replace(/\s+/g, " ").trim();
  const tagName = section.tagName.toLowerCase();
  const role = section.role?.toLowerCase();
  const text = (heading || section.text).toLowerCase();
  const bodyText = section.text.toLowerCase();
  const semanticText = `${text} ${bodyText}`;
  let taxonomy: string;

  if (
    tagName === "nav" ||
    role === "navigation" ||
    (
      section.position === 0 &&
      !heading &&
      section.bounds.height <= 320
    )
  ) {
    taxonomy = "Navigation Section";
  } else if (
    tagName === "footer" ||
    role === "contentinfo" ||
    /\b(copyright|all rights reserved)\b|©/.test(text)
  ) {
    taxonomy = "Footer Section";
  } else if (/\b(pricing|plans|subscriptions?)\b/.test(text)) {
    taxonomy = "Pricing Section";
  } else if (/\b(faq|frequently(?: asked)?|questions?)\b/.test(text)) {
    taxonomy = "FAQ Section";
  } else if (
    /\b(testimonials?|customers?|clients?|trusted by|social proof)\b/.test(text)
  ) {
    taxonomy = "Social Proof Section";
  } else if (/\b(how it works|how to|process|workflow)\b/.test(text)) {
    taxonomy = "How It Works Section";
  } else if (/\b(about|our story|mission|company)\b/.test(text)) {
    taxonomy = "About Section";
  } else if (/\b(contact|talk to|book a demo|request a demo)\b/.test(text)) {
    taxonomy = "Contact Section";
  } else if (/\b(blog|changelog|news|updates?)\b/.test(text)) {
    taxonomy = "Updates Section";
  } else if (
    /\b(get started|start building|start (?:your )?project|have a project|sign up|try (?:it|for)|available today|ready to|(?:your )?next (?:idea|project|chapter) starts here)\b/
      .test(semanticText)
  ) {
    taxonomy = "Call to Action Section";
  } else if (section.position <= 1) {
    taxonomy = "Hero Section";
  } else if (
    tagName === "section" ||
    /\b(features?|product|platform|solutions?|agents?)\b/.test(semanticText)
  ) {
    taxonomy = "Feature Section";
  } else {
    taxonomy = "Content Section";
  }

  const structural = taxonomy === "Navigation Section" ||
    taxonomy === "Footer Section";
  return unique(structural || !heading ? [taxonomy] : [heading, taxonomy])
    .slice(0, 4);
}

export class GenericSiteImportCancelledError extends Error {
  constructor() {
    super("Generic Site import cancelled");
    this.name = "GenericSiteImportCancelledError";
  }
}

export class PermanentGenericSiteImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentGenericSiteImportError";
  }
}

export interface GenericSiteCrawlerDependencies {
  browser: Pick<PublicPageBrowser, "capture">;
  objectStore: ObjectStore;
  sitesStore: Required<Pick<
    GenericSitesStoreMethods,
    "beginGenericImport" | "completeGenericImport" | "failGenericImport"
  >>;
  analysisProvider?: SiteAnalysisProvider;
  technologyDetector?: Pick<WappalyzerTechnologyDetector, "detect">;
  isCancelled(): Promise<boolean>;
  report?(message: string): Promise<void>;
}

export interface GenericSiteCrawlResult {
  siteId: number;
  versionId: number;
  pageCount: 1;
  sectionCount: number;
}

export async function crawlGenericSite(
  url: string,
  deps: GenericSiteCrawlerDependencies,
): Promise<GenericSiteCrawlResult> {
  const requestedIdentity = classifySiteImportUrl(url);
  if (requestedIdentity.kind !== "public-page") {
    throw new PermanentGenericSiteImportError(
      "Generic Site crawler requires a public page URL",
    );
  }
  await assertNotCancelled(deps);
  await deps.report?.("Rendering page");
  const browserCapture = await deps.browser.capture(requestedIdentity.canonicalUrl);
  await assertNotCancelled(deps);

  const identity = classifySiteImportUrl(browserCapture.capture.canonicalUrl);
  if (identity.kind !== "public-page") {
    throw new PermanentGenericSiteImportError(
      "Generic Site redirected to an unsupported source",
    );
  }
  const capture = await withDetectedTechnology(
    browserCapture,
    identity.canonicalUrl,
    deps.technologyDetector,
  );
  await deps.report?.("Analyzing structure and motion");
  const synthesized = await synthesizeAnalysis(
    capture,
    deps.analysisProvider,
  );
  const analysis = parseSiteAnalysis({
    ...synthesized.analysis,
    designSystem: createSiteDesignSystem({
      app: capture.capture.metadata.name,
      sourceUrl: identity.canonicalUrl,
      analysis: synthesized.analysis,
    }),
  });
  const model = synthesized.model;
  const contentHash = genericSiteCaptureHash(capture);
  await assertNotCancelled(deps);
  const categories = categoriesForPublicSite({
    url: identity.canonicalUrl,
    name: capture.capture.metadata.name,
    description: capture.capture.metadata.description,
    sourceCategory: capture.capture.metadata.category,
    analysisCategory: analysis.synthesis?.category,
  });
  const styles = await genericSiteStyles(capture.pageImage, analysis);
  const begin = await deps.sitesStore.beginGenericImport({
    identity,
    name: capture.capture.metadata.name,
    description: capture.capture.metadata.description,
    ...(capture.capture.metadata.iconUrl
      ? { iconUrl: capture.capture.metadata.iconUrl }
      : {}),
    categories,
    styles,
    contentHash,
    analysis,
  });
  if (begin.reused) {
    return {
      siteId: begin.siteId,
      versionId: begin.versionId,
      pageCount: 1,
      sectionCount: capture.capture.sections.length,
    };
  }

  try {
    return await completeCapture(capture, {
      identity,
      siteId: begin.siteId,
      versionId: begin.versionId,
      contentHash,
      analysis,
      ...(model ? { analysisModel: model } : {}),
    }, deps);
  } catch (error) {
    await deps.sitesStore
      .failGenericImport(identity.canonicalUrl, safeFailure(error))
      .catch(() => undefined);
    throw error;
  }
}

async function withDetectedTechnology(
  capture: PublicPageBrowserResult,
  canonicalUrl: string,
  detector: Pick<WappalyzerTechnologyDetector, "detect"> | undefined,
): Promise<PublicPageBrowserResult> {
  if (!detector) return capture;
  try {
    const detected = await detector.detect(canonicalUrl);
    return {
      ...capture,
      analysis: parseSiteAnalysis({
        ...capture.analysis,
        schemaVersion: 2,
        technology: mergeWappalyzerTechnology(
          capture.analysis.technology,
          detected,
        ),
      }),
    };
  } catch {
    return {
      ...capture,
      analysis: parseSiteAnalysis({
        ...capture.analysis,
        warnings: unique([
          ...capture.analysis.warnings,
          "Extended technology detection was unavailable; browser evidence was retained.",
        ]),
      }),
    };
  }
}

async function synthesizeAnalysis(
  result: PublicPageBrowserResult,
  provider: SiteAnalysisProvider | undefined,
): Promise<{ analysis: SiteAnalysis; model?: string }> {
  if (!provider) return { analysis: result.analysis };
  try {
    const overview = await sharp(result.pageImage)
      .resize({ width: 768, height: 4_096, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    timer.unref?.();
    try {
      const synthesis = await analyzeSiteEvidence(provider, {
        evidenceIds: result.analysis.evidence.map((item) => item.id),
        evidence: {
          structure: result.analysis.structure,
          visualTokens: result.analysis.visualTokens,
          motion: result.analysis.motion,
          technology: result.analysis.technology,
          responsive: result.analysis.responsive,
          warnings: result.analysis.warnings,
        },
        image: { bytes: overview, contentType: "image/png" },
        signal: controller.signal,
      });
      return {
        analysis: parseSiteAnalysis({
          ...result.analysis,
          status: "ready",
          synthesis,
        }),
        model: provider.model,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return {
      analysis: parseSiteAnalysis({
        ...result.analysis,
        status: "evidence-only",
        synthesis: null,
        warnings: unique([
          ...result.analysis.warnings,
          "AI Site synthesis was unavailable; deterministic evidence was retained.",
        ]),
      }),
    };
  }
}

async function genericSiteStyles(
  pageImage: Buffer,
  analysis: SiteAnalysis,
): Promise<string[]> {
  const styles: string[] = [];
  const pixel = await sharp(pageImage)
    .resize(1, 1, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  if (pixel.length >= 3) {
    const luminance = (
      (0.2126 * pixel[0]!)
      + (0.7152 * pixel[1]!)
      + (0.0722 * pixel[2]!)
    ) / 255;
    if (luminance < DARK_PAGE_LUMINANCE) styles.push("Dark");
  }
  if (analysis.technology.some((finding) =>
    finding.state !== "not-detected"
    && finding.evidenceIds.length > 0
    && MOTION_TECHNOLOGIES.has(finding.name)
  )) {
    styles.push("Motion");
  }
  return styles;
}

async function completeCapture(
  result: PublicPageBrowserResult,
  capture: {
    identity: Extract<ReturnType<typeof classifySiteImportUrl>, { kind: "public-page" }>;
    siteId: number;
    versionId: number;
    contentHash: string;
    analysis: SiteAnalysis;
    analysisModel?: string;
  },
  deps: GenericSiteCrawlerDependencies,
): Promise<GenericSiteCrawlResult> {
  await assertNotCancelled(deps);
  verifiedPng(result.pageImage);
  verifiedPng(result.mobilePageImage);
  verifiedWebm(result.preview);
  if (result.sectionImages.length !== result.capture.sections.length) {
    throw new PermanentGenericSiteImportError(
      "Generic Site section image count changed",
    );
  }
  for (let index = 0; index < result.sectionImages.length; index += 1) {
    const section = result.sectionImages[index]!;
    if (section.position !== index) {
      throw new PermanentGenericSiteImportError(
        "Generic Site section image order changed",
      );
    }
    verifiedPng(section.body);
  }

  await deps.report?.("Saving Site evidence");
  const sourceBody = Buffer.from(JSON.stringify(result.capture));
  const analysisBody = Buffer.from(JSON.stringify(capture.analysis));
  const objects: ObjectMetadata[] = [];
  const put = async (
    kind: string,
    identity: string,
    body: Buffer,
    extension: "json" | "png" | "webm",
    contentType: StoredContentType,
    accessClass: ObjectMetadata["accessClass"],
  ) => {
    const object = await putVerified(deps.objectStore, {
      key: genericSiteObjectKey(
        capture.identity.sourceSiteId,
        capture.contentHash,
        kind,
        identity,
        sha256(body),
        extension,
      ),
      body,
      contentType,
      accessClass,
    });
    objects.push(object);
    return object;
  };
  const sourceObject = await put(
    "source",
    "capture",
    sourceBody,
    "json",
    "application/json",
    "internal",
  );
  const analysisObject = await put(
    "analysis",
    "evidence",
    analysisBody,
    "json",
    "application/json",
    "internal",
  );
  const pageObject = await put(
    "page",
    "desktop",
    result.pageImage,
    "png",
    "image/png",
    "protected",
  );
  const mobileObject = await put(
    "mobile",
    "page",
    result.mobilePageImage,
    "png",
    "image/png",
    "protected",
  );
  const previewObject = await put(
    "preview",
    "scroll",
    result.preview,
    "webm",
    "video/webm",
    "protected",
  );
  const sectionKeys: Record<string, string> = {};
  for (const section of result.sectionImages) {
    await assertNotCancelled(deps);
    const sourceId = `section-${section.position}`;
    const object = await put(
      "section",
      String(section.position),
      section.body,
      "png",
      "image/png",
      "protected",
    );
    sectionKeys[sourceId] = object.key;
  }

  await assertNotCancelled(deps);
  await deps.report?.("Finalizing Site analysis");
  const completion: GenericSiteCompleteInput = {
    identity: capture.identity,
    siteId: capture.siteId,
    versionId: capture.versionId,
    contentHash: capture.contentHash,
    page: {
      sourceId: "page",
      title: result.capture.metadata.name,
      url: result.capture.canonicalUrl,
    },
    sections: result.capture.sections.map((section) => ({
      sourceId: `section-${section.position}`,
      position: section.position,
      cropTop: section.bounds.y,
      cropBottom: section.bounds.y + section.bounds.height,
      sourceMetadata: {
        selector: section.selector,
        tagName: section.tagName,
        ...(section.role ? { role: section.role } : {}),
        ...(section.heading ? { heading: section.heading } : {}),
        ...(section.headingLevel ? { headingLevel: section.headingLevel } : {}),
        ...(section.anchor ? { anchor: section.anchor } : {}),
        ...(section.classNames?.length ? { classNames: section.classNames } : {}),
        text: section.text,
        ...(section.elementBounds ? { elementBounds: section.elementBounds } : {}),
        ...(section.style ? { style: section.style } : {}),
        ...(section.content ? { content: section.content } : {}),
        patterns: genericSectionPatterns(section),
      },
    })),
    analysis: capture.analysis,
    ...(capture.analysisModel ? { analysisModel: capture.analysisModel } : {}),
    objectKeys: {
      source: sourceObject.key,
      analysis: analysisObject.key,
      preview: previewObject.key,
      mobile: mobileObject.key,
      page: pageObject.key,
      sections: sectionKeys,
    },
  };
  const completed = await deps.sitesStore.completeGenericImport(
    completion,
    objects,
  );
  return {
    siteId: completed.siteId,
    versionId: completed.versionId,
    pageCount: 1,
    sectionCount: completion.sections.length,
  };
}

async function putVerified(
  store: ObjectStore,
  input: {
    key: string;
    body: Buffer;
    contentType: StoredContentType;
    accessClass: ObjectMetadata["accessClass"];
  },
): Promise<ObjectMetadata> {
  verifiedBytes(input.body, "object");
  const expected: ObjectMetadata = {
    key: input.key,
    sha256: sha256(input.body),
    byteSize: input.body.byteLength,
    contentType: input.contentType,
    accessClass: input.accessClass,
  };
  const stored = await store.put({ ...expected, body: input.body });
  if (
    stored.metadata.key !== expected.key ||
    stored.metadata.sha256 !== expected.sha256 ||
    stored.metadata.byteSize !== expected.byteSize ||
    stored.metadata.contentType !== expected.contentType ||
    stored.metadata.accessClass !== expected.accessClass
  ) {
    throw new Error("Object store returned different Generic Site metadata");
  }
  return stored.metadata;
}

function genericSiteObjectKey(
  siteId: string,
  versionId: string,
  kind: string,
  identity: string,
  hash: string,
  extension: string,
): string {
  if (
    !/^[0-9a-f]{64}$/.test(hash) ||
    !/^[0-9a-f]{64}$/.test(versionId) ||
    !/^[a-z][a-z0-9-]{0,30}$/.test(kind) ||
    !["json", "png", "webm"].includes(extension)
  ) {
    throw new Error("Invalid Generic Site object identity");
  }
  return `sites/${encoded(siteId)}/versions/${encoded(versionId)}/${kind}/${
    encoded(identity)
  }/${hash}.${extension}`;
}

function encoded(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength < 1 || bytes.byteLength > 120) {
    throw new Error("Invalid Generic Site object key part");
  }
  return bytes.toString("hex");
}

export function genericSiteCaptureHash(
  result: PublicPageBrowserResult,
  pipelineVersion = GENERIC_SITE_CAPTURE_PIPELINE_VERSION,
): string {
  return createHash("sha256")
    .update(pipelineVersion)
    .update("\0")
    .update(result.capture.canonicalUrl)
    .update("\0")
    .update(result.capture.html)
    .update("\0")
    .update(result.pageImage)
    .update("\0")
    .update(result.mobilePageImage)
    .update("\0")
    .update(JSON.stringify(result.analysis.technology))
    .digest("hex");
}

function verifiedPng(body: Buffer): void {
  verifiedBytes(body, "PNG");
  if (
    !body.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    throw new PermanentGenericSiteImportError(
      "Generic Site PNG signature is invalid",
    );
  }
}

function verifiedWebm(body: Buffer): void {
  verifiedBytes(body, "WebM");
  if (
    !body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) {
    throw new PermanentGenericSiteImportError(
      "Generic Site WebM signature is invalid",
    );
  }
}

function verifiedBytes(body: Buffer, label: string): void {
  if (body.byteLength < 1 || body.byteLength > MAXIMUM_OBJECT_BYTES) {
    throw new PermanentGenericSiteImportError(
      `Generic Site ${label} exceeds the 64 MiB media ceiling`,
    );
  }
}

async function assertNotCancelled(
  deps: GenericSiteCrawlerDependencies,
): Promise<void> {
  if (await deps.isCancelled()) throw new GenericSiteImportCancelledError();
}

function safeFailure(error: unknown): string {
  if (error instanceof GenericSiteImportCancelledError) {
    return "Generic Site import cancelled";
  }
  if (error instanceof PermanentGenericSiteImportError) {
    return error.message.slice(0, 500);
  }
  return "Generic Site import failed";
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
