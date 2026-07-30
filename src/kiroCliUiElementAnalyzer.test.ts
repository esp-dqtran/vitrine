import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";
import {
  createKiroCliUiElementAnalyzer,
  kiroCliUiElementConfigFromEnvironment,
  type KiroCliUiElementConfig,
} from "./kiroCliUiElementAnalyzer.ts";
import type { KiroCliInvocation } from "./kiroCliFeatureDocumentProvider.ts";

const environment = {
  KIRO_CLI_BIN: "/opt/kiro-cli",
  KIRO_CLI_UI_ELEMENT_MODEL: "gpt-5.6-terra",
  KIRO_CLI_UI_ELEMENT_EFFORT: "high",
  KIRO_CLI_UI_ELEMENT_CWD: process.cwd(),
};

const screenPatterns = [
  { slug: "verification", name: "Verification", section: "New User Experience" },
];

function validResult() {
  return {
    summary: "Verification is processing",
    screenAnalysis: {
      description: "A verification screen with a spinner",
      purpose: "Wait for verification",
      pageType: "Verification",
      productArea: "Account",
      theme: "light",
      visibleStates: ["loading"],
      componentNames: ["Loading Indicator"],
      visibleText: [],
      layoutPatterns: ["Centered content"],
      icons: [],
      imagery: [],
      contentPatterns: [],
      interactionPatterns: [],
      responsiveViewport: "mobile",
      confidence: 0.98,
    },
    screenPatterns: [{ slug: "verification", confidence: 0.96 }],
    components: [{
      type: "Loading Indicator",
      variant: "Circular",
      purpose: "Shows progress",
      anatomy: ["Arc"],
      visibleStates: ["Loading"],
      observedProperties: ["Orange"],
      region: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
      confidence: 0.98,
    }],
  };
}

test("configures a distinct Kiro UI-element provider identity", () => {
  const config: KiroCliUiElementConfig =
    kiroCliUiElementConfigFromEnvironment(environment);
  assert.equal(config.binary, "/opt/kiro-cli");
  assert.equal(config.model, "gpt-5.6-terra");
  assert.equal(config.providerModel, "kiro-cli:gpt-5.6-terra-ui-elements");
  assert.equal(config.effort, "high");
});

test("reads a dimension-bounded private image and removes it after analysis", async () => {
  let invocation: KiroCliInvocation | undefined;
  let imagePath = "";
  const analyzer = createKiroCliUiElementAnalyzer(environment, async (input) => {
    invocation = input;
    const prompt = input.args.at(-1)!;
    imagePath = prompt.match(/absolute path with the read tool: ([^\n]+)/)?.[1] ?? "";
    await access(imagePath);
    const metadata = await sharp(imagePath).metadata();
    assert.ok((metadata.width ?? 0) <= 2_000);
    assert.ok((metadata.height ?? 0) <= 2_000);
    return `progress\n${JSON.stringify(validResult())}\nCredits: 0.1`;
  });
  const source = await sharp({
    create: {
      width: 1_200,
      height: 2_800,
      channels: 4,
      background: "white",
    },
  }).png().toBuffer();
  const result = await analyzer.analyze({
    body: source,
    platform: "ios",
    screenPatterns,
    signal: new AbortController().signal,
  });

  assert.equal(result.components[0].type, "Loading Indicator");
  assert.deepEqual(invocation?.args.slice(0, 7), [
    "chat",
    "--model",
    "gpt-5.6-terra",
    "--effort",
    "high",
    "--no-interactive",
    "--trust-tools=fs_read",
  ]);
  await assert.rejects(() => access(imagePath));
});

test("retries once with the exact validation error", async () => {
  const prompts: string[] = [];
  const analyzer = createKiroCliUiElementAnalyzer(environment, async (input) => {
    prompts.push(input.args.at(-1)!);
    return prompts.length === 1
      ? "{\"summary\":\"incomplete\"}"
      : JSON.stringify(validResult());
  });
  const result = await analyzer.analyze({
    body: await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: "white",
      },
    }).png().toBuffer(),
    platform: "ios",
    screenPatterns,
    signal: new AbortController().signal,
  });

  assert.equal(result.components.length, 1);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /previous response failed validation/i);
});
