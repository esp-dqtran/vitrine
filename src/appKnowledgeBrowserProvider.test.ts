import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatAttachment, ChatSession } from "./llmChat.ts";
import {
  createChatGptBrowserAppKnowledgeProvider,
  parseBrowserJsonObject,
} from "./appKnowledgeBrowserProvider.ts";

function evidencePrompt(id: string) {
  return {
    evidenceId: id,
    app: "15five",
    platform: "web" as const,
    kind: "screen" as const,
    flowContext: null,
    previousStepContext: null,
    validationError: "",
  };
}

test("accepts raw JSON and one exact json fence", () => {
  assert.deepEqual(parseBrowserJsonObject('{"ok":true}'), { ok: true });
  assert.deepEqual(
    parseBrowserJsonObject("```json\n{\"ok\":true}\n```"),
    { ok: true },
  );
});

test("rejects prose, multiple objects, arrays, and malformed JSON", () => {
  for (const reply of [
    "",
    'Here is JSON: {"ok":true}',
    '{"a":1}\n{"b":2}',
    "[]",
    "```\n{\"ok\":true}\n```",
    "```json\n{bad}\n```",
  ]) assert.throws(() => parseBrowserJsonObject(reply), /invalid JSON output/i);
});

test("uploads verified bytes and uses no attachment for synthesis", async () => {
  const calls: Array<{
    prompt: string;
    attachment?: string | ChatAttachment;
    signal?: AbortSignal;
  }> = [];
  const session: ChatSession = {
    async ask(prompt, attachment, options) {
      calls.push({ prompt, attachment, signal: options?.signal });
      return '{"ok":true}';
    },
    close: async () => {},
  };
  const provider = createChatGptBrowserAppKnowledgeProvider([session]);
  const signal = AbortSignal.timeout(1_000);

  await provider.analyzeEvidence(evidencePrompt("SCREEN-1"), {
    bytes: Buffer.from("png"),
    contentType: "image/png",
  }, signal);
  await provider.synthesize({
    app: "15five",
    platform: "web",
    captureVersionId: 1654,
    analyses: [],
    flows: [],
    coverage: {},
    allowedEvidenceIds: ["SCREEN-1"],
    validationError: "",
  }, signal);

  assert.equal(provider.model, "chatgpt-browser");
  assert.deepEqual(calls[0].attachment, {
    name: "app-knowledge.png",
    mimeType: "image/png",
    buffer: Buffer.from("png"),
  });
  assert.equal(calls[1].attachment, undefined);
  assert.equal(calls[0].signal, signal);
  assert.match(calls[0].prompt, /SCREEN-1/);
  assert.match(calls[1].prompt, /captureVersionId/);
});

test("serializes work per session while using two sessions concurrently", async () => {
  let active = 0;
  let maximum = 0;
  const perSession = [0, 0];
  const sessions = perSession.map((_value, lane): ChatSession => ({
    async ask() {
      perSession[lane] += 1;
      assert.equal(perSession[lane], 1);
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      perSession[lane] -= 1;
      return '{"ok":true}';
    },
    close: async () => {},
  }));
  const provider = createChatGptBrowserAppKnowledgeProvider(sessions);
  await Promise.all([1, 2, 3, 4].map((id) =>
    provider.analyzeEvidence(evidencePrompt(`SCREEN-${id}`), {
      bytes: Buffer.from("png"),
      contentType: "image/png",
    }, AbortSignal.timeout(1_000))));
  assert.equal(maximum, 2);
});

test("requires one or two browser sessions", () => {
  assert.throws(
    () => createChatGptBrowserAppKnowledgeProvider([]),
    /one or two sessions/i,
  );
  assert.throws(
    () => createChatGptBrowserAppKnowledgeProvider([
      { ask: async () => "{}", close: async () => {} },
      { ask: async () => "{}", close: async () => {} },
      { ask: async () => "{}", close: async () => {} },
    ]),
    /one or two sessions/i,
  );
});
