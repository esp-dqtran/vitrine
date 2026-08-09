import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import sharp from "sharp";
import {
  canonicalPublicPageUrl,
  parsePublicPageCapture,
  PublicPageValidationError,
  type PublicPageCapture,
  type PublicPageSection,
} from "./publicPage.ts";
import {
  buildSiteAnalysis,
  inspectSiteViewport,
} from "./sitePageInspection.ts";
import type { SiteAnalysis } from "./siteAnalysis.ts";
import { createSiteResourceCollector } from "./siteResourceEvidence.ts";
import {
  createPinnedPublicProxy,
  type PinnedPublicProxy,
} from "./publicNetworkProxy.ts";

const VIEWPORT = { width: 1440 as const, height: 900 as const };
const MOBILE_VIEWPORT = { width: 390 as const, height: 844 as const };
const PREVIEW_VIDEO_SIZE = { width: 1440 as const, height: 900 as const };
const PREVIEW_FRAMES_PER_SECOND = 60;
const TOP_OVERLAY_CAPTURE_MARGIN = 16;
const STITCH_HIDDEN_FIXED_ATTRIBUTE = "data-astryx-stitch-hidden-fixed";
const MAXIMUM_CAPTURE_HEIGHT = 100_000;
const MAXIMUM_CAPTURE_BYTES = 64 * 1_024 * 1_024;
const MAXIMUM_HTML_BYTES = 2 * 1_024 * 1_024;
const CONSENT_ACTION_NAME =
  /^(?:reject(?: all)?(?: cookies)?|decline(?: all)?(?: cookies)?|only necessary(?: cookies)?|necessary only|continue without accepting|accept(?: all)?(?: cookies)?|allow(?: all)?(?: cookies)?|agree(?: and continue)?|okay|ok|got it|close(?: cookie settings)?|dismiss)$/i;

export interface PublicPageBrowserOptions {
  headless?: boolean;
  disableWebGl?: boolean;
  validateNavigation?: (url: string) => Promise<void>;
  scrollPixelsPerSecond?: number;
  maxScrollDurationMs?: number;
  holdMs?: number;
}

export interface PublicPageBrowserResult {
  capture: PublicPageCapture;
  pageImage: Buffer;
  mobilePageImage: Buffer;
  analysis: SiteAnalysis;
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
  let proxy: PinnedPublicProxy | undefined;
  let browser: Browser;
  try {
    proxy = options.validateNavigation
      ? undefined
      : await createPinnedPublicProxy();
    browser = await chromium.launch({
      headless: options.headless ?? true,
      ...(options.disableWebGl
        ? { args: ["--disable-webgl", "--disable-webgl2"] }
        : {}),
    });
  } catch (error) {
    await proxy?.close().catch(() => undefined);
    throw error;
  }
  const validateNavigation = options.validateNavigation ?? createPublicNetworkValidator();
  return {
    capture: (url) => capturePublicPage(browser, url, {
      validateNavigation,
      ...(proxy ? { proxyServer: proxy.server } : {}),
      scrollPixelsPerSecond: options.scrollPixelsPerSecond ?? 200,
      maxScrollDurationMs: options.maxScrollDurationMs ?? 20_000,
      holdMs: options.holdMs ?? 500,
    }),
    close: async () => {
      await browser.close();
      await proxy?.close();
    },
  };
}

async function capturePublicPage(
  browser: Browser,
  url: string,
  options: Required<Pick<PublicPageBrowserOptions, "validateNavigation" | "scrollPixelsPerSecond" | "maxScrollDurationMs" | "holdMs">> & {
    proxyServer?: string;
  },
): Promise<PublicPageBrowserResult> {
  const requestedUrl = canonicalPublicPageUrl(url).requestedUrl;
  await options.validateNavigation(requestedUrl);
  const context = await createCaptureContext(
    browser,
    VIEWPORT,
    options.validateNavigation,
    options.proxyServer,
  );
  try {
    const page = await context.newPage();
    page.on("popup", (popup) => void popup.close().catch(() => undefined));
    const resources = createSiteResourceCollector({
      validateNavigation: options.validateNavigation,
    });
    resources.attach(page);
    const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || response.status() >= 400) {
      throw new PublicPageValidationError("Public page did not return a renderable response");
    }
    const finalUrl = canonicalPublicPageUrl(page.url()).requestedUrl;
    await options.validateNavigation(finalUrl);
    await lockMainFrameNavigation(page);
    await settlePage(page);
    await dismissRecognizedConsent(page);
    await primeLazyContent(page);
    await dismissRecognizedConsent(page);
    assertPageUrl(page, finalUrl);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    const desktopInspection = await inspectSiteViewport(
      page,
      "desktop",
      await resources.snapshot(),
    );
    const raw = await analyzeRenderedPage(page, requestedUrl, finalUrl);
    const capture = parsePublicPageCapture(raw);
    const pageImage = await captureStablePagePng(
      page,
      publicPageCaptureClip(capture.document, VIEWPORT),
    );
    assertCaptureBytes(pageImage);
    const sectionImages = await cropSections(pageImage, capture.sections);

    const recording = await capturePreviewRecording(context, finalUrl, {
      validateNavigation: options.validateNavigation,
      pixelsPerSecond: checkedPositive(options.scrollPixelsPerSecond, "scroll speed"),
      maxDurationMs: checkedPositive(options.maxScrollDurationMs, "maximum scroll duration"),
      holdMs: checkedNonNegative(options.holdMs, "scroll hold"),
    });
    const mobile = await captureMobileEvidence(
      browser,
      finalUrl,
      options.validateNavigation,
      options.proxyServer,
    ).catch(async (error: unknown) => {
      desktopInspection.warnings.push(
        `Mobile Site inspection failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      return {
        inspection: undefined,
        image: await sharp({
          create: {
            width: MOBILE_VIEWPORT.width,
            height: MOBILE_VIEWPORT.height,
            channels: 4,
            background: "#ffffff",
          },
        }).png().toBuffer(),
      };
    });
    const analysis = buildSiteAnalysis(desktopInspection, mobile.inspection);
    return {
      capture,
      pageImage,
      mobilePageImage: mobile.image,
      analysis,
      sectionImages,
      preview: recording.body,
      scroll: { durationMs: recording.durationMs, stops: 0 },
    };
  } finally {
    await context.close();
  }
}

async function capturePreviewRecording(
  context: BrowserContext,
  requestedUrl: string,
  options: {
    validateNavigation: (url: string) => Promise<void>;
    pixelsPerSecond: number;
    maxDurationMs: number;
    holdMs: number;
  },
): Promise<{ body: Buffer; durationMs: number }> {
  const page = await context.newPage();
  try {
    page.on("popup", (popup) => void popup.close().catch(() => undefined));
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    if (!response || response.status() >= 400) {
      throw new PublicPageValidationError(
        "Public page preview did not return a renderable response",
      );
    }
    const finalUrl = canonicalPublicPageUrl(page.url()).requestedUrl;
    await options.validateNavigation(finalUrl);
    await lockMainFrameNavigation(page);
    await settlePage(page);
    await dismissRecognizedConsent(page);
    assertPageUrl(page, requestedUrl);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    return await recordContinuousScroll(page, options);
  } finally {
    await page.close();
  }
}

async function createCaptureContext(
  browser: Browser,
  viewport: { width: number; height: number },
  validateNavigation: (url: string) => Promise<void>,
  proxyServer?: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    acceptDownloads: false,
    serviceWorkers: "block",
    // Capture injects a stylesheet to freeze animations and scroll-snap before
    // screenshotting. Sites with a strict style-src CSP (1password.com, for
    // one) reject that injected <style>, addStyleTag throws, and the whole
    // crawl fails. This only relaxes CSP inside our own headless context — the
    // page is still fetched and rendered normally.
    bypassCSP: true,
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  });
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (!/^https?:/i.test(requestUrl)) {
      await route.continue();
      return;
    }
    try {
      new URL(requestUrl);
    } catch {
      await route.abort("blockedbyclient");
      return;
    }
    try {
      await validateNavigation(requestUrl);
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
  return context;
}

async function captureMobileEvidence(
  browser: Browser,
  requestedUrl: string,
  validateNavigation: (url: string) => Promise<void>,
  proxyServer?: string,
): Promise<{
  inspection: import("./sitePageInspection.ts").SiteViewportInspection;
  image: Buffer;
}> {
  const context = await createCaptureContext(
    browser,
    MOBILE_VIEWPORT,
    validateNavigation,
    proxyServer,
  );
  try {
    const page = await context.newPage();
    page.on("popup", (popup) => void popup.close().catch(() => undefined));
    const resources = createSiteResourceCollector({ validateNavigation });
    resources.attach(page);
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    if (!response || response.status() >= 400) {
      throw new PublicPageValidationError(
        "Public page did not return a renderable mobile response",
      );
    }
    const finalUrl = canonicalPublicPageUrl(page.url()).requestedUrl;
    await validateNavigation(finalUrl);
    await lockMainFrameNavigation(page);
    await settlePage(page);
    await dismissRecognizedConsent(page);
    await primeLazyContent(page);
    await dismissRecognizedConsent(page);
    assertPageUrl(page, requestedUrl);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const inspection = await inspectSiteViewport(
      page,
      "mobile",
      await resources.snapshot(),
    );
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    const image = await captureStablePagePng(
      page,
      publicPageCaptureClip(dimensions, MOBILE_VIEWPORT),
    );
    assertCaptureBytes(image);
    return { inspection, image };
  } finally {
    await context.close();
  }
}

async function captureStablePagePng(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  const viewport = page.viewportSize();
  const needsViewportStitching = Boolean(
    viewport && clip.height > viewport.height,
  );
  const freeze = await page.addStyleTag({
    content: needsViewportStitching
      ? `html{scroll-snap-type:none!important}*,*::before,*::after{transition-duration:0s!important;scroll-behavior:auto!important;scroll-snap-align:none!important}`
      : `*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`,
  });
  try {
    if (viewport && needsViewportStitching) {
      return await captureScrolledPagePng(page, clip, viewport);
    }
    const session = await page.context().newCDPSession(page);
    try {
      const screenshot = await session.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
        clip: { ...clip, scale: 1 },
      });
      return Buffer.from(screenshot.data, "base64");
    } finally {
      await session.detach();
    }
  } finally {
    await freeze.evaluate((node) => node.parentNode?.removeChild(node))
      .catch(() => undefined);
  }
}

async function captureScrolledPagePng(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
): Promise<Buffer> {
  const tiles: Array<{ input: Buffer; top: number; left: 0 }> = [];
  const clipBottom = clip.y + clip.height;
  const maximumScrollTop = Math.max(0, clipBottom - viewport.height);
  // Measure sticky chrome from a scrolled position rather than at rest. Plenty
  // of headers sit in normal flow at scroll 0 — below a promo bar, say — and
  // only pin once the page moves. Measured at rest they fail the rect.top <= 1
  // test below, the inset comes out 0, and the header is then re-painted into
  // the top of every stitched tile instead of appearing once.
  await page.evaluate(async (top) => {
    window.scrollTo(0, top);
    await new Promise<void>((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(() => resolve())
    ));
  }, Math.min(maximumScrollTop, viewport.height));
  await page.waitForTimeout(120);
  const topOverlayHeight = await page.evaluate(({ width, height }) => {
    let bottom = 0;
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = element.getBoundingClientRect();
      if (
        rect.top > 1 ||
        rect.bottom <= 0 ||
        rect.width < width * 0.5 ||
        rect.height > height * 0.25
      ) {
        continue;
      }
      bottom = Math.max(bottom, Math.ceil(rect.bottom));
    }
    return Math.min(Math.round(height * 0.25), bottom);
  }, viewport);
  const topOverlayInset = Math.min(
    Math.round(viewport.height * 0.25),
    topOverlayHeight > 0
      ? topOverlayHeight + TOP_OVERLAY_CAPTURE_MARGIN
      : 0,
  );
  let cursor = clip.y;
  try {
    while (cursor < clipBottom) {
      const requestedTop = Math.min(
        maximumScrollTop,
        cursor === clip.y
          ? cursor
          : Math.max(clip.y, cursor - topOverlayInset),
      );
      const actualTop = await page.evaluate(async (top) => {
        window.scrollTo(0, top);
        await new Promise<void>((resolve) => requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve())
        ));
        return Math.round(window.scrollY);
      }, requestedTop);
      await page.waitForTimeout(100);
      if (tiles.length > 0) {
        await page.evaluate((attribute) => {
          const roots: Array<Document | ShadowRoot> = [document];
          for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
            for (const element of roots[rootIndex]!.querySelectorAll("*")) {
              if (element.shadowRoot) roots.push(element.shadowRoot);
              if (getComputedStyle(element).position !== "fixed") continue;
              if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) continue;
              if (element.hasAttribute(attribute)) continue;
              element.setAttribute(attribute, JSON.stringify([
                element.style.getPropertyValue("visibility"),
                element.style.getPropertyPriority("visibility"),
              ]));
              element.style.setProperty("visibility", "hidden", "important");
            }
          }
        }, STITCH_HIDDEN_FIXED_ATTRIBUTE);
      }
      const screenTop = Math.max(
        cursor === clip.y ? 0 : topOverlayInset,
        cursor - actualTop,
      );
      const height = Math.min(
        viewport.height - screenTop,
        clipBottom - cursor,
      );
      if (height < 1) {
        const trailingShrink = requestedTop === maximumScrollTop
          && actualTop < requestedTop
          && clipBottom - cursor <= requestedTop - actualTop;
        if (trailingShrink) break;
        throw new PublicPageValidationError(
          `Public page viewport stitching did not advance (${JSON.stringify({
            cursor,
            clipBottom,
            maximumScrollTop,
            requestedTop,
            actualTop,
            screenTop,
            viewportHeight: viewport.height,
          })})`,
        );
      }
      const screenshot = Buffer.from(await page.screenshot({ type: "png" }));
      const input = await sharp(screenshot)
        .extract({
          left: clip.x,
          top: screenTop,
          width: clip.width,
          height,
        })
        .png()
        .toBuffer();
      tiles.push({ input, top: cursor - clip.y, left: 0 });
      cursor += height;
    }
  } finally {
    await page.evaluate((attribute) => {
      const roots: Array<Document | ShadowRoot> = [document];
      for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
        for (const element of roots[rootIndex]!.querySelectorAll("*")) {
          if (element.shadowRoot) roots.push(element.shadowRoot);
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) continue;
          const stored = element.getAttribute(attribute);
          if (stored === null) continue;
          const [value, priority] = JSON.parse(stored) as [string, string];
          if (value) element.style.setProperty("visibility", value, priority);
          else element.style.removeProperty("visibility");
          element.removeAttribute(attribute);
        }
      }
    }, STITCH_HIDDEN_FIXED_ATTRIBUTE).catch(() => undefined);
  }
  return sharp({
    create: {
      width: clip.width,
      height: clip.height,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite(tiles)
    .png()
    .toBuffer();
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

async function dismissRecognizedConsent(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    const actions = frame.getByRole("button", { name: CONSENT_ACTION_NAME });
    const count = Math.min(await actions.count().catch(() => 0), 20);
    for (let index = 0; index < count; index += 1) {
      const action = actions.nth(index);
      if (!await action.isVisible().catch(() => false)) continue;
      const belongsToConsentOverlay = await action.evaluate((element) => {
        const consentCopy = /(?:cookie|privacy|consent|tracking)/i;
        const overlayIdentity = /(?:cookie|privacy|consent)/i;
        let node: Element | null = element;
        let context = "";
        let overlay = false;
        for (let depth = 0; node && depth < 8; depth += 1) {
          context += ` ${node.textContent ?? ""}`;
          const role = node.getAttribute("role") ?? "";
          const identity = [
            node.id,
            node.getAttribute("class") ?? "",
            node.getAttribute("aria-label") ?? "",
          ].join(" ");
          const position = getComputedStyle(node).position;
          if (
            position === "fixed"
            || position === "sticky"
            || role === "dialog"
            || role === "alertdialog"
            || overlayIdentity.test(identity)
          ) {
            overlay = true;
          }
          const root = node.getRootNode();
          node = node.parentElement
            ?? (root instanceof ShadowRoot ? root.host : null);
        }
        return overlay && consentCopy.test(context);
      }).catch(() => false);
      if (!belongsToConsentOverlay) continue;
      await action.click({ timeout: 1_000 }).catch(() => undefined);
      await page.waitForTimeout(100);
      return;
    }
  }
  await hideUnreachableConsent(page);
}

// Nothing clickable matched. Some CMPs render their banner inside a *closed*
// shadow root, which no selector engine can enter — getByRole finds zero
// buttons while the banner sits on screen and gets composited into the
// full-page capture. The host element is still ordinary DOM, so hide that.
//
// Scoped to documentElement rather than body on purpose: Transcend mounts its
// host as a direct child of <html>, so a body-rooted query misses it silently.
//
// Hiding instead of clicking "Accept all" is also deliberate. We only need the
// banner out of the screenshot; clicking it would record a tracking consent on
// the visitor's behalf on every site we crawl.
async function hideUnreachableConsent(page: Page): Promise<void> {
  await page.evaluate(() => {
    const identity = /(?:cookie|consent|privacy|gdpr|cmp)/i;
    for (const node of document.documentElement.querySelectorAll("*")) {
      const name = `${node.id} ${node.getAttribute("class") ?? ""}`;
      if (!identity.test(name)) continue;
      // Only overlays: a fixed/sticky box is what covers the page. Plain links
      // like "Cookie Policy" in a footer match the name test but must stay.
      const position = getComputedStyle(node).position;
      if (position !== "fixed" && position !== "sticky") continue;
      (node as HTMLElement).style.setProperty("display", "none", "important");
    }
  }).catch(() => undefined);
}

async function primeLazyContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const maximum = Math.min(document.documentElement.scrollHeight, 30_000);
    for (let y = 0; y < maximum; y += Math.max(600, window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    window.scrollTo(0, maximum);
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
}

async function analyzeRenderedPage(
  page: Page,
  requestedUrl: string,
  finalUrl: string,
): Promise<unknown> {
  return page.evaluate(({
    requested,
    canonical,
    viewport,
    maximumHeight,
    maximumHtmlBytes,
  }) => {
    type AnyRecord = Record<string, unknown>;
    const [clean] = [(value: unknown, maximum: number) => typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
      : ""] as const;
    const [headingLabel] = [(value: string): string => {
      const words = value.split(" ").filter(Boolean);
      if (words.length < 6) return value;
      for (let size = 3; size <= Math.floor(words.length / 2); size += 1) {
        if (words.length % size !== 0) continue;
        let repeated = true;
        for (let index = size; index < words.length; index += 1) {
          if (words[index] !== words[index % size]) {
            repeated = false;
            break;
          }
        }
        if (repeated) return words.slice(0, size).join(" ");
      }
      return value;
    }] as const;
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
    const titleName = clean(
      document.title
        .replace(/^home\s*[\\\\|/]\s*/i, "")
        .split(/\s+[|–—-]\s+/)[0],
      160,
    );
    const name = clean(structured?.name, 160) || meta('meta[property="og:site_name"]') || titleName || fallbackName;
    const description = clean(structured?.description, 500) || meta('meta[property="og:description"]') || meta('meta[name="description"]');
    const category = clean(structured?.applicationCategory, 100) || "Website";
    const rawAccent = meta('meta[name="theme-color"]');
    const accent = /^#[0-9a-f]{6}$/i.test(rawAccent) ? rawAccent.toLowerCase() : "#3b6ef6";
    const [iconScore] = [(link: HTMLLinkElement): number => {
      const rel = link.rel.toLowerCase().split(/\s+/);
      const largestDeclaredSize = Math.max(
        0,
        ...link.sizes.value.split(/\s+/).map((size) => {
          const match = /^(\d+)x(\d+)$/i.exec(size);
          return match ? Math.min(Number(match[1]), Number(match[2])) : 0;
        }),
      );
      return (rel.includes("apple-touch-icon") ? 1_000_000 : 0) + largestDeclaredSize;
    }] as const;
    const iconUrl = [...document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="apple-touch-icon"],link[rel~="icon"]',
    )].sort((left, right) => iconScore(right) - iconScore(left)).at(0)?.href;

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
    const documentHeight = Math.min(
      maximumHeight,
      Math.max(
        viewport.height,
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      ),
    );
    const pageWidth = Math.min(
      viewport.width,
      Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth ?? 0,
      ),
    );
    const semanticRoots = [...document.querySelectorAll(
      "nav,header,main>section,main>article,main>div,main section,main article,main [role=region],body>section,body>article,body>div,[role=region],footer",
    )];
    const identifiedRoots = [...document.querySelectorAll(
      "main [id],main [data-section],main [data-testid]",
    )].filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        visible(element) &&
        !overlay(element) &&
        rect.height >= 160 &&
        element.querySelectorAll("h1,h2,h3").length <= 6
      );
    });
    const headingRoots: Element[] = [];
    for (const heading of document.querySelectorAll("h1,h2,h3")) {
      let current = heading.parentElement;
      let best: Element | undefined;
      while (
        current &&
        current !== document.body &&
        current !== document.documentElement &&
        current.tagName !== "MAIN"
      ) {
        const rect = current.getBoundingClientRect();
        const headingCount = current.querySelectorAll("h1,h2,h3").length;
        if (
          visible(current) &&
          !overlay(current) &&
          rect.width >= viewport.width * 0.5 &&
          rect.height >= 120 &&
          (
            rect.height < documentHeight * 0.85 ||
            current.matches("section,article,[role=region]")
          ) &&
          headingCount <= 8
        ) {
          if (best && headingCount > 1) break;
          best = current;
        }
        if (
          current.matches("section,article,[role=region]") &&
          best === current
        ) {
          break;
        }
        current = current.parentElement;
      }
      if (best) headingRoots.push(best);
    }
    const rawRoots = [...new Set([
      ...semanticRoots,
      ...identifiedRoots,
      ...headingRoots,
    ])]
      .filter((element) => visible(element) && !overlay(element));
    const captureRoots = rawRoots.length > 0
      ? rawRoots
      : document.body
        ? [document.body]
        : [];
    const candidates = captureRoots.map((element) => {
      const rect = element.getBoundingClientRect();
      const heading = element.matches("h1,h2,h3")
        ? element
        : element.querySelector("h1,h2,h3");
      const headingText = heading instanceof HTMLElement
        ? heading.innerText
        : heading?.textContent;
      const style = getComputedStyle(element);
      const elementX = Math.max(
        0,
        Math.min(pageWidth - 1, Math.round(rect.left + window.scrollX)),
      );
      const elementY = Math.max(
        0,
        Math.min(documentHeight - 1, Math.round(rect.top + window.scrollY)),
      );
      const elementBounds = {
        x: elementX,
        y: elementY,
        width: Math.max(1, Math.min(pageWidth - elementX, Math.round(rect.width))),
        height: Math.max(
          1,
          Math.min(
            documentHeight - elementY,
            Math.round(rect.height),
          ),
        ),
      };
      const anchor = clean(element.id, 160);
      const classNames = [...element.classList]
        .map((value) => clean(value, 120))
        .filter(Boolean)
        .slice(0, 20);
      return {
        selector: selectorFor(element),
        tagName: element.tagName.toLowerCase(),
        role: clean(element.getAttribute("role"), 100) || undefined,
        heading: headingLabel(clean(headingText, 200)) || undefined,
        headingLevel: heading?.tagName.toLowerCase(),
        anchor: anchor || undefined,
        classNames,
        text: clean(element.textContent, 1_000),
        elementBounds,
        style: {
          display: clean(style.display, 80) || "block",
          position: clean(style.position, 80) || "static",
          flexDirection: clean(style.flexDirection, 80) || undefined,
          gridTemplateColumns: clean(style.gridTemplateColumns, 240) || undefined,
          maxWidth: clean(style.maxWidth, 80) || undefined,
          padding: clean(style.padding, 240) || undefined,
          gap: clean(style.gap, 80) || undefined,
          backgroundColor: clean(style.backgroundColor, 120) || undefined,
          color: clean(style.color, 120) || undefined,
        },
        content: {
          links: Math.min(10_000, element.querySelectorAll("a[href]").length),
          buttons: Math.min(10_000, element.querySelectorAll("button,[role=button]").length),
          images: Math.min(10_000, element.querySelectorAll("img,picture,svg").length),
          videos: Math.min(10_000, element.querySelectorAll("video").length),
          forms: Math.min(10_000, element.querySelectorAll("form").length),
        },
      };
    }).sort((left, right) =>
      left.elementBounds.y - right.elementBounds.y ||
      left.elementBounds.height - right.elementBounds.height ||
      left.elementBounds.x - right.elementBounds.x
    );
    const [score] = [(candidate: (typeof candidates)[number]) => {
      const landmark = /^(?:nav|header|footer)$/.test(candidate.tagName);
      const semantic = /^(?:section|article)$/.test(candidate.tagName) ||
        candidate.role === "region";
      return (landmark ? 100 : 0) +
        (candidate.heading ? 50 : 0) +
        (semantic ? 20 : 0) +
        (candidate.anchor ? 5 : 0) -
        Math.min(10, candidate.elementBounds.height / Math.max(1, documentHeight));
    }] as const;
    const startCandidates: typeof candidates = [];
    for (const candidate of candidates) {
      if (candidate.elementBounds.y >= maximumHeight) continue;
      const prior = startCandidates.at(-1);
      if (
        prior &&
        candidate.elementBounds.y - prior.elementBounds.y < 64
      ) {
        if (score(candidate) > score(prior)) {
          startCandidates[startCandidates.length - 1] = candidate;
        }
        continue;
      }
      startCandidates.push(candidate);
    }
    const fallbackRoot = document.body ?? document.documentElement;
    const fallbackStyle = getComputedStyle(fallbackRoot);
    const normalizedSections = startCandidates.length > 0
      ? startCandidates.slice(0, 200)
      : [{
          selector: selectorFor(fallbackRoot),
          tagName: fallbackRoot.tagName.toLowerCase(),
          role: clean(fallbackRoot.getAttribute("role"), 100) || undefined,
          heading: undefined,
          headingLevel: undefined,
          anchor: clean(fallbackRoot.id, 160) || undefined,
          classNames: [...fallbackRoot.classList].slice(0, 20),
          text: clean(fallbackRoot.textContent, 1_000),
          elementBounds: {
            x: 0,
            y: 0,
            width: pageWidth,
            height: documentHeight,
          },
          style: {
            display: clean(fallbackStyle.display, 80) || "block",
            position: clean(fallbackStyle.position, 80) || "static",
            flexDirection: clean(fallbackStyle.flexDirection, 80) || undefined,
            gridTemplateColumns: clean(fallbackStyle.gridTemplateColumns, 240) || undefined,
            maxWidth: clean(fallbackStyle.maxWidth, 80) || undefined,
            padding: clean(fallbackStyle.padding, 240) || undefined,
            gap: clean(fallbackStyle.gap, 80) || undefined,
            backgroundColor: clean(fallbackStyle.backgroundColor, 120) || undefined,
            color: clean(fallbackStyle.color, 120) || undefined,
          },
          content: {
            links: Math.min(10_000, fallbackRoot.querySelectorAll("a[href]").length),
            buttons: Math.min(10_000, fallbackRoot.querySelectorAll("button,[role=button]").length),
            images: Math.min(10_000, fallbackRoot.querySelectorAll("img,picture,svg").length),
            videos: Math.min(10_000, fallbackRoot.querySelectorAll("video").length),
            forms: Math.min(10_000, fallbackRoot.querySelectorAll("form").length),
          },
        }];
    const bandStarts = normalizedSections.map((section, position) => {
      if (position === 0) return 0;
      const previous = normalizedSections[position - 1]!;
      if (previous.tagName === "nav" || previous.tagName === "header") {
        return Math.min(
          section.elementBounds.y,
          previous.elementBounds.y + previous.elementBounds.height,
        );
      }
      return section.elementBounds.y;
    });
    const sectionBands = normalizedSections.map((section, position) => {
      const y = bandStarts[position]!;
      const nextY = bandStarts[position + 1] ?? documentHeight;
      return {
        position,
        ...section,
        bounds: {
          x: 0,
          y,
          width: pageWidth,
          height: Math.max(1, Math.min(nextY, maximumHeight) - y),
        },
      };
    });
    const htmlBytes = new TextEncoder().encode(
      document.documentElement.outerHTML,
    );
    const html = new TextDecoder().decode(
      htmlBytes.byteLength <= maximumHtmlBytes
        ? htmlBytes
        : htmlBytes.slice(0, maximumHtmlBytes - 4),
    );
    return {
      requestedUrl: requested,
      canonicalUrl: canonical,
      metadata: { name, description, category, accent, ...(iconUrl ? { iconUrl } : {}) },
      viewport,
      document: {
        width: Math.min(100_000, Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)),
        height: documentHeight,
      },
      html,
      sections: sectionBands,
    };
  }, {
    requested: requestedUrl,
    canonical: finalUrl,
    viewport: VIEWPORT,
    maximumHeight: MAXIMUM_CAPTURE_HEIGHT,
    maximumHtmlBytes: MAXIMUM_HTML_BYTES,
  });
}

async function cropSections(
  pageImage: Buffer,
  sections: PublicPageSection[],
): Promise<Array<{ position: number; body: Buffer }>> {
  const metadata = await sharp(pageImage).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  if (imageWidth < 1 || imageHeight < 1) throw new Error("Public page screenshot dimensions are invalid");
  const result: Array<{ position: number; body: Buffer }> = [];
  let totalBytes = 0;
  for (const section of sections) {
    const left = Math.max(0, Math.min(imageWidth - 1, Math.floor(section.bounds.x)));
    const top = Math.max(0, Math.min(imageHeight - 1, Math.floor(section.bounds.y)));
    const width = Math.max(1, Math.min(imageWidth - left, Math.ceil(section.bounds.width)));
    const height = Math.max(1, Math.min(imageHeight - top, Math.ceil(section.bounds.height)));
    const body = await sharp(pageImage).extract({ left, top, width, height }).png().toBuffer();
    assertCaptureBytes(body);
    totalBytes += body.byteLength;
    if (totalBytes > MAXIMUM_CAPTURE_BYTES) {
      throw new PublicPageValidationError("Public page section captures are too large");
    }
    result.push({ position: section.position, body });
  }
  return result;
}

async function recordContinuousScroll(
  page: Page,
  options: { pixelsPerSecond: number; maxDurationMs: number; holdMs: number },
): Promise<{ body: Buffer; durationMs: number }> {
  const directory = await mkdtemp(path.join(tmpdir(), "astryx-public-page-video-"));
  const framesPath = path.join(directory, "frames.mjpeg");
  const videoPath = path.join(directory, "preview.webm");
  const frames = createWriteStream(framesPath);
  const writeFrame = async (frame: Buffer): Promise<void> => {
    if (frames.write(frame)) return;
    await once(frames, "drain");
  };
  const frameWrites = createFrameWriteQueue(writeFrame);
  let framesFinished = false;
  let nextFrameTimestamp: number | undefined;
  let scrollControl: Awaited<ReturnType<Page["addStyleTag"]>> | undefined;
  const frameIntervalMs = 1_000 / PREVIEW_FRAMES_PER_SECOND;
  try {
    scrollControl = await page.addStyleTag({
      content: "html,body{scroll-behavior:auto!important;scroll-snap-type:none!important}",
    });
    const scrollTop = await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      ));
      return Math.round(window.scrollY);
    });
    if (scrollTop !== 0) {
      throw new PublicPageValidationError(
        `Public page preview did not reset to the top (${scrollTop})`,
      );
    }
    const initialFrame = await sharp(await page.screenshot({
      type: "jpeg",
      quality: 95,
    }))
      .resize(PREVIEW_VIDEO_SIZE.width, PREVIEW_VIDEO_SIZE.height)
      .jpeg({ quality: 95 })
      .toBuffer();
    await writeFrame(initialFrame);
    await page.screencast.start({
      size: PREVIEW_VIDEO_SIZE,
      quality: 95,
      onFrame: ({ data, timestamp }) => {
        if (nextFrameTimestamp === undefined) nextFrameTimestamp = timestamp;
        if (timestamp + 0.001 < nextFrameTimestamp) return;
        while (timestamp + 0.001 >= nextFrameTimestamp) {
          frameWrites.push(Buffer.from(data));
          nextFrameTimestamp += frameIntervalMs;
        }
      },
    });
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
    await frameWrites.flush();
    frames.end();
    await finished(frames);
    framesFinished = true;
    await encodePreviewVideo(framesPath, videoPath);
    return { body: await readFile(videoPath), durationMs };
  } finally {
    await page.screencast.stop().catch(() => undefined);
    await scrollControl?.evaluate((node) => node.parentNode?.removeChild(node))
      .catch(() => undefined);
    if (!framesFinished) frames.destroy();
    await rm(directory, { recursive: true, force: true });
  }
}

export function createFrameWriteQueue(write: (frame: Buffer) => Promise<void>): {
  push(frame: Buffer): void;
  flush(): Promise<void>;
} {
  let pending = Promise.resolve();
  return {
    push(frame) {
      pending = pending.then(() => write(frame));
    },
    flush() {
      return pending;
    },
  };
}

async function encodePreviewVideo(
  framesPath: string,
  videoPath: string,
): Promise<void> {
  if (!ffmpegPath) throw new Error("Public page video encoder is unavailable");
  const encoder = spawn(ffmpegPath, [
    "-y",
    "-loglevel", "error",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-framerate", String(PREVIEW_FRAMES_PER_SECOND),
    "-i", framesPath,
    "-an",
    "-c:v", "libvpx-vp9",
    "-deadline", "realtime",
    "-cpu-used", "5",
    "-row-mt", "1",
    "-b:v", "0",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    videoPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  encoder.stderr.setEncoding("utf8");
  encoder.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4_096);
  });
  await new Promise<void>((resolve, reject) => {
    encoder.once("error", reject);
    encoder.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(
        stderr.trim()
          ? `Public page video encoding failed: ${stderr.trim()}`
          : "Public page video encoding failed",
      ));
    });
  });
}

export function publicPageScrollDurationMs(
  distance: number,
  pixelsPerSecond: number,
  maxDurationMs = 20_000,
): number {
  const safeDistance = checkedNonNegative(distance, "scroll distance");
  const speed = checkedPositive(pixelsPerSecond, "scroll speed");
  const maximum = checkedPositive(maxDurationMs, "maximum scroll duration");
  return Math.min(maximum, Math.round(safeDistance / speed * 1_000));
}

export function createPublicNetworkValidator(
  resolve: (hostname: string) => Promise<Array<{ address: string; family: number }>> =
    async (hostname) => lookup(hostname, { all: true, verbatim: true }),
): (url: string) => Promise<void> {
  return async (value) => {
    const identity = canonicalPublicPageUrl(value);
    const parsed = new URL(identity.requestedUrl);
    const addresses = await resolve(parsed.hostname);
    if (addresses.length === 0) {
      throw new PublicPageValidationError("Public page host did not resolve");
    }
    for (const { address, family } of addresses) {
      const host = family === 6 ? `[${address}]` : address;
      canonicalPublicPageUrl(`${parsed.protocol}//${host}/`);
    }
  };
}

export function publicPageCaptureClip(
  document: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: 0; y: 0; width: number; height: number } {
  const width = Math.max(1, Math.min(
    checkedPositive(document.width, "document width"),
    checkedPositive(viewport.width, "viewport width"),
  ));
  const height = Math.max(1, Math.min(
    checkedPositive(document.height, "document height"),
    MAXIMUM_CAPTURE_HEIGHT,
  ));
  return { x: 0, y: 0, width, height };
}

async function lockMainFrameNavigation(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      await route.abort("aborted");
      return;
    }
    await route.fallback();
  });
}

function assertPageUrl(page: Page, expectedUrl: string): void {
  const actual = canonicalPublicPageUrl(page.url()).requestedUrl;
  if (actual !== expectedUrl) {
    throw new PublicPageValidationError("Public page navigated after initial render");
  }
}

function assertCaptureBytes(body: Buffer): void {
  if (body.byteLength < 1 || body.byteLength > MAXIMUM_CAPTURE_BYTES) {
    throw new PublicPageValidationError("Public page capture is too large");
  }
}

function checkedPositive(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${label}`);
  return value;
}

function checkedNonNegative(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}
