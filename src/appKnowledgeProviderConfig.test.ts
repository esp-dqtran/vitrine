import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appKnowledgeProviderConfigFromEnvironment,
  appKnowledgeProviderModelFromEnvironment,
} from "./appKnowledgeProviderConfig.ts";

test("enables the normal ChatGPT browser with one paced lane by default", () => {
  assert.deepEqual(appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
  }), { kind: "chatgpt-browser", model: "chatgpt-browser", concurrency: 1 });
});

test("accepts one or two tabs and rejects every other value", () => {
  assert.equal(appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
    APP_KNOWLEDGE_BROWSER_CONCURRENCY: "1",
  })?.concurrency, 1);
  assert.throws(() => appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
    APP_KNOWLEDGE_BROWSER_CONCURRENCY: "3",
  }), /one or two/);
});

test("missing and unknown provider values fail closed", () => {
  assert.equal(appKnowledgeProviderConfigFromEnvironment({}), undefined);
  assert.equal(appKnowledgeProviderModelFromEnvironment({}), "");
  assert.throws(() => appKnowledgeProviderConfigFromEnvironment({
    APP_KNOWLEDGE_PROVIDER: "api",
  }), /unsupported/i);
});
