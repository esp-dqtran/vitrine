import assert from "node:assert/strict";
import { test } from "node:test";
import { createMultimodalJsonProvider } from "./evidenceAnalysisProvider.ts";
import { EvidenceAnalysisError } from "./evidenceAnalysisRuntime.ts";

const environment = {
  RESEARCH_LLM_BASE_URL: "https://provider.example/v1/",
  RESEARCH_LLM_API_KEY: "super-secret-key",
  RESEARCH_LLM_MODEL: "vision-model",
};

test("returns no provider when configuration is incomplete", () => {
  assert.equal(createMultimodalJsonProvider({}), undefined);
});

test("sends one JSON request with optional verified image content", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const provider = createMultimodalJsonProvider(environment, async (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ result: "ok" }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  })!;

  const result = await provider.completeJson({
    system: "Return JSON.",
    text: { evidenceId: "SCREEN-1" },
    image: { bytes: Buffer.from("image"), contentType: "image/png" },
    signal: AbortSignal.timeout(1_000),
  });

  assert.equal(requestUrl, "https://provider.example/v1/chat/completions");
  assert.equal((requestInit?.headers as Record<string, string>).authorization, "Bearer super-secret-key");
  const body = JSON.parse(String(requestInit?.body));
  assert.equal(body.model, "vision-model");
  assert.match(body.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.deepEqual(result, { result: "ok" });
});

test("classifies refusal without exposing provider response or credentials", async () => {
  const provider = createMultimodalJsonProvider(environment, async () =>
    new Response("secret provider body", { status: 401 }))!;

  await assert.rejects(
    provider.completeJson({
      system: "Return JSON.",
      text: {},
      signal: AbortSignal.timeout(1_000),
    }),
    (error: unknown) =>
      error instanceof EvidenceAnalysisError
      && error.code === "provider_refused"
      && !error.message.includes("secret")
      && !error.message.includes("super-secret-key"),
  );
});

test("classifies malformed provider content as invalid output", async () => {
  const provider = createMultimodalJsonProvider(environment, async () =>
    new Response(JSON.stringify({
      choices: [{ message: { content: "not-json" } }],
    }), { status: 200 }))!;

  await assert.rejects(
    provider.completeJson({
      system: "Return JSON.",
      text: {},
      signal: AbortSignal.timeout(1_000),
    }),
    (error: unknown) =>
      error instanceof EvidenceAnalysisError
      && error.code === "output_invalid",
  );
});
