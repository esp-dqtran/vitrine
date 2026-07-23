import assert from "node:assert/strict";
import { test } from "node:test";
import { advancedSearchConfigFromEnv } from "./searchConfig.ts";

test("advancedSearchConfigFromEnv disables semantic retrieval without a key", () => {
  assert.deepEqual(advancedSearchConfigFromEnv({ ADVANCED_SEARCH_ENABLED: "true" }), {
    enabled: true,
    indexVersion: 1,
    embedding: null,
  });
});

test("accepts the fixed-dimension model over HTTPS", () => {
  assert.deepEqual(advancedSearchConfigFromEnv({
    SEARCH_EMBEDDING_API_KEY: "secret",
    SEARCH_EMBEDDING_BASE_URL: "https://example.test/v1/",
  }).embedding, {
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "text-embedding-3-small",
  });
});

test("rejects insecure remote embedding endpoints and incompatible models", () => {
  assert.throws(() => advancedSearchConfigFromEnv({
    SEARCH_EMBEDDING_API_KEY: "secret",
    SEARCH_EMBEDDING_BASE_URL: "http://example.test/v1",
  }), /HTTPS or loopback HTTP/);
  assert.throws(() => advancedSearchConfigFromEnv({
    SEARCH_EMBEDDING_API_KEY: "secret",
    SEARCH_EMBEDDING_MODEL: "other-model",
  }), /text-embedding-3-small/);
});
