import assert from "node:assert/strict";
import { test } from "node:test";
import * as llmChat from "./llmChat.ts";
import {
  ChatRateLimitError,
  chatSessionHeadless,
  isChatRateLimitText,
  raceChatAbort,
  recycleChatPage,
  resolveChatCdpUrl,
  resolveChatProfileDir,
  sendPrompt,
  waitForStableReply,
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

test("chat sessions can attach to a provider-specific Chrome CDP endpoint", () => {
  assert.equal(resolveChatCdpUrl("gemini", {}), undefined);
  assert.equal(
    resolveChatCdpUrl("gemini", { GEMINI_CDP_URL: " http://127.0.0.1:9223 " }),
    "http://127.0.0.1:9223",
  );
  assert.equal(
    resolveChatCdpUrl("chatgpt", {
      CHATGPT_CDP_URL: "http://127.0.0.1:9224",
      CHAT_CDP_URL: "http://127.0.0.1:9222",
    }),
    "http://127.0.0.1:9224",
  );
  assert.equal(
    resolveChatCdpUrl("claude", { CHAT_CDP_URL: " http://127.0.0.1:9222 " }),
    "http://127.0.0.1:9222",
  );
});

test("login detection ignores login words inside an existing prompt", async () => {
  const provider = {
    textInput: "#prompt-textarea",
    loggedOutText: "Log in",
  };
  const page = {
    locator(selector: string) {
      assert.equal(selector, "#prompt-textarea");
      return { count: async () => 1 };
    },
    getByRole(role: string, options: { name: string; exact: boolean }) {
      assert.ok(role === "button" || role === "link");
      assert.deepEqual(options, { name: "Log in", exact: true });
      return { count: async () => 0 };
    },
  };

  assert.equal(
    await (llmChat.isLoggedIn as unknown as (
      page: typeof page,
      provider: typeof provider,
    ) => Promise<boolean>)(page, provider),
    true,
  );
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

test("recycles a worker page without closing the browser context", async () => {
  const replacement = { id: "replacement" };
  let closeCalls = 0;
  let newPageCalls = 0;
  const page = {
    context: () => ({
      newPage: async () => {
        newPageCalls += 1;
        return replacement;
      },
    }),
    close: async () => {
      closeCalls += 1;
    },
  };

  assert.equal(await recycleChatPage(page as never), replacement);
  assert.equal(newPageCalls, 1);
  assert.equal(closeCalls, 1);
});

test("prompt submission fills without a pointer click", async () => {
  let value = "";
  let fills = 0;
  let presses = 0;
  const input = {
    fill: async (next: string) => {
      fills += 1;
      value = next;
    },
    press: async (key: string) => {
      assert.equal(key, "Enter");
      presses += 1;
      value = "";
    },
    textContent: async () => value,
  };
  const page = {
    waitForTimeout: async () => {},
    getByText: () => ({ allTextContents: async () => [] }),
  };

  await sendPrompt(
    page as never,
    input as never,
    "Analyze the screenshots",
  );

  assert.equal(fills, 1);
  assert.equal(presses, 1);
});

test("prompt submission fails immediately when the composer never clears", async () => {
  let fills = 0;
  const input = {
    fill: async () => { fills += 1; },
    press: async () => {},
    textContent: async () => "still waiting",
  };
  const page = {
    waitForTimeout: async () => {},
    getByText: () => ({ allTextContents: async () => [] }),
  };

  await assert.rejects(
    () => sendPrompt(page as never, input as never, "Analyze"),
    /Prompt was not submitted after 3 attempts/,
  );
  assert.equal(fills, 3);
});

test("Gemini prompt submission uses the send button without pressing Enter", async () => {
  let value = "";
  let buttonClicks = 0;
  const input = {
    fill: async (next: string) => { value = next; },
    press: async () => assert.fail("Enter should not be pressed"),
    textContent: async () => value,
  };
  const page = {
    locator(selector: string) {
      assert.equal(selector, 'button[aria-label="Send message"]');
      return {
        evaluate: async (callback: (button: { click(): void }) => void) => {
          callback({
            click() {
              buttonClicks += 1;
              value = "";
            },
          });
        },
      };
    },
    waitForTimeout: async () => {},
    getByText: () => ({ allTextContents: async () => [] }),
  };

  await sendPrompt(
    page as never,
    input as never,
    "Analyze",
    undefined,
    'button[aria-label="Send message"]',
  );

  assert.equal(buttonClicks, 1);
});

test("Gemini reply capture waits until generation ends", async () => {
  let clock = 0;
  let poll = 0;
  const partial = "x".repeat(250);
  const complete = `${partial}${"y".repeat(250)}`;
  const replies = [partial, partial, partial, complete, complete, complete, complete];
  const generating = [false, true, true, true, false, false, false];
  const page = {
    locator(selector: string) {
      if (selector === ".model-response-text") {
        return {
          allTextContents: async () => [replies[Math.min(poll, replies.length - 1)]],
        };
      }
      assert.equal(selector, 'button[aria-label="Stop response"]');
      return {
        count: async () => generating[Math.min(poll, generating.length - 1)] ? 1 : 0,
        first: () => ({
          isVisible: async () => generating[Math.min(poll, generating.length - 1)],
        }),
      };
    },
    getByText: () => ({ allTextContents: async () => [] }),
    waitForTimeout: async (ms: number) => {
      clock += ms;
      poll += 1;
    },
  };

  const reply = await waitForStableReply(
    page as never,
    {
      response: ".model-response-text",
      generationInProgress: 'button[aria-label="Stop response"]',
    },
    10_000,
    undefined,
    {
      now: () => clock,
      pollMs: 500,
      stableMs: 500,
      stableWithoutGenerationMs: 3000,
    },
  );

  assert.equal(reply, complete);
  assert.ok(poll >= 6);
});
