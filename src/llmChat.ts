import { chromium, type BrowserContext, type Page } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const LOGIN_WAIT_MS = 5 * 60_000; // time to log in manually in the opened window

type Provider = {
  url: string;
  fileInput: string;
  textInput: string;
  response: string;
  loggedOutText: string;
  uploadMenuButtonName?: string;
  uploadMenuItemName?: string;
  /**
   * Visible only while the provider is actively generating a reply. Providers
   * that stream with long pauses (notably Gemini Pro) must finish this state
   * before a stable response can be captured.
   */
  generationInProgress?: string;
  /** Use the provider's submit button instead of Enter after filling the prompt. */
  submitWithButton?: boolean;
  /**
   * Submit control to gate the "upload actually finished" check on. When set,
   * `ask()` waits for this to become enabled instead of just waiting for the
   * attachment thumbnail to render (see the comment at that check for why).
   */
  sendButton?: string;
};

// ponytail: selectors are best-effort snapshots of each provider's current web UI.
// These sites redesign often — if a chat session stops working, open devtools on the
// input box / reply bubble and update the matching selector below.
const PROVIDERS: Record<string, Provider> = {
  chatgpt: {
    url: "https://chatgpt.com/",
    fileInput: "#upload-files", // ChatGPT has 3 hidden file inputs; this is the general attach one (accepts webp)
    textInput: "#prompt-textarea",
    response: '[data-message-author-role="assistant"]',
    loggedOutText: "Log in", // logged-out ChatGPT still shows a working textarea (guest mode), just no image upload
    sendButton: '[data-testid="send-button"]',
  },
  claude: {
    url: "https://claude.ai/new",
    fileInput: 'input[type="file"]',
    textInput: "div.ProseMirror",
    response: '[data-testid="message-content"]',
    loggedOutText: "Log in",
  },
  gemini: {
    url: "https://gemini.google.com/app",
    fileInput: 'input[type="file"]',
    textInput: "div.ql-editor",
    response: ".model-response-text",
    loggedOutText: "Sign in",
    uploadMenuButtonName: "Upload & tools",
    uploadMenuItemName: "Upload files",
    sendButton: 'button[aria-label="Send message"]',
    generationInProgress:
      'button[aria-label="Stop response"], button[aria-label="Stop generating"]',
    submitWithButton: true,
  },
};

export async function raceChatAbort<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return operation;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", aborted);
        reject(error);
      },
    );
  });
}

async function waitForCount(
  page: Page,
  selector: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if ((await raceChatAbort(page.locator(selector).count(), signal)) > 0) return true;
    await raceChatAbort(page.waitForTimeout(300), signal);
  }
  return false;
}

// Scripts here run detached (via a background shell), so there's no terminal to press
// Enter in — instead poll the page for the (login-gated) text input until it appears.
// A textarea existing isn't enough proof of login on its own — ChatGPT still renders a
// working (but upload-less) textarea for guests — so also check the logged-out marker is gone.
export async function isLoggedIn(page: Page, provider: Provider): Promise<boolean> {
  const [hasInput, loggedOutButtons, loggedOutLinks] = await Promise.all([
    page.locator(provider.textInput).count(),
    page.getByRole("button", { name: provider.loggedOutText, exact: true }).count(),
    page.getByRole("link", { name: provider.loggedOutText, exact: true }).count(),
  ]);
  return hasInput > 0 && loggedOutButtons === 0 && loggedOutLinks === 0;
}

async function waitForLogin(
  page: Page,
  provider: Provider,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await isLoggedIn(page, provider)) return;
    console.log("Waiting for you to log in...");
    await page.screenshot({ path: "scripts/login-wait.png" }).catch(() => {});
    await raceChatAbort(page.waitForTimeout(3000), signal);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting to log in.`);
}

// While ChatGPT is processing an attached image, it briefly shows a static "Analyzing
// image" placeholder in the same assistant-bubble selector as the real reply — that text
// stops changing for well over 1.5s, so without a length floor it reads as "stable" and
// gets captured instead of the actual answer. Our prompts always ask for a detailed,
// multi-section markdown reply, so anything real is comfortably longer than this.
const MIN_STABLE_REPLY_LENGTH = 200;

export function isChatRateLimitText(text: string): boolean {
  return /you(?:'|’)re making requests too quickly/i.test(text)
    || /temporarily limited access to your conversations/i.test(text);
}

export class ChatRateLimitError extends Error {
  constructor() {
    super("ChatGPT temporarily limited browser requests");
    this.name = "ChatRateLimitError";
  }
}

export async function dismissChatRateLimitDialog(
  page: Pick<Page, "getByRole">,
  signal?: AbortSignal,
): Promise<boolean> {
  const button = page.getByRole("button", { name: "Got it", exact: true });
  if (await raceChatAbort(button.count(), signal) === 0) return false;
  const first = button.first();
  if (!(await raceChatAbort(first.isVisible(), signal))) return false;
  await raceChatAbort(first.click(), signal);
  return true;
}

async function throwIfChatRateLimited(
  page: Page,
  signal?: AbortSignal,
): Promise<void> {
  const messages = await raceChatAbort(
    page.getByText(/making requests too quickly|temporarily limited access to your conversations/i)
      .allTextContents(),
    signal,
  );
  if (messages.some(isChatRateLimitText)) {
    if (await dismissChatRateLimitDialog(page, signal)) return;
    throw new ChatRateLimitError();
  }
}

interface ReplyWaitOptions {
  now?: () => number;
  pollMs?: number;
  stableMs?: number;
  stableWithoutGenerationMs?: number;
}

async function generationInProgress(
  page: Page,
  selector: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!selector) return false;
  const controls = page.locator(selector);
  if (await raceChatAbort(controls.count(), signal) === 0) return false;
  return raceChatAbort(controls.first().isVisible(), signal);
}

export async function waitForStableReply(
  page: Page,
  provider: Pick<Provider, "response" | "generationInProgress">,
  timeoutMs: number,
  signal?: AbortSignal,
  options: ReplyWaitOptions = {},
): Promise<string> {
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 500;
  const stableMs = options.stableMs ?? 1500;
  const stableWithoutGenerationMs = options.stableWithoutGenerationMs ?? 8000;
  const deadline = now() + timeoutMs;
  let last = "";
  let stableSince: number | undefined;
  let sawGeneration = false;
  while (now() < deadline) {
    signal?.throwIfAborted();
    await throwIfChatRateLimited(page, signal);
    const generating = await generationInProgress(
      page,
      provider.generationInProgress,
      signal,
    );
    sawGeneration ||= generating;
    const bubbles = await raceChatAbort(
      page.locator(provider.response).allTextContents(),
      signal,
    );
    const text = bubbles.at(-1)?.trim() ?? "";
    if (text && text === last) {
      stableSince ??= now();
      const requiredStableMs = provider.generationInProgress && !sawGeneration
        ? stableWithoutGenerationMs
        : stableMs;
      if (
        !generating
        && now() - stableSince > requiredStableMs
        && text.length >= MIN_STABLE_REPLY_LENGTH
      ) {
        return text;
      }
    } else {
      stableSince = undefined;
    }
    last = text;
    await raceChatAbort(page.waitForTimeout(pollMs), signal);
  }
  return last;
}

// The very first message sent right after a cold page load can silently fail to send
// (observed live: the upload was still settling when Enter was pressed, and nothing
// happened — no assistant bubble ever appeared). Confirm the textbox actually cleared,
// and retry the send if it didn't, rather than trusting a fixed delay.
export async function sendPrompt(
  page: Page,
  input: import("playwright").Locator,
  prompt: string,
  signal?: AbortSignal,
  submitButton?: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    // `fill()` focuses editable controls without a pointer click. That matters on
    // Gemini, where the attachment header can overlap the long composer and make
    // an otherwise editable textbox fail every click as "outside of viewport".
    await raceChatAbort(input.fill(prompt), signal);
    if (submitButton) {
      await raceChatAbort(
        page.locator(submitButton).evaluate((button) => {
          (button as HTMLElement).click();
        }),
        signal,
      );
    } else {
      await raceChatAbort(input.press("Enter"), signal);
    }
    await raceChatAbort(page.waitForTimeout(1500), signal);
    await throwIfChatRateLimited(page, signal);
    const remaining = (await raceChatAbort(input.textContent(), signal))?.trim() ?? "";
    if (remaining === "") return; // textbox cleared — message was accepted
  }
  throw new Error("Prompt was not submitted after 3 attempts");
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ChatAskOptions {
  signal?: AbortSignal;
}

export interface ChatSession {
  /** Sends a fresh message (each call starts a clean chat, no history carries over) and returns the reply. */
  ask(
    prompt: string,
    filePath?: string | ChatAttachment,
    options?: ChatAskOptions,
  ): Promise<string>;
  close(): Promise<void>;
}

export async function recycleChatPage(page: Page): Promise<Page> {
  // Create the replacement first so closing the last tab never tears down a
  // user-owned CDP browser window. A fresh renderer also releases the image and
  // conversation heap accumulated by long-running screenshot-analysis lanes.
  const replacement = await page.context().newPage();
  await page.close().catch(() => {});
  return replacement;
}

// Shared by both the single-session and pooled APIs below — the only difference between
// them is how many `Page`s share the same authenticated context, and who closes it.
function bindSession(page: Page, providerName: string, provider: Provider, onClose: () => Promise<void>): ChatSession {
  let activePage = page;
  let hasAsked = false;
  return {
    async ask(prompt, filePath, options) {
      const signal = options?.signal;
      signal?.throwIfAborted();
      if (hasAsked) activePage = await recycleChatPage(activePage);
      hasAsked = true;
      const requestPage = activePage;
      await raceChatAbort(
        requestPage.goto(provider.url, { waitUntil: "domcontentloaded" }),
        signal,
      );
      // ChatGPT (at least) briefly renders a logged-out shell before hydrating into the
      // authenticated UI — wait for the real (and actually logged-in) input, don't guess a delay.
      await waitForCount(requestPage, provider.textInput, 15_000, signal);
      // Image uploads are login-gated by the provider itself, so only require real login
      // when this call actually attaches a file — a guest session's working (but upload-less)
      // textarea is enough for a text-only prompt.
      signal?.throwIfAborted();
      if (filePath && !(await isLoggedIn(requestPage, provider))) {
        throw new Error(`Logged out of ${providerName} mid-run — log back in and re-run to pick up where this left off.`);
      }
      if (filePath) {
        signal?.throwIfAborted();
        if (provider.uploadMenuButtonName && provider.uploadMenuItemName) {
          const menuButton = requestPage.getByRole("button", {
            name: provider.uploadMenuButtonName,
            exact: true,
          });
          await raceChatAbort(menuButton.click(), signal);
          const uploadItem = requestPage.getByRole("menuitem", {
            name: provider.uploadMenuItemName,
            exact: false,
          });
          const [chooser] = await Promise.all([
            raceChatAbort(requestPage.waitForEvent("filechooser", { timeout: 10_000 }), signal),
            raceChatAbort(uploadItem.click(), signal),
          ]);
          await raceChatAbort(chooser.setFiles(filePath), signal);
        } else {
          await raceChatAbort(
            requestPage.locator(provider.fileInput).setInputFiles(filePath),
            signal,
          );
        }
        // A thumbnail (`form img`) renders immediately as a local preview, well before the
        // file has actually finished uploading — sending while it's still a spinner-covered
        // placeholder silently drops the attachment. Where we know the send button's selector,
        // wait for it to become enabled instead; that's the real "still uploading" signal.
        if (provider.sendButton) {
          try {
            await raceChatAbort(
              requestPage.waitForFunction(
                (sel) => {
                  const btn = document.querySelector(sel) as HTMLButtonElement | null;
                  return !!btn && !btn.disabled;
                },
                provider.sendButton,
                { timeout: 30_000 },
              ),
              signal,
            );
          } catch {
            if (signal?.aborted) throw signal.reason;
            throw new Error(`Attachment never finished uploading for ${filePath}`);
          }
        } else if (!(await waitForCount(requestPage, "form img", 10_000, signal))) {
          throw new Error(`Attachment never appeared for ${filePath}`);
        }
      }
      const input = requestPage.locator(provider.textInput);
      await sendPrompt(
        requestPage,
        input,
        prompt,
        signal,
        provider.submitWithButton ? provider.sendButton : undefined,
      );

      // A detailed vision prompt under "Extra High" reasoning effort can run 3-4+ minutes
      // before the reply even starts, let alone settles — 60s was cutting these off cold.
      const reply = await waitForStableReply(
        requestPage,
        provider,
        6 * 60_000,
        signal,
      );
      if (!reply) {
        throw new Error("No reply captured");
      }
      return reply;
    },
    close: onClose,
  };
}

function getProvider(providerName: string): Provider {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown provider "${providerName}". Choose one of: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return provider;
}

// Reuse the already-authenticated profile from the chatgpt-cli side-project instead of
// spinning up a fresh, never-logged-in one under data/ — avoids a second manual login.
export function resolveChatProfileDir(
  providerName: string,
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): string {
  const root = env.CHAT_PROFILE_ROOT?.trim();
  if (root) return join(root, providerName);
  if (providerName === "chatgpt") return join(home, ".config/chatgpt-cli/profile");
  return `data/browser-profile-${providerName}`;
}

export function chatSessionHeadless(env: Record<string, string | undefined> = process.env): boolean {
  return env.HEADLESS === "true";
}

export function resolveChatCdpUrl(
  providerName: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const providerUrl = env[`${providerName.toUpperCase()}_CDP_URL`]?.trim();
  return providerUrl || env.CHAT_CDP_URL?.trim() || undefined;
}

async function openChatContext(
  providerName: string,
): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  const cdpUrl = resolveChatCdpUrl(providerName);
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];
    if (!context) {
      await browser.close();
      throw new Error(`No browser context is available at ${cdpUrl}`);
    }
    // CDP browsers are user-owned, long-lived provider sessions. Closing the
    // Playwright Browser here also closes the visible Chrome window, which made
    // every rate-limit cycle tear down and reopen ChatGPT/Gemini. Worker tabs
    // are closed by `startChatPool`; leave the external browser itself running.
    return { context, close: async () => {} };
  }

  const context = await chromium.launchPersistentContext(resolveChatProfileDir(providerName), {
    headless: chatSessionHeadless(),
  });
  return { context, close: () => context.close() };
}

function matchingProviderPage(context: BrowserContext, provider: Provider): Page | undefined {
  const origin = new URL(provider.url).origin;
  return context.pages().find((page) => page.url().startsWith(origin));
}

export async function startChatSession(
  providerName: string,
  options: { requireLogin?: boolean } = {},
): Promise<ChatSession> {
  const provider = getProvider(providerName);

  const { context, close } = await openChatContext(providerName);
  const page = matchingProviderPage(context, provider)
    ?? context.pages()[0]
    ?? (await context.newPage());
  await page.bringToFront(); // make sure the window isn't missed behind others
  if (!page.url().startsWith(new URL(provider.url).origin)) {
    await page.goto(provider.url, { waitUntil: "domcontentloaded" });
  }
  // Guest mode still renders a working (upload-less) textarea, so a caller that only
  // needs text prompts can skip waiting on a login that may never come — `ask()` only
  // enforces real login itself when a call actually attaches a file.
  if (options.requireLogin ?? true) {
    await waitForLogin(page, provider, LOGIN_WAIT_MS);
  } else {
    await waitForCount(page, provider.textInput, 15_000);
  }

  return bindSession(page, providerName, provider, close);
}

// Multiple tabs sharing one authenticated context (same login cookies), so N images can be
// captioned concurrently — only the first tab waits for login; the rest inherit the session.
export async function startChatPool(
  providerName: string,
  concurrency: number
): Promise<{ sessions: ChatSession[]; closeAll: () => Promise<void> }> {
  const provider = getProvider(providerName);

  const { context, close } = await openChatContext(providerName);
  const firstPage = matchingProviderPage(context, provider)
    ?? context.pages()[0]
    ?? (await context.newPage());
  await firstPage.bringToFront();
  if (!firstPage.url().startsWith(new URL(provider.url).origin)) {
    await firstPage.goto(provider.url, { waitUntil: "domcontentloaded" });
  }
  await waitForLogin(firstPage, provider, LOGIN_WAIT_MS);

  const extraPages = await Promise.all(
    Array.from({ length: Math.max(0, concurrency - 1) }, () => context.newPage())
  );
  const pages = [firstPage, ...extraPages];
  const sessions = pages.map((page) => bindSession(page, providerName, provider, async () => {}));

  return {
    sessions,
    closeAll: async () => {
      await Promise.all(extraPages.map((page) => page.close().catch(() => {})));
      await close();
    },
  };
}
