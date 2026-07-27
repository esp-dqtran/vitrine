import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Worker } from "playwright";
import { canonicalPublicPageUrl } from "./publicPage.ts";
import {
  createPinnedPublicProxy,
  type PinnedPublicProxy,
} from "./publicNetworkProxy.ts";
import type { SiteTechnologyFinding } from "./siteAnalysis.ts";
import { normalizeWappalyzerTechnology } from "./wappalyzerTechnology.ts";

const DEFAULT_TIMEOUT_MS = 20_000;

interface WappalyzerWorkerPort {
  evaluate(expression: string): Promise<unknown>;
}

interface WappalyzerPagePort {
  goto(url: string): Promise<unknown>;
  bringToFront(): Promise<void>;
}

interface WappalyzerContextPort {
  serviceWorkers(): WappalyzerWorkerPort[];
  waitForServiceWorker(timeoutMs: number): Promise<WappalyzerWorkerPort>;
  pages(): WappalyzerPagePort[];
  newPage(): Promise<WappalyzerPagePort>;
  close(): Promise<void>;
}

export interface WappalyzerBrowserPorts {
  createProfile(): Promise<string>;
  removeProfile(profilePath: string): Promise<void>;
  createProxy(): Promise<PinnedPublicProxy>;
  launchPersistentContext(
    profilePath: string,
    options: {
      extensionPath: string;
      proxyServer: string;
      headless: boolean;
      timeoutMs: number;
    },
  ): Promise<WappalyzerContextPort>;
  delay(durationMs: number): Promise<void>;
}

export interface WappalyzerBrowserOptions {
  extensionPath: string;
  timeoutMs?: number;
  headless?: boolean;
  ports?: WappalyzerBrowserPorts;
}

export interface WappalyzerTechnologyDetector {
  detect(url: string): Promise<SiteTechnologyFinding[]>;
}

export async function createWappalyzerTechnologyDetector(
  options: WappalyzerBrowserOptions,
): Promise<WappalyzerTechnologyDetector> {
  const extensionPath = options.extensionPath?.trim();
  if (!extensionPath || extensionPath.includes("\0")) {
    throw new Error("Wappalyzer extension path is required");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("Invalid Wappalyzer timeout");
  }
  const ports = options.ports ?? defaultPorts;
  return {
    async detect(url) {
      const requestedUrl = canonicalPublicPageUrl(url).requestedUrl;
      const profilePath = await ports.createProfile();
      let proxy: PinnedPublicProxy | undefined;
      let context: WappalyzerContextPort | undefined;
      try {
        proxy = await ports.createProxy();
        context = await ports.launchPersistentContext(profilePath, {
          extensionPath,
          proxyServer: proxy.server,
          headless: options.headless ?? true,
          timeoutMs,
        });
        const worker = context.serviceWorkers()[0]
          ?? await context.waitForServiceWorker(timeoutMs);
        await withTimeout(
          worker.evaluate(DISABLE_TELEMETRY_EXPRESSION),
          timeoutMs,
          "Wappalyzer telemetry configuration timed out",
        );
        const page = context.pages()[0] ?? await context.newPage();
        await page.bringToFront();
        await withTimeout(
          page.goto(requestedUrl),
          timeoutMs,
          "Wappalyzer navigation timed out",
        );
        const raw = await readDetections(worker, ports, timeoutMs);
        return normalizeWappalyzerTechnology(raw);
      } finally {
        await context?.close().catch(() => undefined);
        await proxy?.close().catch(() => undefined);
        await ports.removeProfile(profilePath).catch(() => undefined);
      }
    },
  };
}

const DISABLE_TELEMETRY_EXPRESSION = `(
  async () => {
    if (typeof setCachedOption === "function") {
      await setCachedOption("tracking", false);
      return;
    }
    await chrome.storage.local.set({ tracking: false });
  }
)()`;

const READ_DETECTIONS_EXPRESSION = `(
  typeof Driver === "object" &&
  Driver !== null &&
  typeof Driver.getDetections === "function"
) ? Driver.getDetections() : null`;

async function readDetections(
  worker: WappalyzerWorkerPort,
  ports: Pick<WappalyzerBrowserPorts, "delay">,
  timeoutMs: number,
): Promise<unknown[]> {
  const deadline = Date.now() + timeoutMs;
  let previousSignature: string | undefined;
  let stableReads = 0;
  while (Date.now() < deadline) {
    const value = await worker.evaluate(READ_DETECTIONS_EXPRESSION);
    if (Array.isArray(value)) {
      const signature = JSON.stringify(value);
      stableReads = signature === previousSignature ? stableReads + 1 : 1;
      previousSignature = signature;
      if (stableReads >= 3) return value;
    }
    await ports.delay(500);
  }
  throw new Error("Wappalyzer detection timed out");
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const defaultPorts: WappalyzerBrowserPorts = {
  createProfile: () => mkdtemp(path.join(tmpdir(), "astryx-wappalyzer-")),
  removeProfile: (profilePath) => rm(profilePath, { recursive: true, force: true }),
  createProxy: createPinnedPublicProxy,
  async launchPersistentContext(profilePath, options) {
    await verifyExtension(options.extensionPath);
    const context = await chromium.launchPersistentContext(profilePath, {
      channel: "chromium",
      headless: options.headless,
      serviceWorkers: "allow",
      proxy: { server: options.proxyServer },
      args: [
        `--disable-extensions-except=${options.extensionPath}`,
        `--load-extension=${options.extensionPath}`,
      ],
    });
    return playwrightContext(context);
  },
  delay: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
};

function playwrightContext(context: BrowserContext): WappalyzerContextPort {
  return {
    serviceWorkers: () => context.serviceWorkers().map(playwrightWorker),
    waitForServiceWorker: async (timeoutMs) =>
      playwrightWorker(await context.waitForEvent("serviceworker", { timeout: timeoutMs })),
    pages: () => context.pages().map(playwrightPage),
    newPage: async () => playwrightPage(await context.newPage()),
    close: () => context.close(),
  };
}

function playwrightWorker(worker: Worker): WappalyzerWorkerPort {
  return {
    evaluate: (expression: string) => worker.evaluate(expression),
  };
}

function playwrightPage(page: Page): WappalyzerPagePort {
  return {
    goto: (url) => page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT_MS,
    }),
    bringToFront: () => page.bringToFront(),
  };
}

async function verifyExtension(extensionPath: string): Promise<void> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(
      await readFile(path.join(extensionPath, "manifest.json"), "utf8"),
    );
  } catch {
    throw new Error("Wappalyzer extension manifest is unavailable");
  }
  if (
    !manifest ||
    typeof manifest !== "object" ||
    (manifest as { manifest_version?: unknown }).manifest_version !== 3 ||
    typeof (manifest as { background?: { service_worker?: unknown } }).background
      ?.service_worker !== "string"
  ) {
    throw new Error("Wappalyzer extension manifest is invalid");
  }
}
