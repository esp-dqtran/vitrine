import { lookup } from "node:dns/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import {
  canonicalPublicPageUrl,
  parsePublicPageCapture,
  PublicPageValidationError,
  type PublicPageCapture,
  type PublicPageSection,
} from "./publicPage.ts";

const VIEWPORT = { width: 1440 as const, height: 900 as const };

export interface PublicPageBrowserOptions {
  headless?: boolean;
  validateNavigation?: (url: string) => Promise<void>;
  scrollPixelsPerSecond?: number;
  maxScrollDurationMs?: number;
  holdMs?: number;
}

export interface PublicPageBrowserResult {
  capture: PublicPageCapture;
  pageImage: Buffer;
  sectionImages: Array<{ position: number; body: Buffer }>;
  preview: Buffer;
  scroll: { durationMs: number; stops: 0 };
}

export interface PublicPageBrowser {
  capture(url: string): Promise<PublicPageBrowserResult>;
  close(): Promise<void>;
}

export async function createPublicPageBrowser(
  options: PublicPageBrowserOptions = {},
): Promise<PublicPageBrowser> {
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const validateNavigation = options.validateNavigation ?? createPublicNetworkValidator();
  return {
    capture: (url) => capturePublicPage(browser, url, {
      validateNavigation,
      scrollPixelsPerSecond: options.scrollPixelsPerSecond ?? 200,
      maxScrollDurationMs: options.maxScrollDurationMs ?? 12_000,
      holdMs: options.holdMs ?? 500,
    }),
    close: () => browser.close(),
  };
}

async function capturePublicPage(
  browser: Browser,
  url: string,
  options: Required<Pick<PublicPageBrowserOptions, "validateNavigation" | "scrollPixelsPerSecond" | "maxScrollDurationMs" | "holdMs">>,
): Promise<PublicPageBrowserResult> {
  const requestedUrl = canonicalPublicPageUrl(url).requestedUrl;
  await options.validateNavigation(requestedUrl);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    screen: VIEWPORT,
    deviceScaleFactor: 1,
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const validatedHosts = new Map<string, Promise<void>>();
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (!/^https?:/i.test(requestUrl)) {
      await route.continue();
      return;
    }
    let key: string;
    try {
      const parsed = new URL(requestUrl);
      key = `${parsed.protocol}//${parsed.host}`;
    } catch {
      await route.abort("blockedbyclient");
      return;
    }
    let validation = validatedHosts.get(key);
    if (!validation) {
      validation = options.validateNavigation(requestUrl);
      validatedHosts.set(key, validation);
    }
    try {
      await validation;
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
  try {
    const page = await context.newPage();
    page.on("popup", (popup) => void popup.close().catch(() => undefined));
    const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || response.status() >= 400) {
      throw new PublicPageValidationError("Public page did not return a renderable response");
    }
    await options.validateNavigation(page.url());
    await settlePage(page);
    await primeLazyContent(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    const raw = await analyzeRenderedPage(page, requestedUrl);
    const capture = parsePublicPageCapture(raw);
    const freeze = await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`,
    });
    const pageImage = Buffer.from(await page.screenshot({ fullPage: true, type: "png", animations: "disabled" }));
    const sectionImages = await cropSections(pageImage, capture.sections);
    await freeze.evaluate((node) => node.parentNode?.removeChild(node));

    const recording = await recordContinuousScroll(page, {
      pixelsPerSecond: checkedPositive(options.scrollPixelsPerSecond, "scroll speed"),
      maxDurationMs: checkedPositive(options.maxScrollDurationMs, "maximum scroll duration"),
      holdMs: checkedNonNegative(options.holdMs, "scroll hold"),
    });
    return {
      capture,
      pageImage,
      sectionImages,
      preview: recording.body,
      scroll: { durationMs: recording.durationMs, stops: 0 },
    };
  } finally {
    await context.close();
  }
}

async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts?.ready.catch(() => undefined);
    const pending = [...document.images]
      .filter((image) => !image.complete)
      .slice(0, 100)
      .map((image) => new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
        setTimeout(resolve, 2_000);
      }));
    await Promise.all(pending);
  });
}

async function primeLazyContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const maximum = Math.min(document.documentElement.scrollHeight, 100_000);
    for (let y = 0; y < maximum; y += Math.max(600, window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    window.scrollTo(0, maximum);
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
}

async function analyzeRenderedPage(page: Page, requestedUrl: string): Promise<unknown> {
  return page.evaluate(({ requested, viewport }) => {
    type AnyRecord = Record<string, unknown>;
    const [clean] = [(value: unknown, maximum: number) => typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
      : ""] as const;
    const jsonLd: AnyRecord[] = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent ?? "") as unknown;
        const values = Array.isArray(parsed) ? parsed : [parsed];
        for (const value of values) {
          if (value && typeof value === "object" && !Array.isArray(value)) jsonLd.push(value as AnyRecord);
        }
      } catch {
        // Invalid publisher metadata is ignored; visible HTML remains authoritative.
      }
    }
    const structured = jsonLd.find((value) => {
      const type = value["@type"];
      return type === "SoftwareApplication" || type === "Organization" || type === "WebSite";
    });
    const [meta] = [(selector: string) => clean(document.querySelector<HTMLMetaElement>(selector)?.content, 500)] as const;
    const fallbackName = new URL(location.href).hostname.replace(/^www\./, "").split(".")[0] || "Website";
    const titleName = clean(document.title.split(/\s+[|–—-]\s+/)[0], 160);
    const name = clean(structured?.name, 160) || meta('meta[property="og:site_name"]') || titleName || fallbackName;
    const description = clean(structured?.description, 500) || meta('meta[property="og:description"]') || meta('meta[name="description"]');
    const category = clean(structured?.applicationCategory, 100) || "Website";
    const rawAccent = meta('meta[name="theme-color"]');
    const accent = /^#[0-9a-f]{6}$/i.test(rawAccent) ? rawAccent.toLowerCase() : "#3b6ef6";
    const iconUrl = document.querySelector<HTMLLinkElement>('link[rel~="icon"],link[rel="apple-touch-icon"]')?.href;
    const canonicalUrl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href;

    const [selectorFor] = [(element: Element): string => {
      if (element.id && /^[A-Za-z][\w-]{0,80}$/.test(element.id)) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement && parts.length < 5) {
        const tag = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (!parent) { parts.unshift(tag); break; }
        const sameTag = [...parent.children].filter((child) => child.tagName === current!.tagName);
        const suffix = sameTag.length > 1 ? `:nth-of-type(${sameTag.indexOf(current) + 1})` : "";
        parts.unshift(tag + suffix);
        current = parent;
      }
      return parts.join(" > ");
    }] as const;
    const [visible] = [(element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
        && rect.width >= viewport.width * 0.5 && rect.height >= 60;
    }] as const;
    const [overlay] = [(element: Element) => {
      const style = getComputedStyle(element);
      const role = element.getAttribute("role");
      return style.position === "fixed" || role === "dialog" || role === "alertdialog";
    }] as const;
    const roots = [...document.querySelectorAll(
      "header,main>section,main>article,main>div,body>section,body>article,body>div,footer",
    )].filter((element) => visible(element) && !overlay(element));
    const candidates = roots.map((element) => {
      const rect = element.getBoundingClientRect();
      const heading = element.matches("h1,h2,h3")
        ? element
        : element.querySelector("h1,h2,h3");
      return {
        selector: selectorFor(element),
        tagName: element.tagName.toLowerCase(),
        role: clean(element.getAttribute("role"), 100) || undefined,
        heading: clean(heading?.textContent, 200) || undefined,
        text: clean(element.textContent, 1_000),
        bounds: {
          x: Math.max(0, Math.round(rect.left + window.scrollX)),
          y: Math.max(0, Math.round(rect.top + window.scrollY)),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        },
      };
    }).sort((left, right) => left.bounds.y - right.bounds.y || left.bounds.x - right.bounds.x);
    const sections: typeof candidates = [];
    for (const candidate of candidates) {
      const prior = sections.at(-1);
      if (prior && candidate.bounds.y < prior.bounds.y + prior.bounds.height) {
        const priorBottom = prior.bounds.y + prior.bounds.height;
        const candidateBottom = candidate.bounds.y + candidate.bounds.height;
        if (candidateBottom <= priorBottom) continue;
        candidate.bounds.height = candidateBottom - priorBottom;
        candidate.bounds.y = priorBottom;
      }
      if (candidate.bounds.height >= 60) sections.push(candidate);
    }
    return {
      requestedUrl: requested,
      canonicalUrl,
      metadata: { name, description, category, accent, ...(iconUrl ? { iconUrl } : {}) },
      viewport,
      document: {
        width: Math.min(100_000, Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)),
        height: Math.min(100_000, Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)),
      },
      html: document.documentElement.outerHTML,
      sections: sections.slice(0, 200).map((section, position) => ({ position, ...section })),
    };
  }, { requested: requestedUrl, viewport: VIEWPORT });
}

async function cropSections(
  pageImage: Buffer,
  sections: PublicPageSection[],
): Promise<Array<{ position: number; body: Buffer }>> {
  const metadata = await sharp(pageImage).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  if (imageWidth < 1 || imageHeight < 1) throw new Error("Public page screenshot dimensions are invalid");
  return Promise.all(sections.map(async (section) => {
    const left = Math.max(0, Math.min(imageWidth - 1, Math.floor(section.bounds.x)));
    const top = Math.max(0, Math.min(imageHeight - 1, Math.floor(section.bounds.y)));
    const width = Math.max(1, Math.min(imageWidth - left, Math.ceil(section.bounds.width)));
    const height = Math.max(1, Math.min(imageHeight - top, Math.ceil(section.bounds.height)));
    const body = await sharp(pageImage).extract({ left, top, width, height }).png().toBuffer();
    return { position: section.position, body };
  }));
}

async function recordContinuousScroll(
  page: Page,
  options: { pixelsPerSecond: number; maxDurationMs: number; holdMs: number },
): Promise<{ body: Buffer; durationMs: number }> {
  const directory = await mkdtemp(path.join(tmpdir(), "astryx-public-page-video-"));
  const videoPath = path.join(directory, "preview.webm");
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screencast.start({ path: videoPath, size: VIEWPORT });
    await page.waitForTimeout(options.holdMs);
    const distance = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    const durationMs = publicPageScrollDurationMs(distance, options.pixelsPerSecond, options.maxDurationMs);
    if (distance > 0 && durationMs > 0) {
      await page.evaluate(({ target, duration }) => new Promise<void>((resolve) => {
        const started = performance.now();
        const [frame] = [(now: number) => {
          const progress = Math.min(1, (now - started) / duration);
          window.scrollTo(0, Math.round(target * progress));
          if (progress >= 1) resolve();
          else requestAnimationFrame(frame);
        }] as const;
        requestAnimationFrame(frame);
      }), { target: distance, duration: durationMs });
    }
    await page.waitForTimeout(options.holdMs);
    await page.screencast.stop();
    return { body: await readFile(videoPath), durationMs };
  } finally {
    await page.screencast.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}

export function publicPageScrollDurationMs(
  distance: number,
  pixelsPerSecond: number,
  maxDurationMs = 12_000,
): number {
  const safeDistance = checkedNonNegative(distance, "scroll distance");
  const speed = checkedPositive(pixelsPerSecond, "scroll speed");
  const maximum = checkedPositive(maxDurationMs, "maximum scroll duration");
  return Math.min(maximum, Math.round(safeDistance / speed * 1_000));
}

function createPublicNetworkValidator(): (url: string) => Promise<void> {
  const cache = new Map<string, Promise<void>>();
  return async (value) => {
    const identity = canonicalPublicPageUrl(value);
    const parsed = new URL(identity.requestedUrl);
    const key = parsed.hostname;
    let check = cache.get(key);
    if (!check) {
      check = lookup(key, { all: true, verbatim: true }).then((addresses) => {
        if (addresses.length === 0) throw new PublicPageValidationError("Public page host did not resolve");
        for (const { address, family } of addresses) {
          const host = family === 6 ? `[${address}]` : address;
          canonicalPublicPageUrl(`${parsed.protocol}//${host}/`);
        }
      });
      cache.set(key, check);
    }
    await check;
  };
}

function checkedPositive(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${label}`);
  return value;
}

function checkedNonNegative(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}
