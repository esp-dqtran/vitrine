import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, type Page } from "playwright";
import type { ChatAttachment, ChatSession } from "./llmChat.ts";

test("builds a local CDP endpoint from Antigravity's active-port file", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  assert.equal(typeof module.antigravityDevToolsEndpoint, "function");
  const endpoint = module.antigravityDevToolsEndpoint as (value: string) => string;

  assert.equal(
    endpoint("58013\n/devtools/browser/example\n"),
    "http://127.0.0.1:58013",
  );
  assert.throws(() => endpoint("not-a-port\n"), /active DevTools port/i);
});

test("resolves an explicit endpoint or the macOS Antigravity active-port file", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  assert.equal(typeof module.antigravityDevToolsEndpointFromEnvironment, "function");
  const resolveEndpoint = module.antigravityDevToolsEndpointFromEnvironment as (
    env: Record<string, string | undefined>,
    home: string,
    readFile: (path: string) => string,
  ) => string;
  let readPath = "";

  assert.equal(
    resolveEndpoint(
      { ANTIGRAVITY_CDP_ENDPOINT: " http://127.0.0.1:61234 " },
      "/Users/test",
      () => { throw new Error("must not read"); },
    ),
    "http://127.0.0.1:61234",
  );
  assert.equal(
    resolveEndpoint({}, "/Users/test", (path) => {
      readPath = path;
      return "58013\n/devtools/browser/example\n";
    }),
    "http://127.0.0.1:58013",
  );
  assert.equal(
    readPath,
    "/Users/test/Library/Application Support/Antigravity/DevToolsActivePort",
  );
});

test("recognizes project and outside-of-project Antigravity conversations", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  assert.equal(typeof module.isAntigravityConversationUrl, "function");
  const isConversation = module.isAntigravityConversationUrl as (value: string) => boolean;

  assert.equal(
    isConversation("https://127.0.0.1:58016/c/conversation-id?section=project"),
    true,
  );
  assert.equal(
    isConversation("https://127.0.0.1:58016/?section=outside-of-project"),
    true,
  );
  assert.equal(isConversation("https://127.0.0.1:58016/"), false);
  assert.equal(isConversation("https://example.com/?section=outside-of-project"), false);
});

test("ignores complete JSON copied from the submitted prompt", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  const extract = module.lastJsonObjectInText as (
    value: string,
    excludedText?: string,
  ) => string;

  assert.equal(
    extract(
      'request {"app":"15five"} response {"componentCandidates":[]}',
      'request {"app":"15five"}',
    ),
    '{"componentCandidates":[]}',
  );
  assert.equal(
    extract('request {"app":"15five"}', 'request {"app":"15five"}'),
    "",
  );
});

test("drives a fresh Antigravity conversation with a genuine image attachment", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  assert.equal(typeof module.bindAntigravityChatSession, "function");
  const bindSession = module.bindAntigravityChatSession as (
    page: Page,
    options: {
      modelLabel: string;
      responseTimeoutMs: number;
      stableMs: number;
      close(): Promise<void>;
    },
  ) => ChatSession;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let closed = 0;
  try {
    await page.setContent(`
      <button aria-label="New Conversation">New</button>
      <button aria-label="Select model, current: Gemini 3.6 Flash (High)">Model</button>
      <input type="file" multiple>
      <div aria-label="Message input" contenteditable="true"></div>
      <div class="leading-relaxed select-text text-sm"></div>
      <div data-testid="agent-loading" hidden>Working.</div>
      <script>
        const editor = document.querySelector('[aria-label="Message input"]');
        document.querySelector('[aria-label="New Conversation"]').addEventListener('click', () => {
          document.body.dataset.freshConversation = 'true';
          document.querySelector('.leading-relaxed').textContent = '';
        });
        editor.addEventListener('keydown', async (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const prompt = editor.textContent;
          editor.textContent = '';
          const file = document.querySelector('input[type=file]').files[0];
          const bytes = file ? await file.text() : '';
          const loading = document.querySelector('[data-testid="agent-loading"]');
          loading.hidden = false;
          setTimeout(() => {
            document.querySelector('.leading-relaxed').textContent =
              '{"prompt":"partial';
          }, 10);
          setTimeout(() => {
            document.querySelector('.leading-relaxed').textContent =
              JSON.stringify({ prompt, fileName: file?.name, bytes });
            loading.remove();
          }, 450);
        });
      </script>
    `);
    const session = bindSession(page, {
      modelLabel: "Gemini 3.6 Flash (High)",
      responseTimeoutMs: 2_000,
      stableMs: 20,
      close: async () => { closed += 1; },
    });
    const reply = await session.ask("analyze SCREEN-1", {
      name: "screen.png",
      mimeType: "image/png",
      buffer: Buffer.from("image-bytes"),
    } satisfies ChatAttachment);

    assert.deepEqual(JSON.parse(reply), {
      prompt: "analyze SCREEN-1",
      fileName: "screen.png",
      bytes: "image-bytes",
    });
    assert.equal(await page.locator("body").getAttribute("data-fresh-conversation"), "true");
    await session.close();
    assert.equal(closed, 1);
  } finally {
    await browser.close();
  }
});

test("accepts Antigravity file-style responses without a stable reply selector", async () => {
  const module = await import("./antigravityChat.ts") as Record<string, unknown>;
  const bindSession = module.bindAntigravityChatSession as (
    page: Page,
    options: {
      modelLabel: string;
      responseTimeoutMs: number;
      stableMs: number;
      close(): Promise<void>;
    },
  ) => ChatSession;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <button aria-label="New Conversation">New</button>
      <button aria-label="Select model, current: Gemini 3.6 Flash (High)">Model</button>
      <div aria-label="Message input" contenteditable="true"></div>
      <div data-testid="agent-loading" hidden>Working.</div>
      <div><pre id="artifact-output"></pre></div>
      <script>
        const editor = document.querySelector('[aria-label="Message input"]');
        editor.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const loading = document.querySelector('[data-testid="agent-loading"]');
          loading.hidden = false;
          setTimeout(() => {
            document.querySelector('#artifact-output').textContent =
              '{"componentCandidates":[],"designLanguage":{"color":[]}}';
            loading.remove();
          }, 10);
        });
      </script>
    `);
    const session = bindSession(page, {
      modelLabel: "Gemini 3.6 Flash (High)",
      responseTimeoutMs: 500,
      stableMs: 20,
      close: async () => {},
    });

    assert.equal(
      await session.ask("merge"),
      '{"componentCandidates":[],"designLanguage":{"color":[]}}',
    );
  } finally {
    await browser.close();
  }
});
