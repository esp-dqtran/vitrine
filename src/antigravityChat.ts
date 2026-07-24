import { chromium, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  raceChatAbort,
  type ChatAttachment,
  type ChatSession,
} from "./llmChat.ts";

export function antigravityDevToolsEndpoint(activePortFile: string): string {
  const rawPort = activePortFile.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Antigravity active DevTools port is invalid");
  }
  return `http://127.0.0.1:${port}`;
}

export function antigravityDevToolsEndpointFromEnvironment(
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): string {
  const configured = env.ANTIGRAVITY_CDP_ENDPOINT?.trim();
  if (configured) return configured;
  const activePortPath = join(
    home,
    "Library/Application Support/Antigravity/DevToolsActivePort",
  );
  return antigravityDevToolsEndpoint(readFile(activePortPath));
}

export function isAntigravityConversationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "127.0.0.1"
      && /^\d+$/.test(url.port)
      && Boolean(url.searchParams.get("section"))
      && (url.pathname === "/" || url.pathname.startsWith("/c/"));
  } catch {
    return false;
  }
}

export function lastJsonObjectInText(
  text: string,
  excludedText = "",
): string {
  let best = "";
  let bestEnd = -1;
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const character = text[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      if (depth !== 0) continue;
      const candidate = text.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (
          parsed
          && typeof parsed === "object"
          && !Array.isArray(parsed)
          && !excludedText.includes(candidate)
          && end > bestEnd
        ) {
          best = candidate;
          bestEnd = end;
        }
      } catch {
        // The conversation also contains JSON-like schemas from the prompt.
      }
      start = end;
      break;
    }
  }
  return best;
}

export function completedAntigravityTranscriptReply(
  conversationUrl: string,
  home = homedir(),
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): string {
  try {
    const url = new URL(conversationUrl);
    const match = /^\/c\/([A-Za-z0-9-]+)$/.exec(url.pathname);
    if (!match) return "";
    const transcript = readFile(join(
      home,
      ".gemini/antigravity/brain",
      match[1],
      ".system_generated/logs/transcript_full.jsonl",
    ));
    const lines = transcript.trim().split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const record = JSON.parse(lines[index]) as Record<string, unknown>;
        if (
          record.source === "MODEL"
          && record.type === "PLANNER_RESPONSE"
          && record.status === "DONE"
          && typeof record.content === "string"
        ) return record.content;
      } catch {
        // Ignore a partially written final line while Antigravity is working.
      }
    }
  } catch {
    // The transcript is an implementation detail, so DOM capture remains the fallback.
  }
  return "";
}

interface AntigravitySessionOptions {
  modelLabel: string;
  responseTimeoutMs?: number;
  stableMs?: number;
  close(): Promise<void>;
}

async function ensureAntigravityModel(page: Page, modelLabel: string): Promise<void> {
  const selector = `button[aria-label="Select model, current: ${modelLabel}"]`;
  if (await page.locator(selector).count()) return;
  const modelButton = page.locator('button[aria-label^="Select model, current:"]').last();
  if (!(await modelButton.count())) throw new Error("Antigravity model selector was not found");
  await modelButton.click();
  const option = page.getByText(modelLabel, { exact: true }).last();
  if (!(await option.count())) throw new Error(`Antigravity model "${modelLabel}" is unavailable`);
  await option.click();
  await page.locator(selector).waitFor({ state: "visible", timeout: 10_000 });
}

async function waitForStableAntigravityReply(
  page: Page,
  timeoutMs: number,
  stableMs: number,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const replies = page.locator([
    ".leading-relaxed.select-text.text-sm",
    '[aria-label="Agent response"] .select-text',
    ".select-text",
  ].join(", "));
  const loading = page.locator('[data-testid="agent-loading"]');
  const deadline = Date.now() + timeoutMs;
  let previous = "";
  let stableSince = 0;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const working = await raceChatAbort(loading.isVisible(), signal);
    const count = await raceChatAbort(replies.count(), signal);
    const selectedReply = count > 0
      ? (await raceChatAbort(replies.last().innerText(), signal)).trim()
      : "";
    const selectedJson = lastJsonObjectInText(selectedReply);
    const transcriptJson = lastJsonObjectInText(
      completedAntigravityTranscriptReply(page.url()),
    );
    const visibleJson = !working
      ? lastJsonObjectInText(
        await raceChatAbort(page.locator("body").innerText(), signal),
        prompt,
      )
      : "";
    const text = transcriptJson || selectedJson || visibleJson || selectedReply;
    if ((!working || transcriptJson) && text && text === previous) {
      if (stableSince === 0) stableSince = Date.now();
      if (Date.now() - stableSince >= stableMs) return text;
    } else {
      previous = text;
      stableSince = 0;
    }
    await raceChatAbort(page.waitForTimeout(100), signal);
  }
  throw new Error("Timed out waiting for Antigravity analysis");
}

export function bindAntigravityChatSession(
  page: Page,
  options: AntigravitySessionOptions,
): ChatSession {
  return {
    async ask(prompt, file, askOptions) {
      const signal = askOptions?.signal;
      signal?.throwIfAborted();
      await ensureAntigravityModel(page, options.modelLabel);
      const newConversation = page.locator('button[aria-label="New Conversation"]').last();
      if (!(await raceChatAbort(newConversation.count(), signal))) {
        throw new Error("Antigravity New Conversation control was not found");
      }
      await raceChatAbort(newConversation.click(), signal);
      const editor = page.locator('[aria-label="Message input"][contenteditable="true"]').last();
      await raceChatAbort(editor.waitFor({ state: "visible", timeout: 10_000 }), signal);

      if (file) {
        const upload = page.locator('input[type="file"]').last();
        if (!(await raceChatAbort(upload.count(), signal))) {
          throw new Error("Antigravity image upload control was not found");
        }
        await raceChatAbort(
          upload.setInputFiles(typeof file === "string"
            ? file
            : {
              name: file.name,
              mimeType: file.mimeType,
              buffer: file.buffer,
            } satisfies ChatAttachment),
          signal,
        );
        await raceChatAbort(
          page.waitForFunction(
            () => (document.querySelector('input[type="file"]') as HTMLInputElement | null)
              ?.files?.length === 1,
            undefined,
            { timeout: 10_000 },
          ),
          signal,
        );
      }

      await raceChatAbort(editor.fill(prompt), signal);
      await raceChatAbort(editor.press("Enter"), signal);
      return waitForStableAntigravityReply(
        page,
        options.responseTimeoutMs ?? 6 * 60_000,
        options.stableMs ?? 1_500,
        prompt,
        signal,
      );
    },
    close: options.close,
  };
}

export async function startAntigravitySession(
  modelLabel: string,
  env: Record<string, string | undefined> = process.env,
): Promise<ChatSession> {
  const browser = await chromium.connectOverCDP(
    antigravityDevToolsEndpointFromEnvironment(env),
  );
  const page = browser.contexts()
    .flatMap((context) => context.pages())
    .find((candidate) => isAntigravityConversationUrl(candidate.url()));
  if (!page) {
    await browser.close();
    throw new Error("Open an Antigravity conversation before starting screen analysis");
  }
  return bindAntigravityChatSession(page, {
    modelLabel,
    close: () => browser.close(),
  });
}
