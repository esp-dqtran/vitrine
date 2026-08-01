import assert from "node:assert/strict";
import { test } from "node:test";
import type { FeatureStepPrompt, FeatureSynthesisPrompt } from "./featureDocument.ts";
import {
  claudeCliFeatureDocumentConfigFromEnvironment,
  createClaudeCliFeatureDocumentProvider,
  createFeatureDocumentProviderFromEnvironment,
} from "./claudeCliFeatureDocumentProvider.ts";
import type { KiroCliInvocation } from "./kiroCliFeatureDocumentProvider.ts";

const environment = {
  CLAUDE_CLI_FEATURE_DOCUMENT_MODEL: "claude-sonnet-5",
  CLAUDE_CLI_BIN: "/opt/claude",
  CLAUDE_CLI_FEATURE_DOCUMENT_CWD: process.cwd(),
};

const source = {
  app: "amazon-shopping",
  platform: "ios" as const,
  versionId: 284,
  flowId: "flow-cart",
  title: "Cart",
  description: "Review the cart",
  tags: ["cart"],
};

const step: FeatureStepPrompt = {
  source,
  stepIndex: 0,
  imageIndex: 0,
  evidenceId: "FLOW-STEP-01-IMAGE-42",
  stepLabel: "Open cart",
  focusInstruction: "Document only visible behavior",
};

const synthesis: FeatureSynthesisPrompt = {
  source,
  focusInstruction: step.focusInstruction,
  evidenceManifest: [{
    stepIndex: 0,
    imageIndex: 0,
    imageId: 42,
    evidenceId: step.evidenceId,
    stepLabel: step.stepLabel,
    description: null,
  }],
  analyses: [{
    evidenceId: step.evidenceId,
    visibleUi: ["Cart"],
    visibleText: ["Proceed to checkout"],
    likelyIntent: "Review cart contents",
    availableActions: ["Proceed to checkout"],
    systemFeedback: [],
    friction: [],
    missingOrUncertainStates: [],
    accessibility: [],
    confidence: 0.95,
  }],
  allowedEvidenceIds: [step.evidenceId],
};

test("configures the Claude CLI provider from the environment", () => {
  const config = claudeCliFeatureDocumentConfigFromEnvironment(environment)!;
  assert.equal(config.binary, "/opt/claude");
  assert.equal(config.model, "claude-sonnet-5");
  assert.equal(config.providerModel, "claude-cli:claude-sonnet-5");
  assert.equal(config.officialDocumentationEnabled, false);
  assert.deepEqual(config.officialDocumentationDomains, []);
  assert.equal(claudeCliFeatureDocumentConfigFromEnvironment({})!.binary, "claude");
  assert.equal(createClaudeCliFeatureDocumentProvider({
    ...environment,
    CLAUDE_CLI_FEATURE_DOCUMENT_ENABLED: "false",
  }), undefined);
});

test("invokes claude in headless print mode with only the Read tool", async () => {
  let invocation: KiroCliInvocation | undefined;
  const provider = createClaudeCliFeatureDocumentProvider(environment, async (input) => {
    invocation = input;
    return JSON.stringify({
      evidenceId: step.evidenceId,
      visibleUi: ["Cart"],
      visibleText: ["Proceed to checkout"],
      likelyIntent: "Review cart contents",
      availableActions: [],
      systemFeedback: [],
      friction: [],
      missingOrUncertainStates: [],
      accessibility: [],
      confidence: 0.9,
    });
  })!;

  const image = { contentType: "image/png" as const, bytes: Buffer.from([137, 80]) };
  await provider.analyzeImage(step, image, new AbortController().signal);

  assert.equal(invocation?.binary, "/opt/claude");
  assert.equal(invocation?.label, "Claude CLI");
  assert.deepEqual(invocation?.args.slice(0, 5), [
    "--print",
    "--output-format",
    "text",
    "--model",
    "claude-sonnet-5",
  ]);
  assert.equal(invocation?.args[5], "--allowedTools");
  assert.equal(invocation?.args[6], "Read");
  assert.match(invocation?.args.at(-1) ?? "", /Read the screenshot at this exact absolute path/);
});

test("enables WebSearch only for official documentation synthesis", async () => {
  let invocation: KiroCliInvocation | undefined;
  const provider = createClaudeCliFeatureDocumentProvider({
    ...environment,
    CLAUDE_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION: "true",
  }, async (input) => {
    invocation = input;
    return JSON.stringify({
      documentedContext: { status: "not-found", sources: [], claims: [] },
      executiveSummary: {},
      observedFlow: {},
      requirements: [],
    });
  })!;

  await provider.synthesize(synthesis, new AbortController().signal);

  assert.equal(provider.model, "claude-cli:claude-sonnet-5+official-docs");
  assert.equal(invocation?.args[5], "--allowedTools");
  assert.equal(invocation?.args[6], "WebSearch");
});

test("selects the provider from FEATURE_DOCUMENT_PROVIDER", () => {
  const claude = createFeatureDocumentProviderFromEnvironment({
    ...environment,
    FEATURE_DOCUMENT_PROVIDER: "claude",
  })!;
  assert.equal(claude.model, "claude-cli:claude-sonnet-5");
  const kiro = createFeatureDocumentProviderFromEnvironment({})!;
  assert.equal(kiro.model, "kiro-cli:gpt-5.6-terra");
  assert.throws(() => createFeatureDocumentProviderFromEnvironment({
    FEATURE_DOCUMENT_PROVIDER: "gemini",
  }), /must be kiro or claude/);
});
