import assert from "node:assert/strict";
import { test } from "node:test";
import { chatSessionHeadless, resolveChatProfileDir } from "./llmChat.ts";

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
