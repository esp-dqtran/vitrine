import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatSessionHeadless,
  raceChatAbort,
  resolveChatProfileDir,
  type ChatSession,
} from "./llmChat.ts";

test("chat sessions preserve the headed host profile and use an isolated Linux root when configured", () => {
  assert.equal(
    resolveChatProfileDir("chatgpt", {}, "/Users/test"),
    "/Users/test/.config/chatgpt-cli/profile",
  );
  assert.equal(
    resolveChatProfileDir("chatgpt", { CHAT_PROFILE_ROOT: "/app/data/chat-profiles-linux" }, "/Users/test"),
    "/app/data/chat-profiles-linux/chatgpt",
  );
  assert.equal(chatSessionHeadless({}), false);
  assert.equal(chatSessionHeadless({ HEADLESS: "true" }), true);
});

test("browser waits reject immediately when the request is aborted", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));

  await assert.rejects(
    () => raceChatAbort(new Promise(() => {}), controller.signal),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("browser waits preserve the operation result without a signal", async () => {
  assert.equal(await raceChatAbort(Promise.resolve("ready")), "ready");
});

test("ChatSession keeps existing callers compatible while accepting request options", () => {
  const session: ChatSession = {
    ask: async (_prompt, _attachment, options) => {
      options?.signal?.throwIfAborted();
      return "reply";
    },
    close: async () => {},
  };
  assert.equal(typeof session.ask, "function");
});
