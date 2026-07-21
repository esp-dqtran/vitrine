import { createHash } from "node:crypto";
import {
  publicPageObjectKey,
  type ObjectMetadata,
  type ObjectStore,
  type StoredContentType,
} from "./objectStore.ts";
import { canonicalPublicPageUrl } from "./publicPage.ts";
import type { PublicPageBrowser, PublicPageBrowserResult } from "./publicPageBrowser.ts";
import type {
  NewPublicPageCapture,
  PublicPageAssets,
  PublicPageStore,
} from "./publicPageStore.ts";

const MAX_OBJECT_BYTES = 64 * 1024 * 1024;

export class PublicPageImportCancelledError extends Error {
  constructor() {
    super("Public page import cancelled");
    this.name = "PublicPageImportCancelledError";
  }
}

export class PermanentPublicPageImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentPublicPageImportError";
  }
}

export interface PublicPageCrawlerDependencies {
  browser: Pick<PublicPageBrowser, "capture">;
  objectStore: ObjectStore;
  pageStore: PublicPageStore;
  isCancelled(): Promise<boolean>;
  report?(message: string): Promise<void>;
}

export interface PublicPageCrawlResult {
  app: string;
  pageId: number;
  versionId: number;
  sectionCount: number;
  reused: boolean;
}

export async function crawlPublicPage(
  url: string,
  deps: PublicPageCrawlerDependencies,
): Promise<PublicPageCrawlResult> {
  await assertNotCancelled(deps);
  await deps.report?.("Rendering page");
  const result = await deps.browser.capture(url);
  await assertNotCancelled(deps);
  await deps.report?.("Analyzing HTML");
  const pageSha = sha256(result.pageImage);
  const contentHash = sha256(Buffer.from(JSON.stringify({
    canonicalUrl: result.capture.canonicalUrl,
    html: result.capture.html,
    pageSha,
  })));
  const begin = await deps.pageStore.beginCapture(result.capture, contentHash);
  if (begin.reused) {
    return {
      app: begin.app,
      pageId: begin.pageId,
      versionId: begin.versionId,
      sectionCount: result.capture.sections.length,
      reused: true,
    };
  }

  try {
    return await completeNewCapture(result, begin, deps);
  } catch (error) {
    await deps.pageStore.failCapture(begin.versionId, safeFailure(error)).catch(() => undefined);
    throw error;
  }
}

async function completeNewCapture(
  result: PublicPageBrowserResult,
  begin: NewPublicPageCapture,
  deps: PublicPageCrawlerDependencies,
): Promise<PublicPageCrawlResult> {
  const identity = canonicalPublicPageUrl(result.capture.canonicalUrl);
  const objects: ObjectMetadata[] = [];
  const source = Buffer.from(JSON.stringify(result.capture));
  verifiedBytes(source, "source");
  verifiedPng(result.pageImage);
  if (result.sectionImages.length !== result.capture.sections.length) {
    throw new PermanentPublicPageImportError("Public page section image count changed");
  }
  result.sectionImages.forEach(({ body, position }, index) => {
    if (position !== index) throw new PermanentPublicPageImportError("Public page section image order changed");
    verifiedPng(body);
  });
  verifiedWebm(result.preview);

  await assertNotCancelled(deps);
  await deps.report?.("Saving page capture");
  const sourceObject = await putVerified(deps.objectStore, {
    key: publicPageObjectKey(identity.sourceDomain, begin.contentHash, "source", "capture", sha256(source), "json"),
    body: source,
    contentType: "application/json",
    accessClass: "internal",
  });
  objects.push(sourceObject);
  const pageObject = await putVerified(deps.objectStore, {
    key: publicPageObjectKey(identity.sourceDomain, begin.contentHash, "page", "page", sha256(result.pageImage), "png"),
    body: result.pageImage,
    contentType: "image/png",
    accessClass: "protected",
  });
  objects.push(pageObject);

  await assertNotCancelled(deps);
  await deps.report?.("Recording preview");
  const previewObject = await putVerified(deps.objectStore, {
    key: publicPageObjectKey(identity.sourceDomain, begin.contentHash, "preview", "page", sha256(result.preview), "webm"),
    body: result.preview,
    contentType: "video/webm",
    accessClass: "protected",
  });
  objects.push(previewObject);

  const pageHash16 = sha256(result.pageImage).slice(0, 16);
  const assets: PublicPageAssets = {
    source: sourceObject.key,
    preview: previewObject.key,
    page: { objectKey: pageObject.key, imageRef: `capture:${pageHash16}` },
    sections: [],
  };
  for (const section of result.sectionImages) {
    await assertNotCancelled(deps);
    const object = await putVerified(deps.objectStore, {
      key: publicPageObjectKey(
        identity.sourceDomain,
        begin.contentHash,
        "section",
        String(section.position),
        sha256(section.body),
        "png",
      ),
      body: section.body,
      contentType: "image/png",
      accessClass: "protected",
    });
    objects.push(object);
    assets.sections.push({
      position: section.position,
      objectKey: object.key,
      imageRef: `capture:ui_element:${pageHash16}:${section.position}`,
    });
  }

  await assertNotCancelled(deps);
  await deps.report?.("Finalizing page import");
  const completed = await deps.pageStore.completeCapture(begin, assets, objects);
  return { ...completed, reused: false };
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
    throw new Error("Object store returned different public-page metadata");
  }
  return stored.metadata;
}

function verifiedPng(body: Buffer): void {
  verifiedBytes(body, "PNG");
  if (!body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new PermanentPublicPageImportError("Public page PNG signature is invalid");
  }
}

function verifiedWebm(body: Buffer): void {
  verifiedBytes(body, "WebM");
  if (!body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    throw new PermanentPublicPageImportError("Public page WebM signature is invalid");
  }
}

function verifiedBytes(body: Buffer, label: string): void {
  if (body.byteLength === 0 || body.byteLength > MAX_OBJECT_BYTES) {
    throw new PermanentPublicPageImportError(`Public page ${label} exceeds the 64 MiB media ceiling`);
  }
}

async function assertNotCancelled(deps: PublicPageCrawlerDependencies): Promise<void> {
  if (await deps.isCancelled()) throw new PublicPageImportCancelledError();
}

function safeFailure(error: unknown): string {
  if (error instanceof PublicPageImportCancelledError) return "Public page import cancelled";
  if (error instanceof PermanentPublicPageImportError) return error.message.slice(0, 500);
  return "Public page import failed";
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}
