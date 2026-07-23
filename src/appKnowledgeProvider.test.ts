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

  assert.equal(provider.model, "vision-model");
  assert.equal(calls.length, 2);
  assert.match(calls[0].system, /visible/i);
  assert.ok(calls[0].image);
  assert.match(calls[1].system, /observed or inferred/i);
  assert.equal(calls[1].image, undefined);
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
