import { chromium, type Page } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const LOGIN_WAIT_MS = 5 * 60_000; // time to log in manually in the opened window

type Provider = {
  url: string;
  fileInput: string;
  textInput: string;
  response: string;
  loggedOutText: string;
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
  },
};

async function waitForCount(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await page.locator(selector).count()) > 0) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

// Scripts here run detached (via a background shell), so there's no terminal to press
// Enter in — instead poll the page for the (login-gated) text input until it appears.
// A textarea existing isn't enough proof of login on its own — ChatGPT still renders a
// working (but upload-less) textarea for guests — so also check the logged-out marker is gone.
async function isLoggedIn(page: Page, provider: Provider): Promise<boolean> {
  const [hasInput, loggedOutCount] = await Promise.all([
    page.locator(provider.textInput).count(),
    page.getByText(provider.loggedOutText, { exact: false }).count(),
  ]);
  return hasInput > 0 && loggedOutCount === 0;
}

async function waitForLogin(page: Page, provider: Provider, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page, provider)) return;
    console.log("Waiting for you to log in...");
    await page.screenshot({ path: "scripts/login-wait.png" }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting to log in.`);
}

// While ChatGPT is processing an attached image, it briefly shows a static "Analyzing
// image" placeholder in the same assistant-bubble selector as the real reply — that text
// stops changing for well over 1.5s, so without a length floor it reads as "stable" and
// gets captured instead of the actual answer. Our prompts always ask for a detailed,
// multi-section markdown reply, so anything real is comfortably longer than this.
const MIN_STABLE_REPLY_LENGTH = 200;

async function waitForStableReply(page: Page, selector: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  let stableSince = 0;
  while (Date.now() < deadline) {
    const bubbles = await page.locator(selector).allTextContents();
    const text = bubbles.at(-1)?.trim() ?? "";
    if (text && text === last) {
      if (stableSince === 0) stableSince = Date.now();
      if (Date.now() - stableSince > 1500 && text.length >= MIN_STABLE_REPLY_LENGTH) return text;
    } else {
      stableSince = 0;
    }
    last = text;
    await page.waitForTimeout(500);
  }
  return last;
}

// The very first message sent right after a cold page load can silently fail to send
// (observed live: the upload was still settling when Enter was pressed, and nothing
// happened — no assistant bubble ever appeared). Confirm the textbox actually cleared,
// and retry the send if it didn't, rather than trusting a fixed delay.
async function sendPrompt(page: Page, input: import("playwright").Locator, prompt: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await input.click();
    await input.fill(prompt);
    await input.press("Enter");
    await page.waitForTimeout(1500);
    const remaining = (await input.textContent())?.trim() ?? "";
    if (remaining === "") return; // textbox cleared — message was accepted
  }
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ChatSession {
  /** Sends a fresh message (each call starts a clean chat, no history carries over) and returns the reply. */
  ask(prompt: string, filePath?: string | ChatAttachment): Promise<string>;
  close(): Promise<void>;
}

// Shared by both the single-session and pooled APIs below — the only difference between
// them is how many `Page`s share the same authenticated context, and who closes it.
function bindSession(page: Page, providerName: string, provider: Provider, onClose: () => Promise<void>): ChatSession {
  return {
    async ask(prompt, filePath) {
      await page.goto(provider.url, { waitUntil: "domcontentloaded" });
      // ChatGPT (at least) briefly renders a logged-out shell before hydrating into the
      // authenticated UI — wait for the real (and actually logged-in) input, don't guess a delay.
      await waitForCount(page, provider.textInput, 15_000);
      // Image uploads are login-gated by the provider itself, so only require real login
      // when this call actually attaches a file — a guest session's working (but upload-less)
      // textarea is enough for a text-only prompt.
      if (filePath && !(await isLoggedIn(page, provider))) {
        throw new Error(`Logged out of ${providerName} mid-run — log back in and re-run to pick up where this left off.`);
      }
      if (filePath) {
        await page.locator(provider.fileInput).setInputFiles(filePath);
        // A thumbnail (`form img`) renders immediately as a local preview, well before the
        // file has actually finished uploading — sending while it's still a spinner-covered
        // placeholder silently drops the attachment. Where we know the send button's selector,
        // wait for it to become enabled instead; that's the real "still uploading" signal.
        if (provider.sendButton) {
          try {
            await page.waitForFunction(
              (sel) => {
                const btn = document.querySelector(sel) as HTMLButtonElement | null;
                return !!btn && !btn.disabled;
              },
              provider.sendButton,
              { timeout: 30_000 }
            );
          } catch {
            throw new Error(`Attachment never finished uploading for ${filePath}`);
          }
        } else if (!(await waitForCount(page, "form img", 10_000))) {
          throw new Error(`Attachment never appeared for ${filePath}`);
        }
      }
      const input = page.locator(provider.textInput);
      await sendPrompt(page, input, prompt);

      // A detailed vision prompt under "Extra High" reasoning effort can run 3-4+ minutes
      // before the reply even starts, let alone settles — 60s was cutting these off cold.
      const reply = await waitForStableReply(page, provider.response, 6 * 60_000);
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

export async function startChatSession(
  providerName: string,
  options: { requireLogin?: boolean } = {},
): Promise<ChatSession> {
  const provider = getProvider(providerName);

  const context = await chromium.launchPersistentContext(resolveChatProfileDir(providerName), {
    headless: chatSessionHeadless(),
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.bringToFront(); // make sure the window isn't missed behind others
  await page.goto(provider.url, { waitUntil: "domcontentloaded" });
  // Guest mode still renders a working (upload-less) textarea, so a caller that only
  // needs text prompts can skip waiting on a login that may never come — `ask()` only
  // enforces real login itself when a call actually attaches a file.
  if (options.requireLogin ?? true) {
    await waitForLogin(page, provider, LOGIN_WAIT_MS);
  } else {
    await waitForCount(page, provider.textInput, 15_000);
  }

  return bindSession(page, providerName, provider, () => context.close());
}

// Multiple tabs sharing one authenticated context (same login cookies), so N images can be
// captioned concurrently — only the first tab waits for login; the rest inherit the session.
export async function startChatPool(
  providerName: string,
  concurrency: number
): Promise<{ sessions: ChatSession[]; closeAll: () => Promise<void> }> {
  const provider = getProvider(providerName);

  const context = await chromium.launchPersistentContext(resolveChatProfileDir(providerName), {
    headless: chatSessionHeadless(),
  });
  const firstPage = context.pages()[0] ?? (await context.newPage());
  await firstPage.bringToFront();
  await firstPage.goto(provider.url, { waitUntil: "domcontentloaded" });
  await waitForLogin(firstPage, provider, LOGIN_WAIT_MS);

  const extraPages = await Promise.all(
    Array.from({ length: Math.max(0, concurrency - 1) }, () => context.newPage())
  );
  const pages = [firstPage, ...extraPages];
  const sessions = pages.map((page) => bindSession(page, providerName, provider, async () => {}));

  return { sessions, closeAll: () => context.close() };
}
