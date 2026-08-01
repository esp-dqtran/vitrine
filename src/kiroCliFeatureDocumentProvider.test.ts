import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import {
  featureDocumentClaimBudget,
  type FeatureStepPrompt,
  type FeatureSynthesisPrompt,
} from "./featureDocument.ts";
import {
  createKiroCliFeatureDocumentProvider,
  extractKiroCliJson,
  kiroCliFeatureDocumentConfigFromEnvironment,
  kiroCliFeatureDocumentProviderModelFromEnvironment,
  type KiroCliInvocation,
} from "./kiroCliFeatureDocumentProvider.ts";

const environment = {
  KIRO_CLI_FEATURE_DOCUMENT_MODEL: "gpt-5.6-terra",
  KIRO_CLI_FEATURE_DOCUMENT_EFFORT: "high",
  KIRO_CLI_BIN: "/opt/kiro-cli",
  KIRO_CLI_FEATURE_DOCUMENT_CWD: process.cwd(),
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

test("uses Kiro CLI as the default Feature Document provider", () => {
  const config = kiroCliFeatureDocumentConfigFromEnvironment(environment)!;
  assert.equal(config.binary, "/opt/kiro-cli");
  assert.equal(config.model, "gpt-5.6-terra");
  assert.equal(config.providerModel, "kiro-cli:gpt-5.6-terra");
  assert.equal(config.effort, "high");
  assert.equal(config.officialDocumentationEnabled, false);
  assert.deepEqual(config.officialDocumentationDomains, []);
  assert.equal(
    kiroCliFeatureDocumentProviderModelFromEnvironment(environment),
    "kiro-cli:gpt-5.6-terra",
  );
  assert.equal(createKiroCliFeatureDocumentProvider({
    ...environment,
    KIRO_CLI_FEATURE_DOCUMENT_ENABLED: "false",
  }), undefined);
});

test("enables official-document discovery without a domain allowlist", async () => {
  let invocation: KiroCliInvocation | undefined;
  const provider = createKiroCliFeatureDocumentProvider({
    ...environment,
    KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION: "true",
  }, async (input) => {
    invocation = input;
    return JSON.stringify({
      documentedContext: {
        status: "not-found",
        sources: [],
        claims: [],
      },
      executiveSummary: {},
      observedFlow: {},
      requirements: [],
    });
  })!;

  await provider.synthesize(synthesis, new AbortController().signal);

  assert.equal(provider.model, "kiro-cli:gpt-5.6-terra+official-docs");
  assert.equal(provider.officialDocumentationEnabled, true);
  assert.deepEqual(provider.officialDocumentationDomains, []);
  assert.equal(invocation?.args[6], "--trust-tools=web_search");
  const prompt = invocation?.args.at(-1) ?? "";
  assert.match(prompt, /discover relevant first-party official documentation/);
  assert.match(prompt, /without assuming its domain in advance/);
  assert.match(prompt, /Do not substitute third-party material/);
  assert.match(prompt, /documentedContext/);
});

test("enables official-document search only for an explicit domain allowlist", async () => {
  let invocation: KiroCliInvocation | undefined;
  const provider = createKiroCliFeatureDocumentProvider({
    ...environment,
    KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS:
      "shopee.co.id, help.shopee.co.id,shopee.co.id",
  }, async (input) => {
    invocation = input;
    return JSON.stringify({
      documentedContext: {
        status: "not-found",
        sources: [],
        claims: [],
      },
      executiveSummary: {},
      observedFlow: {},
      requirements: [],
    });
  })!;

  await provider.synthesize(synthesis, new AbortController().signal);

  assert.equal(provider.model, "kiro-cli:gpt-5.6-terra+official-docs");
  assert.equal(provider.officialDocumentationEnabled, true);
  assert.deepEqual(provider.officialDocumentationDomains, [
    "shopee.co.id",
    "help.shopee.co.id",
  ]);
  assert.equal(invocation?.args[6], "--trust-tools=web_search");
  const prompt = invocation?.args.at(-1) ?? "";
  assert.match(prompt, /Use web search only for official documentation/);
  assert.match(prompt, /shopee\.co\.id/);
  assert.match(prompt, /help\.shopee\.co\.id/);
  assert.match(prompt, /documentedContext/);
  assert.match(prompt, /supports.*extends.*conflicts.*unrelated/);
  assert.match(prompt, /must never be described as observed/);
});

test("rejects unsafe official-document domains", () => {
  assert.throws(
    () => kiroCliFeatureDocumentConfigFromEnvironment({
      ...environment,
      KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS: "https://shopee.co.id",
    }),
    /Invalid official documentation domain/,
  );
});

test("extracts the final matching JSON object from Kiro terminal output", () => {
  const output = `progress {\"tool\":\"read\"}\n\u001b[0m{\"evidenceId\":\"S01\",\"visibleUi\":[],\"visibleText\":[]}\nCredits: 0.15`;
  assert.deepEqual(
    extractKiroCliJson(output, (candidate) => candidate.evidenceId === "S01"),
    { evidenceId: "S01", visibleUi: [], visibleText: [] },
  );
});

test("analyzes one temporary screenshot with fs_read and removes it afterward", async () => {
  let invocation: KiroCliInvocation | undefined;
  let imagePath = "";
  const provider = createKiroCliFeatureDocumentProvider(environment, async (input) => {
    invocation = input;
    const prompt = input.args.at(-1)!;
    imagePath = prompt.match(/absolute path with the read tool: ([^\n]+)/)?.[1] ?? "";
    await access(imagePath);
    return JSON.stringify({
      evidenceId: step.evidenceId,
      visibleUi: ["Cart"],
      visibleText: ["Proceed to checkout"],
      likelyIntent: "Review cart",
      availableActions: ["Proceed to checkout"],
      systemFeedback: [],
      friction: [],
      missingOrUncertainStates: [],
      accessibility: [],
      confidence: 0.9,
    });
  })!;
  const result = await provider.analyzeImage(
    step,
    { bytes: Buffer.from("png"), contentType: "image/png" },
    new AbortController().signal,
  );

  assert.equal(result && (result as { evidenceId: string }).evidenceId, step.evidenceId);
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

test("analyzes all ordered Flow screenshots in one Kiro invocation", async () => {
  let invocation: KiroCliInvocation | undefined;
  let imagePaths: string[] = [];
  const provider = createKiroCliFeatureDocumentProvider(environment, async (input) => {
    invocation = input;
    const prompt = input.args.at(-1)!;
    const serialized = prompt.match(/Ordered screenshots: (.+)\nFlow input:/)?.[1] ?? "[]";
    imagePaths = (JSON.parse(serialized) as Array<{ path: string }>).map(({ path }) => path);
    await Promise.all(imagePaths.map((path) => access(path)));
    return JSON.stringify({
      screens: [
        {
          evidenceId: "FLOW-STEP-01-IMAGE-42",
          visibleState: "Cart",
          visibleText: ["Proceed"],
          availableActions: ["Proceed"],
          visibleFeedback: [],
          uncertainty: [],
          confidence: 0.9,
        },
        {
          evidenceId: "FLOW-STEP-02-IMAGE-43",
          visibleState: "Checkout",
          visibleText: ["Pay"],
          availableActions: ["Pay"],
          visibleFeedback: [],
          uncertainty: [],
          confidence: 0.9,
        },
      ],
      flow: {
        assessment: {
          captureType: "partial-journey",
          completeness: "partial",
          rationale: "No interaction metadata.",
        },
        summary: {
          purpose: { kind: "inferred", text: "Review checkout", evidenceIds: [step.evidenceId] },
          userValue: { kind: "inferred", text: "Complete payment", evidenceIds: [secondEvidence.evidenceId] },
          recommendation: { kind: "proposed", text: "Replicate the evidence", evidenceIds: [] },
        },
        goal: { kind: "inferred", text: "Complete checkout", evidenceIds: [step.evidenceId] },
        entryPoint: { kind: "observed", text: "Cart is visible", evidenceIds: [step.evidenceId] },
        completionPoint: { kind: "unknown", text: "Completion is not shown", evidenceIds: [] },
        states: [],
        transitions: [],
        friction: [],
        missingStates: [],
        openQuestions: [],
        replicationProblem: "Replicate the captured checkout states.",
        implementation: {
          targetUser: "A buyer reviewing a purchase.",
          goal: "Enable the buyer to complete the captured checkout path.",
          nonGoal: "Do not define fulfillment behavior that is absent from the capture.",
          behavior: "Preserve cart context while presenting the checkout state.",
          journey: "The buyer reviews the cart and proceeds to the checkout state.",
          edgeCases: "Keep entered context recoverable when the transition cannot complete.",
          dependency: "The implementation depends on cart and checkout state management.",
          risk: "The screenshots do not establish payment submission behavior.",
          analyticsEvent: {
            name: "checkout_started",
            trigger: "the buyer proceeds from the cart into checkout",
            properties: ["source_state", "destination_state"],
          },
          successMetric: {
            name: "checkout progression rate",
            definition: "checkout entries reaching the captured completion boundary divided by checkout entries",
          },
          guardrailMetric: {
            name: "checkout_transition_failure_rate",
            definition: "cart-to-checkout transitions without checkout appearing divided by cart-to-checkout attempts",
          },
        },
        requirements: [{
          kind: "observed",
          text: "Present the cart and checkout states",
          evidenceIds: [step.evidenceId, secondEvidence.evidenceId],
          userStory: "As a buyer, I can review checkout.",
          criteria: [{
            kind: "observed",
            given: "the captures are available",
            when: "the flow is presented",
            then: "the cart and checkout states are visible",
            evidenceIds: [step.evidenceId, secondEvidence.evidenceId],
          }],
        }],
      },
    });
  })!;
  const secondEvidence = {
    ...synthesis.evidenceManifest[0],
    stepIndex: 1,
    imageId: 43,
    evidenceId: "FLOW-STEP-02-IMAGE-43",
    stepLabel: "Checkout",
  };
  const analyzeFlow = provider.analyzeFlow;
  assert.ok(analyzeFlow);
  const result = await analyzeFlow({
    source,
    focusInstruction: step.focusInstruction,
    evidenceManifest: [synthesis.evidenceManifest[0], secondEvidence],
    allowedEvidenceIds: [step.evidenceId, secondEvidence.evidenceId],
  }, [
    {
      evidence: synthesis.evidenceManifest[0],
      image: { bytes: Buffer.from("first"), contentType: "image/png" },
    },
    {
      evidence: secondEvidence,
      image: { bytes: Buffer.from("second"), contentType: "image/jpeg" },
    },
  ], new AbortController().signal);

  assert.equal(invocation?.args[6], "--trust-tools=fs_read");
  assert.equal(imagePaths.length, 2);
  assert.match(invocation?.args.at(-1) ?? "", /Analyze this entire Flow/);
  assert.match(invocation?.args.at(-1) ?? "", /FLOW-STEP-01-IMAGE-42.*FLOW-STEP-02-IMAGE-43/s);
  assert.equal((result as { analyses: unknown[] }).analyses.length, 2);
  assert.equal(
    (result as { document: { requirements: Array<{ id: string }> } }).document.requirements[0].id,
    "REQ-001",
  );
  const document = (result as {
    document: {
      proposedFeature: { targetUsers: Array<{ kind: string; text: string; evidenceIds: string[] }> };
      edgeCases: Array<{ kind: string; text: string }>;
      flowAnalysis: { risksAndAssumptions: Array<{ kind: string; text: string }> };
      analyticsEvents: Array<{ kind: string; text: string }>;
      successMetrics: Array<{ kind: string; text: string }>;
      guardrailMetrics: Array<{ kind: string; text: string }>;
    };
  }).document;
  assert.deepEqual(document.proposedFeature.targetUsers[0], {
    id: "CLM-009",
    kind: "proposed",
    text: "Review required: A buyer reviewing a purchase.",
    evidenceIds: [],
  });
  assert.equal(document.edgeCases[0].kind, "proposed");
  assert.equal(document.flowAnalysis.risksAndAssumptions[0].kind, "unknown");
  assert.equal(document.analyticsEvents[0].kind, "proposed");
  assert.match(document.analyticsEvents[0].text, /checkout_started/);
  assert.match(document.successMetrics[0].text, /numerator|divided by/i);
  assert.match(document.guardrailMetrics[0].text, /failure_rate/i);
  assert.match(invocation?.args.at(-1) ?? "", /ImplementationBrief/);
  assert.match(invocation?.args.at(-1) ?? "", /Do not invent vendor names/);
  await Promise.all(imagePaths.map((path) => assert.rejects(() => access(path))));
});

test("synthesizes the canonical Feature Document shape without image paths", async () => {
  let prompt = "";
  const provider = createKiroCliFeatureDocumentProvider(environment, async (input) => {
    prompt = input.args.at(-1)!;
    return JSON.stringify({
      executiveSummary: {},
      observedFlow: {},
      requirements: [],
    });
  })!;
  const result = await provider.synthesize(synthesis, new AbortController().signal);

  assert.deepEqual(result, { executiveSummary: {}, observedFlow: {}, requirements: [] });
  assert.match(prompt, /capability-level replica behavior/);
  assert.match(prompt, /Every top-level key below is required/);
  assert.match(prompt, /sourceAssessment/);
  assert.match(prompt, /unscopedEvidence/);
  assert.match(prompt, /observedFlow.*userGoal.*entryPoint.*completionPoint/);
  assert.match(prompt, /globally unique id values/);
  assert.match(prompt, /at most 1 replication requirements/);
  assert.match(prompt, /at most 24 total Claims/);
  assert.match(prompt, /\"priority\":\"unranked\"/);
  assert.match(prompt, /\"kind\":\"observed\"\|\"inferred\"/);
  assert.match(prompt, /FLOW-STEP-01-IMAGE-42/);
  assert.doesNotMatch(prompt, /astryx-kiro-feature-/);
});

test("trims over-budget evidence claims so any provider stays within the claim budget", async () => {
  const overflow = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => ({
      kind: "observed",
      text: `${prefix} ${index + 1}`,
      evidenceIds: [step.evidenceId],
    }));
  const provider = createKiroCliFeatureDocumentProvider(environment, async () =>
    JSON.stringify({
      screens: [{
        evidenceId: step.evidenceId,
        visibleState: "Cart",
        visibleText: ["Proceed"],
        availableActions: ["Proceed"],
        visibleFeedback: [],
        uncertainty: [],
        confidence: 0.9,
      }],
      flow: {
        assessment: { captureType: "static-screen", completeness: "partial", rationale: "One capture." },
        summary: {
          purpose: { kind: "inferred", text: "Review cart", evidenceIds: [step.evidenceId] },
          userValue: { kind: "inferred", text: "See totals", evidenceIds: [step.evidenceId] },
          recommendation: { kind: "proposed", text: "Replicate", evidenceIds: [] },
        },
        goal: { kind: "inferred", text: "Review cart", evidenceIds: [step.evidenceId] },
        entryPoint: { kind: "observed", text: "Cart visible", evidenceIds: [step.evidenceId] },
        completionPoint: { kind: "unknown", text: "Not shown", evidenceIds: [] },
        states: overflow(20, "State"),
        transitions: overflow(20, "Transition"),
        friction: overflow(20, "Friction"),
        missingStates: overflow(20, "Missing"),
        openQuestions: overflow(20, "Question"),
        replicationProblem: "Replicate the captured cart state.",
        implementation: {
          targetUser: "A buyer reviewing a purchase.",
          goal: "Enable the buyer to review the cart.",
          nonGoal: "Do not define checkout behavior.",
          behavior: "Present the cart state.",
          journey: "The buyer opens the cart.",
          edgeCases: "Keep the cart recoverable when loading fails.",
          dependency: "The implementation depends on cart state management.",
          risk: "The screenshots do not establish persistence.",
          analyticsEvent: {
            name: "cart_viewed",
            trigger: "the buyer opens the cart",
            properties: ["source_state"],
          },
          successMetric: {
            name: "cart view rate",
            definition: "cart views divided by sessions",
          },
          guardrailMetric: {
            name: "cart_load_failure_rate",
            definition: "cart opens without the cart appearing divided by cart opens",
          },
        },
        requirements: [{
          kind: "observed",
          text: "Present the cart state",
          evidenceIds: [step.evidenceId],
          userStory: "As a buyer, I can review my cart.",
          criteria: [{
            kind: "observed",
            given: "the capture is available",
            when: "the flow is presented",
            then: "the cart state is visible",
            evidenceIds: [step.evidenceId],
          }],
        }],
      },
    }))!;

  const result = await provider.analyzeFlow!({
    source,
    focusInstruction: step.focusInstruction,
    evidenceManifest: [synthesis.evidenceManifest[0]],
    allowedEvidenceIds: [step.evidenceId],
  }, [{
    evidence: synthesis.evidenceManifest[0],
    image: { bytes: Buffer.from("first"), contentType: "image/png" },
  }], new AbortController().signal);

  const document = (result as { document: Record<string, any> }).document;
  const claims = [
    document.executiveSummary.purpose,
    document.executiveSummary.userValue,
    document.executiveSummary.recommendation,
    document.observedFlow.userGoal,
    document.observedFlow.entryPoint,
    document.observedFlow.completionPoint,
    ...document.observedFlow.journey,
    ...document.observedFlow.actors,
    ...document.observedFlow.visibleStates,
    ...document.flowAnalysis.effectivePatterns,
    ...document.flowAnalysis.friction,
    ...document.flowAnalysis.missingStates,
    ...document.flowAnalysis.inconsistencies,
    ...document.flowAnalysis.risksAndAssumptions,
    document.proposedFeature.problem,
    ...document.proposedFeature.targetUsers,
    ...document.proposedFeature.goals,
    ...document.proposedFeature.nonGoals,
    ...document.proposedFeature.behavior,
    ...document.proposedFeature.journey,
    ...document.requirements,
    ...document.edgeCases,
    ...document.successMetrics,
    ...document.guardrailMetrics,
    ...document.analyticsEvents,
    ...document.dependencies,
    ...document.openQuestions,
  ];
  assert.ok(
    claims.length <= featureDocumentClaimBudget(1),
    `expected at most ${featureDocumentClaimBudget(1)} claims, received ${claims.length}`,
  );
  assert.equal(new Set(claims.map((claim: { id: string }) => claim.id)).size, claims.length);
});

test("states the previous validation error at the top of a retry prompt", async () => {
  let prompt = "";
  const provider = createKiroCliFeatureDocumentProvider(environment, async (input) => {
    prompt = input.args.at(-1)!;
    throw new Error("stop after prompt capture");
  })!;

  await provider.analyzeFlow!({
    source,
    focusInstruction: step.focusInstruction,
    evidenceManifest: [synthesis.evidenceManifest[0]],
    allowedEvidenceIds: [step.evidenceId],
    validationError: "feature document exceeds the 38-claim budget",
  }, [{
    evidence: synthesis.evidenceManifest[0],
    image: { bytes: Buffer.from("first"), contentType: "image/png" },
  }], new AbortController().signal).catch(() => undefined);

  assert.match(prompt, /^The previous attempt was rejected for this exact reason: feature document exceeds the 38-claim budget/);
  assert.match(prompt, /Correct that specific problem in this attempt/);
});
