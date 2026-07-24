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
  await provider.synthesizeFlows({
    app: "15five",
    platform: "web",
    flows: [{
      id: "weekly-check-in",
      title: "Submit a weekly check-in",
      steps: [{
        id: "weekly-check-in-step-1",
        order: 1,
        evidenceId: "FLOW-weekly-check-in-STEP-01-IMAGE-9",
      }],
    }],
    allowedFlowIds: ["weekly-check-in"],
    allowedStepIds: ["weekly-check-in-step-1"],
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
  assert.equal(calls.length, 5);
  assert.match(calls[0].system, /visible/i);
  assert.match(calls[0].system, /"viewport": "desktop" \| "tablet" \| "mobile" \| "unknown"/);
  assert.match(calls[0].system, /"layoutPatterns": string\[\]/);
  assert.match(calls[0].system, /"friction": string\[\]/);
  assert.match(calls[0].system, /"tokenCandidates": TokenCandidate\[\]/);
  assert.match(calls[0].system, /"componentOccurrences": ComponentOccurrence\[\]/);
  assert.match(calls[0].system, /normalized top-left coordinates/i);
  assert.match(calls[0].system, /approximate screenshot observations/i);
  assert.match(calls[0].system, /do not claim original CSS/i);
  assert.match(calls[0].system, /at most 24 token candidates/i);
  assert.match(calls[0].system, /at most 24 component occurrences/i);
  assert.match(calls[0].system, /visibleText to at most 24/);
  assert.match(calls[0].system, /every other array to at most 12/);
  assert.ok(calls[0].image);
  assert.match(calls[1].system, /observed or inferred/i);
  assert.equal(calls[1].image, undefined);
  assert.match(calls[2].system, /preserve every supplied Flow and step ID/i);
  assert.match(calls[2].system, /"source": "llm_inferred"/);
  assert.match(calls[2].system, /"reviewStatus": "needs_review"/);
  assert.equal(calls[2].image, undefined);
  assert.match(calls[3].system, /design language/i);
  assert.match(calls[3].system, /"category": string/);
  assert.match(calls[3].system, /"anatomy": string\[\]/);
  assert.match(calls[3].system, /"tokenCandidates": SynthesizedToken\[\]/);
  assert.match(calls[3].system, /"variantCandidates": ComponentVariant\[\]/);
  assert.match(calls[3].system, /"occurrences": ComponentOccurrence\[\]/);
  assert.match(calls[3].system, /"rules": DesignRule\[\]/);
  assert.match(calls[3].system, /"unresolvedConflicts": DesignConflict\[\]/);
  assert.match(calls[3].system, /"source": "llm_inferred"/);
  assert.match(calls[3].system, /"reviewStatus": "needs_review"/);
  assert.match(calls[3].system, /"designLanguageCandidateIds": string\[\]/);
  assert.match(calls[3].system, /"status": "candidate"/);
  assert.match(calls[3].system, /"color": Claim\[\]/);
  assert.match(calls[3].system, /Every field is required/);
  assert.equal(calls[3].image, undefined);
  assert.match(calls[4].system, /merge/i);
  assert.match(calls[4].system, /Do not use tools, terminal, files, or code execution/);
  assert.match(calls[4].system, /at most 16 componentCandidates/);
  assert.match(calls[4].system, /at most 4 claims/);
  assert.match(calls[4].system, /at most 12 representative evidence IDs/);
  assert.equal(calls[4].image, undefined);
});

test("passes one evidence validation error only to the retried request", async () => {
  const calls: Array<{ text: unknown }> = [];
  const provider = appKnowledgeProviderFromMultimodalJsonProvider({
    model: "vision-model",
    async completeJson(input) {
      calls.push(input);
      return { ok: true };
    },
  });
  const base = {
    evidenceId: "SCREEN-1",
    app: "15five",
    platform: "web" as const,
    kind: "screen" as const,
    flowContext: null,
    previousStepContext: null,
  };
  const image = {
    bytes: Buffer.from("image"),
    contentType: "image/png" as const,
  };

  await provider.analyzeEvidence(
    { ...base, validationError: "" },
    image,
    AbortSignal.timeout(1_000),
  );
  await provider.analyzeEvidence(
    { ...base, validationError: "token kind is invalid" },
    image,
    AbortSignal.timeout(1_000),
  );

  assert.equal((calls[0].text as { validationError: string }).validationError, "");
  assert.equal(
    (calls[1].text as { validationError: string }).validationError,
    "token kind is invalid",
  );
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
