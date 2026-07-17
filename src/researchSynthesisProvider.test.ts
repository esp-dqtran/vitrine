import assert from "node:assert/strict";
import { test } from "node:test";
import { createResearchSynthesisProvider } from "./researchSynthesisProvider.ts";

test("returns no provider when configuration is incomplete", () => {
  assert.equal(createResearchSynthesisProvider({}), undefined);
});

test("uses the configured JSON chat completion endpoint", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const provider = createResearchSynthesisProvider({
    RESEARCH_LLM_BASE_URL: "https://llm.example/v1/",
    RESEARCH_LLM_API_KEY: "secret",
    RESEARCH_LLM_MODEL: "research-model",
  }, async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  assert.deepEqual(await provider!.generate({ question: "Q", constraints: "", lanes: [], evidence: [] }, new AbortController().signal), { ok: true });
  assert.equal(calls[0].url, "https://llm.example/v1/chat/completions");
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bearer secret");
  assert.match(String(calls[0].init?.body), /"temperature":0\.2/);
});
