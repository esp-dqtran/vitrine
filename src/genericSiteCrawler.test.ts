import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import type { PublicPageBrowserResult } from "./publicPageBrowser.ts";
import {
  crawlGenericSite,
  GenericSiteImportCancelledError,
  PermanentGenericSiteImportError,
  type GenericSiteCrawlerDependencies,
} from "./genericSiteCrawler.ts";
import type { SiteAnalysisProvider } from "./siteAnalysisProvider.ts";
import type {
  GenericSiteBeginInput,
  GenericSiteCompleteInput,
} from "./sitesGenericStore.ts";

const png = await sharp({
  create: {
    width: 20,
    height: 20,
    channels: 4,
    background: "#ffffff",
  },
}).png().toBuffer();
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]);

test("crawls one public page into Sites with mobile and analysis objects", async () => {
  const state = harness();
  const result = await crawlGenericSite(
    "https://example.com/pricing#plans",
    state.dependencies,
  );

  assert.deepEqual(result, {
    siteId: 7,
    versionId: 9,
    pageCount: 1,
    sectionCount: 2,
  });
  assert.equal(state.completed?.analysis.status, "evidence-only");
  assert.equal(state.completed?.sections.length, 2);
  assert.ok(state.objectKeys.some((key) => key.includes("/mobile/")));
  assert.equal(
    state.objectKeys.every((key) => key.startsWith("sites/")),
    true,
  );
});

test("provider success produces ready synthesis while failure keeps evidence-only", async () => {
  const success = harness({ analysisProvider: synthesisProvider() });
  await crawlGenericSite("https://example.com/pricing", success.dependencies);
  assert.equal(success.completed?.analysis.status, "ready");
  assert.equal(success.completed?.analysis.synthesis?.category, "Business");

  const failure = harness({
    analysisProvider: {
      model: "broken",
      analyze: async () => {
        throw new Error("provider unavailable with token=private");
      },
    },
  });
  await crawlGenericSite("https://example.com/pricing", failure.dependencies);
  assert.equal(failure.completed?.analysis.status, "evidence-only");
  assert.match(
    failure.completed?.analysis.warnings.join(" ") ?? "",
    /AI Site synthesis was unavailable/,
  );
  assert.doesNotMatch(
    failure.completed?.analysis.warnings.join(" ") ?? "",
    /private/,
  );
});

test("reuses a ready version without writing objects", async () => {
  const state = harness({ reused: true });
  const result = await crawlGenericSite(
    "https://example.com/pricing",
    state.dependencies,
  );
  assert.equal(result.versionId, 9);
  assert.equal(state.objectKeys.length, 0);
  assert.equal(state.completed, undefined);
});

test("checks cancellation before capture and before completion", async () => {
  let checks = 0;
  const beforeCapture = harness({
    isCancelled: async () => ++checks === 1,
  });
  await assert.rejects(
    () => crawlGenericSite("https://example.com/", beforeCapture.dependencies),
    GenericSiteImportCancelledError,
  );
  assert.equal(beforeCapture.captureCalls, 0);

  let laterChecks = 0;
  const beforeCompletion = harness({
    isCancelled: async () => ++laterChecks >= 4,
  });
  await assert.rejects(
    () => crawlGenericSite("https://example.com/", beforeCompletion.dependencies),
    GenericSiteImportCancelledError,
  );
  assert.equal(beforeCompletion.failures.length, 1);
});

test("fails permanently when section images drift", async () => {
  const capture = fixtureCapture();
  capture.sectionImages.pop();
  const state = harness({ capture });
  await assert.rejects(
    () => crawlGenericSite("https://example.com/", state.dependencies),
    PermanentGenericSiteImportError,
  );
  assert.equal(state.completed, undefined);
});

function harness(options: {
  capture?: PublicPageBrowserResult;
  reused?: boolean;
  analysisProvider?: SiteAnalysisProvider;
  isCancelled?: () => Promise<boolean>;
} = {}) {
  const objectKeys: string[] = [];
  const failures: string[] = [];
  const beginInputs: GenericSiteBeginInput[] = [];
  let completed: GenericSiteCompleteInput | undefined;
  let captureCalls = 0;
  const objectStore: ObjectStore = {
    async put(input) {
      objectKeys.push(input.key);
      const { body: _body, ...metadata } = input;
      return { created: true, metadata };
    },
    async head() {
      return undefined;
    },
    async get() {
      throw new Error("unused");
    },
    async signedGetUrl() {
      return undefined;
    },
    async *list() {
      return;
    },
    async delete() {
      return false;
    },
  };
  const dependencies: GenericSiteCrawlerDependencies = {
    browser: {
      async capture() {
        captureCalls += 1;
        return options.capture ?? fixtureCapture();
      },
    },
    objectStore,
    sitesStore: {
      async beginGenericImport(input) {
        beginInputs.push(input);
        return {
          reused: options.reused ?? false,
          siteId: 7,
          versionId: 9,
        } as const;
      },
      async completeGenericImport(input, objects) {
        completed = input;
        assert.equal(objects.length, 7);
        return { siteId: 7, versionId: 9 };
      },
      async failGenericImport(_url, message) {
        failures.push(message);
      },
    },
    ...(options.analysisProvider
      ? { analysisProvider: options.analysisProvider }
      : {}),
    isCancelled: options.isCancelled ?? (async () => false),
  };
  return {
    dependencies,
    objectKeys,
    failures,
    beginInputs,
    get completed() {
      return completed;
    },
    get captureCalls() {
      return captureCalls;
    },
  };
}

function fixtureCapture(): PublicPageBrowserResult {
  return {
    capture: {
      requestedUrl: "https://example.com/pricing",
      canonicalUrl: "https://example.com/pricing",
      metadata: {
        name: "Example",
        description: "Pricing page",
        category: "Business",
        accent: "#112233",
        iconUrl: "https://example.com/icon.png",
      },
      viewport: { width: 1_440, height: 900 },
      document: { width: 1_440, height: 1_000 },
      html: "<html><body><main>Pricing</main></body></html>",
      sections: [
        {
          position: 0,
          selector: "main",
          tagName: "main",
          heading: "Pricing",
          text: "Plans",
          bounds: { x: 0, y: 0, width: 1_440, height: 500 },
        },
        {
          position: 1,
          selector: "footer",
          tagName: "footer",
          heading: "Footer",
          text: "Links",
          bounds: { x: 0, y: 500, width: 1_440, height: 500 },
        },
      ],
    },
    pageImage: png,
    mobilePageImage: png,
    sectionImages: [
      { position: 0, body: png },
      { position: 1, body: png },
    ],
    preview: webm,
    scroll: { durationMs: 1_000, stops: 0 },
    analysis: {
      schemaVersion: 1,
      status: "evidence-only",
      evidence: [],
      structure: [],
      visualTokens: [],
      motion: [],
      technology: [],
      responsive: [],
      synthesis: null,
      warnings: [],
    },
  };
}

function synthesisProvider(): SiteAnalysisProvider {
  return {
    model: "fixture-model",
    analyze: async () => ({
      purpose: "Explain pricing",
      category: "Business",
      structure: [],
      rendering: [],
      motion: [],
      technology: [],
      responsive: [],
      reconstructionPriorities: [],
      unknowns: [],
      claims: [{
        kind: "unknown",
        text: "Hover behavior was not activated",
        evidenceIds: [],
        confidence: 0,
      }],
    }),
  };
}
