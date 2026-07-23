import assert from "node:assert/strict";
import { test } from "node:test";
import {
  batchEmbeddings,
  OpenAICompatibleSearchEmbeddingProvider,
} from "./searchEmbedding.ts";

test("embeds text in bounded batches and validates 1536 dimensions", async () => {
  const calls: unknown[] = [];
  const provider = new OpenAICompatibleSearchEmbeddingProvider({
    baseUrl: "https://example.test/v1",
    apiKey: "secret",
    model: "text-embedding-3-small",
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      calls.push(body);
      return new Response(JSON.stringify({
        data: body.input.map((_, index) => ({
          index,
          embedding: Array(1536).fill((index + 1) / 10),
        })),
      }), { status: 200 });
    },
  });
  assert.equal((await provider.embed(["one", "two"])).length, 2);
  assert.equal(calls.length, 1);
});

test("chunks bulk embedding work into batches of at most 96", async () => {
  const sizes: number[] = [];
  const provider = {
    model: "test",
    async embed(texts: string[]) {
      sizes.push(texts.length);
      return texts.map(() => Array(1536).fill(0));
    },
  };
  assert.equal((await batchEmbeddings(Array(193).fill("text"), provider)).length, 193);
  assert.deepEqual(sizes, [96, 96, 1]);
});

test("rejects malformed embedding dimensions", async () => {
  const provider = new OpenAICompatibleSearchEmbeddingProvider({
    baseUrl: "https://example.test/v1",
    apiKey: "secret",
    model: "text-embedding-3-small",
    fetch: async () => new Response(JSON.stringify({
      data: [{ index: 0, embedding: [0.1] }],
    }), { status: 200 }),
  });
  await assert.rejects(() => provider.embed(["one"]), /invalid dimensions/);
});
