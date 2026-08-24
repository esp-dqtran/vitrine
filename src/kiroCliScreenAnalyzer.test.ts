import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  createKiroCliScreenAnalyzer,
  kiroCliScreenConfigFromEnvironment,
} from "./kiroCliScreenAnalyzer.ts";
import type { KiroCliInvocation } from "./kiroCliFeatureDocumentProvider.ts";

const VALID_ANALYSIS = {
  description: "A settings screen with a navigation bar and account rows.",
  purpose: "Manage account settings",
  pageType: "Settings & Preferences",
  sourcePresentation: "direct-screen",
  productArea: "Account",
  theme: "light",
  visibleStates: ["selected account tab"],
  componentNames: ["Navigation Bar", "Settings List"],
  responsiveViewport: "mobile",
  confidence: 0.94,
};

test("Kiro screen config uses dedicated settings and safe fallbacks", () => {
  assert.deepEqual(
    kiroCliScreenConfigFromEnvironment({
      KIRO_CLI_BIN: "kiro-test",
      KIRO_CLI_SCREEN_MODEL: "screen-model",
      KIRO_CLI_SCREEN_EFFORT: "medium",
      KIRO_CLI_SCREEN_CWD: "/tmp",
      KIRO_CLI_SCREEN_MAX_OUTPUT_BYTES: "1234",
    }),
    {
      binary: "kiro-test",
      model: "screen-model",
      providerModel: "kiro-cli:screen-model-screen-analysis",
      effort: "medium",
      cwd: "/tmp",
      maxOutputBytes: 1234,
    },
  );
});

test("Kiro screen analyzer reads the normalized image and parses the final JSON", async () => {
  const invocations: KiroCliInvocation[] = [];
  const analyzer = createKiroCliScreenAnalyzer(
    {
      KIRO_CLI_SCREEN_MODEL: "screen-model",
      KIRO_CLI_SCREEN_CWD: "/tmp",
    },
    async (invocation) => {
      invocations.push(invocation);
      return `progress\n${JSON.stringify(VALID_ANALYSIS)}\n`;
    },
  );
  const body = await sharp({
    create: {
      width: 12,
      height: 12,
      channels: 3,
      background: "#ffffff",
    },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "ios",
    signal: new AbortController().signal,
  });

  assert.equal(result.pageType, "Settings & Preferences");
  assert.equal(result.responsiveViewport, "mobile");
  assert.equal(invocations.length, 1);
  assert.match(invocations[0].args.at(-1) ?? "", /Read the screenshot at this exact absolute path/);
  assert.match(invocations[0].args.at(-1) ?? "", /iOS application screenshot/);
  assert.match(invocations[0].args.at(-1) ?? "", /marketing-composite/);
  assert.match(invocations[0].args.at(-1) ?? "", /Set pageType to Feature Info/);
  assert.match(invocations[0].args.at(-1) ?? "", /must not exceed 0\.90/);
  assert.ok(invocations[0].args.includes("--trust-tools=fs_read"));
});

test("Kiro screen analyzer retries one invalid structured response", async () => {
  let attempts = 0;
  const analyzer = createKiroCliScreenAnalyzer(
    { KIRO_CLI_SCREEN_CWD: "/tmp" },
    async (invocation) => {
      attempts += 1;
      if (attempts === 1) return "{\"description\":\"incomplete\"}";
      assert.match(invocation.args.at(-1) ?? "", /previous response failed validation/i);
      return JSON.stringify(VALID_ANALYSIS);
    },
  );
  const body = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#000000",
    },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "ios",
    signal: new AbortController().signal,
  });

  assert.equal(result.productArea, "Account");
  assert.equal(attempts, 2);
});

test("Kiro screen analyzer rejects a page type outside the Vitrines taxonomy", async () => {
  let attempts = 0;
  const analyzer = createKiroCliScreenAnalyzer(
    { KIRO_CLI_SCREEN_CWD: "/tmp" },
    async (invocation) => {
      attempts += 1;
      if (attempts === 1) {
        return JSON.stringify({ ...VALID_ANALYSIS, pageType: "Settings" });
      }
      assert.match(invocation.args.at(-1) ?? "", /Unsupported Vitrines screen category: Settings/);
      return JSON.stringify(VALID_ANALYSIS);
    },
  );
  const body = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#000000" },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "web",
    signal: new AbortController().signal,
  });

  assert.equal(result.pageType, "Settings & Preferences");
  assert.equal(attempts, 2);
});

test("Kiro screen analyzer requires an embedded category for marketing composites", async () => {
  let attempts = 0;
  const analyzer = createKiroCliScreenAnalyzer(
    { KIRO_CLI_SCREEN_CWD: "/tmp" },
    async (invocation) => {
      attempts += 1;
      if (attempts === 1) {
        return JSON.stringify({
          ...VALID_ANALYSIS,
          pageType: "Feature Info",
          sourcePresentation: "marketing-composite",
          confidence: 0.84,
        });
      }
      assert.match(invocation.args.at(-1) ?? "", /Marketing composites require embeddedPageType/);
      return JSON.stringify({
        ...VALID_ANALYSIS,
        pageType: "Feature Info",
        sourcePresentation: "marketing-composite",
        embeddedPageType: "News Feed",
        confidence: 0.84,
      });
    },
  );
  const body = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#000000" },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "ios",
    signal: new AbortController().signal,
  });

  assert.equal(result.pageType, "Feature Info");
  assert.equal(result.embeddedPageType, "News Feed");
  assert.equal(attempts, 2);
});

test("Kiro screen analyzer classifies the outer marketing composite as Feature Info", async () => {
  let attempts = 0;
  const analyzer = createKiroCliScreenAnalyzer(
    { KIRO_CLI_SCREEN_CWD: "/tmp" },
    async (invocation) => {
      attempts += 1;
      const composite = {
        ...VALID_ANALYSIS,
        sourcePresentation: "marketing-composite",
        embeddedPageType: "News Feed",
        confidence: 0.84,
      };
      if (attempts === 1) return JSON.stringify({ ...composite, pageType: "News Feed" });
      assert.match(invocation.args.at(-1) ?? "", /Marketing composites require pageType Feature Info/);
      return JSON.stringify({ ...composite, pageType: "Feature Info" });
    },
  );
  const body = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#000000" },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "ios",
    signal: new AbortController().signal,
  });

  assert.equal(result.pageType, "Feature Info");
  assert.equal(attempts, 2);
});

test("Kiro screen analyzer rejects overconfident composite analysis", async () => {
  let attempts = 0;
  const analyzer = createKiroCliScreenAnalyzer(
    { KIRO_CLI_SCREEN_CWD: "/tmp" },
    async (invocation) => {
      attempts += 1;
      const composite = {
        ...VALID_ANALYSIS,
        pageType: "Feature Info",
        sourcePresentation: "marketing-composite",
        embeddedPageType: "News Feed",
      };
      if (attempts === 1) return JSON.stringify({ ...composite, confidence: 0.99 });
      assert.match(invocation.args.at(-1) ?? "", /confidence at or below 0\.90/);
      return JSON.stringify({ ...composite, confidence: 0.84 });
    },
  );
  const body = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#000000" },
  }).png().toBuffer();

  const result = await analyzer.analyze({
    body,
    platform: "ios",
    signal: new AbortController().signal,
  });

  assert.equal(result.confidence, 0.84);
  assert.equal(attempts, 2);
});
