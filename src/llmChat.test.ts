import assert from "node:assert/strict";
import { test } from "node:test";
import * as llmChat from "./llmChat.ts";
import {
  ChatRateLimitError,
  chatSessionHeadless,
  isChatRateLimitText,
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

test("recognizes the ChatGPT conversation-limit modal safely", () => {
  assert.equal(
    isChatRateLimitText(
      "You’re making requests too quickly. We’ve temporarily limited access to your conversations to protect your data.",
    ),
    true,
  );
  assert.equal(isChatRateLimitText("A normal assistant response"), false);
  assert.equal(
    new ChatRateLimitError().message,
    "ChatGPT temporarily limited browser requests",
  );
});

test("dismisses ChatGPT's recoverable conversation-limit modal", async () => {
  const dismiss = (llmChat as unknown as {
    dismissChatRateLimitDialog?: (
      page: {
        getByRole(role: string, options: { name: string; exact: boolean }): {
          count(): Promise<number>;
          first(): { isVisible(): Promise<boolean>; click(): Promise<void> };
        };
      },
    ) => Promise<boolean>;
  }).dismissChatRateLimitDialog;
  assert.equal(typeof dismiss, "function");

  let clicks = 0;
  const page = {
    getByRole(role: string, options: { name: string; exact: boolean }) {
      assert.equal(role, "button");
      assert.deepEqual(options, { name: "Got it", exact: true });
      return {
        count: async () => 1,
        first: () => ({
          isVisible: async () => true,
          click: async () => { clicks += 1; },
        }),
      };
    },
  };

  assert.equal(await dismiss!(page), true);
  assert.equal(clicks, 1);
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
