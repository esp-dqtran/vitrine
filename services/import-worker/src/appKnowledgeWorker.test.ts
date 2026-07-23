import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatSession } from "../../../src/llmChat.ts";
import { createBrowserAppKnowledgeGenerator } from "./appKnowledgeWorker.ts";

function session(): ChatSession {
  return { ask: async () => '{"ok":true}', close: async () => {} };
}

for (const outcome of ["done", "cancelled", "error"] as const) {
  test(`closes the browser pool after ${outcome}`, async () => {
    const opened: string[] = [];
    let closed = 0;
    const generate = createBrowserAppKnowledgeGenerator({
      environment: {
        APP_KNOWLEDGE_PROVIDER: "chatgpt-browser",
        APP_KNOWLEDGE_BROWSER_CONCURRENCY: "2",
      },
      startChatPool: async (provider, concurrency) => {
        opened.push(`${provider}:${concurrency}`);
        return {
          sessions: [session(), session()],
          closeAll: async () => { closed += 1; },
        };
      },
      failProviderUnavailable: async () => {
        throw new Error("must not fail a configured job");
      },
      createService: () => ({ generate: async () => outcome }),
    });

    assert.deepEqual(opened, []);
    assert.equal(await generate("31"), outcome);
    assert.deepEqual(opened, ["chatgpt:2"]);
    assert.equal(closed, 1);
  });
}

test("closes the browser pool when service generation throws", async () => {
  let closed = 0;
  const generate = createBrowserAppKnowledgeGenerator({
    environment: { APP_KNOWLEDGE_PROVIDER: "chatgpt-browser" },
    startChatPool: async () => ({
      sessions: [session(), session()],
      closeAll: async () => { closed += 1; },
    }),
    failProviderUnavailable: async () => {
      throw new Error("must not fail after the pool opens");
    },
    createService: () => ({
      generate: async () => { throw new Error("generation failed"); },
    }),
  });
  await assert.rejects(() => generate("31"), /generation failed/);
  assert.equal(closed, 1);
});

test("does not open a browser when the provider is unavailable", async () => {
  let opened = false;
  const failed: string[] = [];
  const generate = createBrowserAppKnowledgeGenerator({
    environment: {},
    startChatPool: async () => {
      opened = true;
      throw new Error("must not open");
    },
    failProviderUnavailable: async (runId) => { failed.push(runId); },
    createService: () => ({ generate: async () => "done" }),
  });
  assert.equal(await generate("31"), "error");
  assert.equal(opened, false);
  assert.deepEqual(failed, ["31"]);
});

test("marks the durable job unavailable when ChatGPT pool startup fails", async () => {
  const failed: string[] = [];
  const generate = createBrowserAppKnowledgeGenerator({
    environment: { APP_KNOWLEDGE_PROVIDER: "chatgpt-browser" },
    startChatPool: async () => {
      throw new Error("secret browser profile path");
    },
    failProviderUnavailable: async (runId) => { failed.push(runId); },
    createService: () => ({ generate: async () => "done" }),
  });
  assert.equal(await generate("31"), "error");
  assert.deepEqual(failed, ["31"]);
});
