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
  pageType: "Settings",
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

  assert.equal(result.pageType, "Settings");
  assert.equal(result.responsiveViewport, "mobile");
  assert.equal(invocations.length, 1);
  assert.match(invocations[0].args.at(-1) ?? "", /Read the screenshot at this exact absolute path/);
  assert.match(invocations[0].args.at(-1) ?? "", /iOS application screenshot/);
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
