import assert from "node:assert/strict";
import { test } from "node:test";
import type { FeatureStepPrompt, FeatureSynthesisPrompt } from "./featureDocument.ts";
import { createFeatureDocumentProvider } from "./featureDocumentProvider.ts";

const environment = {
  RESEARCH_LLM_BASE_URL: "https://llm.example/v1/",
  RESEARCH_LLM_API_KEY: "provider-secret",
  RESEARCH_LLM_MODEL: "research-model",
};

const stepPrompt: FeatureStepPrompt = {
  source: {
    app: "Checkout",
    platform: "web",
    flowId: "checkout",
    title: "Checkout",
    description: "Complete checkout",
    tags: [],
  },
  stepIndex: 0,
  imageIndex: 0,
  evidenceId: "IMAGE-1",
  stepLabel: "Review cart",
  focusInstruction: "Find recovery gaps",
};

const synthesisPrompt: FeatureSynthesisPrompt = {
  source: stepPrompt.source,
  focusInstruction: stepPrompt.focusInstruction,
  analyses: [{
    evidenceId: "IMAGE-1",
    visibleUi: ["Cart"],
    visibleText: ["Checkout"],
    likelyIntent: "Review cart",
    availableActions: ["Checkout"],
    systemFeedback: [],
    friction: [],
    missingOrUncertainStates: [],
    accessibility: [],
    confidence: 0.9,
  }],
  allowedEvidenceIds: ["IMAGE-1"],
};

function completion(content: unknown): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(content) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("returns no provider when multimodal configuration is incomplete", () => {
  assert.equal(createFeatureDocumentProvider({}), undefined);
});

test("sends one verified image and structured step context", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const expected = { evidenceId: "IMAGE-1", visibleUi: ["Cart"] };
  const provider = createFeatureDocumentProvider(environment, async (url, init) => {
    calls.push({ url: String(url), init });
    return completion(expected);
  });
  const signal = new AbortController().signal;
  const result = await provider!.analyzeImage(stepPrompt, {
    bytes: Buffer.from("png"),
    contentType: "image/png",
  }, signal);
  const body = JSON.parse(String(calls[0].init?.body));

  assert.deepEqual(result, expected);
  assert.equal(calls[0].url, "https://llm.example/v1/chat/completions");
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bearer provider-secret");
  assert.equal(calls[0].init?.signal, signal);
  assert.equal(body.model, "research-model");
  assert.equal(body.temperature, 0.1);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(JSON.parse(body.messages[1].content[0].text), stepPrompt);
  assert.equal(body.messages[1].content[1].type, "image_url");
  assert.equal(body.messages[1].content[1].image_url.detail, "high");
  assert.match(body.messages[1].content[1].image_url.url, /^data:image\/png;base64,cG5n$/);
  assert.equal(body.messages[1].content.filter(({ type }: { type: string }) => type === "image_url").length, 1);
});

test("synthesis sends no image bytes and includes validation repair context", async () => {
  const calls: Array<{ init?: RequestInit }> = [];
  const provider = createFeatureDocumentProvider(environment, async (_url, init) => {
    calls.push({ init });
    return completion({ executiveSummary: {} });
  });
  await provider!.synthesize({
    ...synthesisPrompt,
    validationError: "unknown evidence IMAGE-9",
  }, new AbortController().signal);
  const body = String(calls[0].init?.body);

  assert.doesNotMatch(body, /base64|image_url/);
  assert.match(body, /unknown evidence IMAGE-9/);
  assert.match(body, /userStory/);
  assert.match(body, /preconditions/);
});

test("provider failures never expose credentials, prompts, bodies, or responses", async () => {
  const secretResponse = "private provider response";
  const provider = createFeatureDocumentProvider(environment, async () => new Response(secretResponse, { status: 503 }));

  await assert.rejects(
    () => provider!.analyzeImage(stepPrompt, { bytes: Buffer.from("private-image"), contentType: "image/webp" }, new AbortController().signal),
    (error: Error) => {
      assert.equal(error.message, "Feature analysis provider request failed (503)");
      for (const secret of ["provider-secret", "private-image", secretResponse, stepPrompt.focusInstruction]) {
        assert.equal(error.message.includes(secret), false);
      }
      return true;
    },
  );
});

test("rejects missing or invalid JSON content with stable safe errors", async () => {
  const missing = createFeatureDocumentProvider(environment, async () => completion(undefined));
  await assert.rejects(
    () => missing!.synthesize(synthesisPrompt, new AbortController().signal),
    /Feature analysis provider returned no content/,
  );

  const invalid = createFeatureDocumentProvider(environment, async () => new Response(JSON.stringify({
    choices: [{ message: { content: "not-json" } }],
  }), { status: 200 }));
  await assert.rejects(
    () => invalid!.synthesize(synthesisPrompt, new AbortController().signal),
    /Feature analysis provider returned invalid JSON/,
  );
});
