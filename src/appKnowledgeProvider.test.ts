import assert from "node:assert/strict";
import { test } from "node:test";
import type { MultimodalJsonProvider } from "./evidenceAnalysisProvider.ts";
import {
  appKnowledgeBrowserPrompt,
  appKnowledgeProviderFromMultimodalJsonProvider,
} from "./appKnowledgeProvider.ts";

test("adapts evidence and synthesis prompts to one multimodal JSON transport", async () => {
  const calls: Array<{ system: string; text: unknown; image?: unknown }> = [];
  const transport: MultimodalJsonProvider = {
    model: "vision-model",
    async completeJson(input) {
      calls.push(input);
      return { ok: true };
    },
  };
  const provider = appKnowledgeProviderFromMultimodalJsonProvider(transport);

  await provider.analyzeEvidence({
    evidenceId: "SCREEN-1",
    app: "15five",
    platform: "web",
    kind: "screen",
    flowContext: null,
    previousStepContext: null,
    validationError: "",
  }, {
    bytes: Buffer.from("image"),
    contentType: "image/png",
  }, AbortSignal.timeout(1_000));
  await provider.synthesize({
    app: "15five",
    platform: "web",
    captureVersionId: 7,
    analyses: [],
    flows: [],
    coverage: {},
    allowedEvidenceIds: ["SCREEN-1"],
    validationError: "",
  }, AbortSignal.timeout(1_000));
  await provider.synthesizeDesignSystemChunk({
    app: "15five",
    platform: "web",
    signals: [{ evidenceId: "SCREEN-1" }],
    allowedEvidenceIds: ["SCREEN-1"],
    validationError: "",
  }, AbortSignal.timeout(1_000));
  await provider.mergeDesignSystem({
    app: "15five",
    platform: "web",
    fragments: [{ componentCandidates: [], designLanguage: {} }],
    allowedEvidenceIds: ["SCREEN-1"],
    validationError: "",
  }, AbortSignal.timeout(1_000));

  assert.equal(provider.model, "vision-model");
  assert.equal(calls.length, 4);
  assert.match(calls[0].system, /visible/i);
  assert.match(calls[0].system, /"viewport": "desktop" \| "tablet" \| "mobile" \| "unknown"/);
  assert.match(calls[0].system, /"layoutPatterns": string\[\]/);
  assert.match(calls[0].system, /"friction": string\[\]/);
  assert.match(calls[0].system, /visibleText to at most 24/);
  assert.match(calls[0].system, /every other array to at most 12/);
  assert.ok(calls[0].image);
  assert.match(calls[1].system, /observed or inferred/i);
  assert.equal(calls[1].image, undefined);
  assert.match(calls[2].system, /design language/i);
  assert.match(calls[2].system, /"category": string/);
  assert.match(calls[2].system, /"anatomy": string\[\]/);
  assert.match(calls[2].system, /"designLanguageCandidateIds": string\[\]/);
  assert.match(calls[2].system, /"status": "candidate"/);
  assert.match(calls[2].system, /"color": Claim\[\]/);
  assert.match(calls[2].system, /Every field is required/);
  assert.equal(calls[2].image, undefined);
  assert.match(calls[3].system, /merge/i);
  assert.match(calls[3].system, /Do not use tools, terminal, files, or code execution/);
  assert.equal(calls[3].image, undefined);
});

test("renders browser prompts with the same instructions and structured payload", () => {
  const rendered = appKnowledgeBrowserPrompt("Return JSON only.", {
    evidenceId: "SCREEN-1",
    app: "15five",
    platform: "web",
    kind: "screen",
    flowContext: null,
    previousStepContext: null,
    validationError: "",
  });
  assert.match(rendered, /^Return JSON only\./);
  assert.match(rendered, /"evidenceId":"SCREEN-1"/);
});
