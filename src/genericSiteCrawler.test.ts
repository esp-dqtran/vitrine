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
  assert.deepEqual(
    state.completed?.sections.map((section) => section.sourceMetadata?.patterns),
    [
      ["Pricing", "Pricing Section"],
      ["Footer Section"],
    ],
  );
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

test("persists Wappalyzer technology and merges matching native evidence", async () => {
  const capture = fixtureCapture();
  capture.analysis.evidence.push({
    id: "TECH-1",
    kind: "script-url",
    value: "/_next/static/chunks/app.js",
  });
  capture.analysis.technology = [{
    id: "TECHNOLOGY-1",
    name: "Next.js",
    category: "framework",
    state: "observed-in-use",
    evidenceIds: ["TECH-1"],
    confidence: 0.85,
  }];
  const detectedUrls: string[] = [];
  const state = harness({
    capture,
    technologyDetector: {
      async detect(url) {
        detectedUrls.push(url);
        return [{
          id: "TECHNOLOGY-WAPPALYZER-NEXT-JS",
          name: "Next.js",
          slug: "next-js",
          categories: ["Web frameworks"],
          icon: "Next.js.svg",
          source: "wappalyzer",
          category: "framework",
          state: "confirmed",
          evidenceIds: [],
          confidence: 1,
        }];
      },
    },
  });

  await crawlGenericSite("https://example.com/old", state.dependencies);

  assert.deepEqual(detectedUrls, ["https://example.com/pricing"]);
  assert.equal(state.completed?.analysis.schemaVersion, 2);
  assert.deepEqual(state.completed?.analysis.technology[0], {
    id: "TECHNOLOGY-WAPPALYZER-NEXT-JS",
    name: "Next.js",
    slug: "next-js",
    categories: ["Web frameworks"],
    icon: "Next.js.svg",
    source: "wappalyzer",
    category: "framework",
    state: "confirmed",
    evidenceIds: ["TECH-1"],
    confidence: 1,
  });
});

test("keeps native technology and a safe warning when Wappalyzer fails", async () => {
  const capture = fixtureCapture();
  capture.analysis.technology = [{
    id: "TECHNOLOGY-1",
    name: "CSS Keyframes",
    category: "animation",
    state: "observed-in-use",
    evidenceIds: [],
    confidence: 0.99,
  }];
  const state = harness({
    capture,
    technologyDetector: {
      async detect() {
        throw new Error("private extension path /secret/wappalyzer");
      },
    },
  });

  await crawlGenericSite("https://example.com/pricing", state.dependencies);

  assert.equal(state.completed?.analysis.technology[0]?.name, "CSS Keyframes");
  assert.match(
    state.completed?.analysis.warnings.join(" ") ?? "",
    /Extended technology detection was unavailable/,
  );
  assert.doesNotMatch(
    state.completed?.analysis.warnings.join(" ") ?? "",
    /secret|wappalyzer/i,
  );
});

test("derives a Dark style from the captured page pixels", async () => {
  const capture = fixtureCapture();
  capture.pageImage = await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 3,
      background: "#111111",
    },
  }).png().toBuffer();
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/pricing", state.dependencies);

  assert.deepEqual(state.beginInputs[0]?.styles, ["Dark"]);
});

test("derives Motion only from named animation technology evidence", async () => {
  const namedCapture = fixtureCapture();
  namedCapture.analysis.technology = [{
    id: "TECHNOLOGY-FINDING-0",
    name: "Framer Motion",
    category: "animation",
    state: "loaded",
    confidence: 0.82,
    evidenceIds: ["TECHNOLOGY-EVIDENCE-0"],
  }];
  const named = harness({ capture: namedCapture });

  await crawlGenericSite("https://example.com/pricing", named.dependencies);

  assert.deepEqual(named.beginInputs[0]?.styles, ["Motion"]);

  const genericCapture = fixtureCapture();
  genericCapture.analysis.technology = [{
    id: "TECHNOLOGY-FINDING-0",
    name: "Custom JavaScript Motion",
    category: "animation",
    state: "observed-in-use",
    confidence: 0.99,
    evidenceIds: ["TECHNOLOGY-EVIDENCE-0"],
  }];
  const generic = harness({ capture: genericCapture });

  await crawlGenericSite("https://example.com/pricing", generic.dependencies);

  assert.deepEqual(generic.beginInputs[0]?.styles, []);
});

test("persists readable headings and reusable section taxonomy", async () => {
  const capture = fixtureCapture();
  capture.capture.sections = [
    {
      position: 0,
      selector: "header nav",
      tagName: "nav",
      text: "Product Resources Customers",
      bounds: { x: 0, y: 0, width: 1_440, height: 80 },
    },
    {
      position: 1,
      selector: "main > section",
      tagName: "section",
      heading: "The product development system for teams and agents",
      text: "Plan and build products. Customers can review pricing and updates.",
      bounds: { x: 0, y: 80, width: 1_440, height: 920 },
    },
  ];
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/", state.dependencies);

  assert.deepEqual(
    state.completed?.sections.map((section) => section.sourceMetadata?.patterns),
    [
      ["Navigation Section"],
      [
        "The product development system for teams and agents",
        "Hero Section",
      ],
    ],
  );
});

test("labels headingless Webflow bands without failing the import", async () => {
  const capture = fixtureCapture();
  capture.capture.sections[1] = {
    position: 1,
    selector: "main > div:nth-of-type(2)",
    tagName: "div",
    text: "A visual project gallery with no heading element",
    bounds: { x: 0, y: 500, width: 1_440, height: 500 },
  };
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/", state.dependencies);

  assert.deepEqual(
    state.completed?.sections[1]?.sourceMetadata?.patterns,
    ["Hero Section"],
  );
});

test("labels a compact headingless top band as navigation", async () => {
  const capture = fixtureCapture();
  capture.capture.sections[0] = {
    position: 0,
    selector: "body > div:nth-of-type(1)",
    tagName: "div",
    text: "",
    bounds: { x: 0, y: 0, width: 1_440, height: 189 },
  };
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/", state.dependencies);

  assert.deepEqual(
    state.completed?.sections[0]?.sourceMetadata?.patterns,
    ["Navigation Section"],
  );
});

test("classifies Webflow FAQ, testimonial, and visual footer sections", async () => {
  const capture = fixtureCapture();
  capture.capture.sections = [
    {
      position: 0,
      selector: "body > section:nth-of-type(1)",
      tagName: "section",
      heading: "FREQUENTLY",
      text: "Frequently Asked Questions",
      bounds: { x: 0, y: 0, width: 1_440, height: 400 },
    },
    {
      position: 1,
      selector: "body > section:nth-of-type(2)",
      tagName: "section",
      heading: "WHAT OUR CLIENTS SAY",
      text: "What our clients say about us",
      bounds: { x: 0, y: 400, width: 1_440, height: 400 },
    },
    {
      position: 2,
      selector: "body > section:nth-of-type(3)",
      tagName: "section",
      text: "Resources Contact copyright © 2026 All rights reserved.",
      bounds: { x: 0, y: 800, width: 1_440, height: 400 },
    },
    {
      position: 3,
      selector: "body > section:nth-of-type(4)",
      tagName: "section",
      heading: "BEYOND AESTHETICS. INTO INTELLIGENCE.",
      text: "Have a project in mind? Start your project today.",
      bounds: { x: 0, y: 1_200, width: 1_440, height: 200 },
    },
  ];
  capture.sectionImages = [
    { position: 0, body: png },
    { position: 1, body: png },
    { position: 2, body: png },
    { position: 3, body: png },
  ];
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/", state.dependencies);

  assert.deepEqual(
    state.completed?.sections.map((section) => section.sourceMetadata?.patterns),
    [
      ["FREQUENTLY", "FAQ Section"],
      ["WHAT OUR CLIENTS SAY", "Social Proof Section"],
      ["Footer Section"],
      [
        "BEYOND AESTHETICS. INTO INTELLIGENCE.",
        "Call to Action Section",
      ],
    ],
  );
});

test("classifies Framer landing-page bands from their rendered evidence", async () => {
  const capture = fixtureCapture();
  capture.capture.document.height = 700;
  capture.capture.sections = [
    {
      position: 0,
      selector: "nav",
      tagName: "nav",
      text: "Product Community Resources",
      bounds: { x: 0, y: 0, width: 1_440, height: 100 },
    },
    {
      position: 1,
      selector: "main > div:nth-of-type(1)",
      tagName: "div",
      heading: "Create AI landing pages with editable control in Framer",
      text: "Get started for free",
      bounds: { x: 0, y: 100, width: 1_440, height: 100 },
    },
    {
      position: 2,
      selector: "main > div:nth-of-type(2)",
      tagName: "div",
      heading: "Start with a landing page idea",
      text: "Generate sections with AI agents. Refine visually. Add conversion paths.",
      bounds: { x: 0, y: 200, width: 1_440, height: 100 },
    },
    {
      position: 3,
      selector: "main > div:nth-of-type(3)",
      tagName: "div",
      heading: "Why teams create landing pages with AI",
      text: "AI agent control. Built for landing pages. Production hosting.",
      bounds: { x: 0, y: 300, width: 1_440, height: 100 },
    },
    {
      position: 4,
      selector: "main > div:nth-of-type(4)",
      tagName: "div",
      heading: "How to build AI landing pages in Framer",
      text: "1. Create the campaign page. 2. Optimize the message. 3. Prepare for traffic.",
      bounds: { x: 0, y: 400, width: 1_440, height: 100 },
    },
    {
      position: 5,
      selector: "main > div:nth-of-type(5)",
      tagName: "div",
      heading: "Explore Framer’s solutions for designers",
      text: "Agency websites. Marketing websites. AI website builder.",
      bounds: { x: 0, y: 500, width: 1_440, height: 100 },
    },
    {
      position: 6,
      selector: "main > div:nth-of-type(6)",
      tagName: "div",
      heading: "Your next idea starts here",
      text: "Create personal portfolio. Build startup site. Start without AI.",
      bounds: { x: 0, y: 600, width: 1_440, height: 100 },
    },
  ];
  capture.sectionImages = capture.capture.sections.map(({ position }) => ({
    position,
    body: png,
  }));
  const state = harness({ capture });

  await crawlGenericSite("https://example.com/", state.dependencies);

  assert.deepEqual(
    state.completed?.sections.slice(2).map((section) =>
      section.sourceMetadata?.patterns
    ),
    [
      ["Start with a landing page idea", "Feature Section"],
      ["Why teams create landing pages with AI", "Feature Section"],
      ["How to build AI landing pages in Framer", "How It Works Section"],
      ["Explore Framer’s solutions for designers", "Feature Section"],
      ["Your next idea starts here", "Call to Action Section"],
    ],
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
  technologyDetector?: {
    detect(url: string): Promise<PublicPageBrowserResult["analysis"]["technology"]>;
  };
  isCancelled?: () => Promise<boolean>;
} = {}) {
  const capture = options.capture ?? fixtureCapture();
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
        return capture;
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
        assert.equal(objects.length, 5 + capture.sectionImages.length);
        return { siteId: 7, versionId: 9 };
      },
      async failGenericImport(_url, message) {
        failures.push(message);
      },
    },
    ...(options.analysisProvider
      ? { analysisProvider: options.analysisProvider }
      : {}),
    ...(options.technologyDetector
      ? { technologyDetector: options.technologyDetector }
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
      evidence: [{
        id: "META-1",
        kind: "metadata",
        value: "Pricing page for a business product",
      }],
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
        kind: "inferred",
        text: "Explain pricing",
        evidenceIds: ["META-1"],
        confidence: 0.8,
      }, {
        kind: "inferred",
        text: "Business",
        evidenceIds: ["META-1"],
        confidence: 0.8,
      }],
    }),
  };
}
