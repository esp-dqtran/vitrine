/**
 * Records the landing hero demo by driving the real app in a browser.
 *
 * The hero has to show the product being used, so this scripts an actual
 * session rather than animating a screenshot. Playwright's video capture does
 * not draw the mouse, so a synthetic cursor is injected and moved along the
 * same path the real clicks take.
 *
 *   npm run dev                       # in another shell
 *   npx tsx scripts/record-hero-demo.ts --base http://localhost:5173
 *
 * Pass --storage <state.json> to record the signed-in experience. Export that
 * file yourself from a logged-in browser — this script never handles
 * credentials and never logs in.
 */
import { chromium, type Page } from "playwright";
import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = flag("base", "http://localhost:5173")!;
const STORAGE = flag("storage");
const OUT = flag("out", "public/landing/astryx-product-demo.webm")!;
// 16:9 so the hero's `aspect-ratio: 16 / 9` frame never crops the recording.
const SIZE = { width: 1600, height: 900 };

// In-page code is passed as source strings on purpose: tsx/esbuild rewrites
// function declarations with a `__name` helper that does not exist inside the
// page, so anything transpiled and then serialized throws ReferenceError.

/** Eased scroll — a jump-cut scroll reads as a bug, not as someone reading. */
function glideScroll(page: Page, to: number, ms = 1400) {
  return page.evaluate(`new Promise((done) => {
    var from = window.scrollY, start = performance.now();
    var ease = function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    var step = function (now) {
      var p = Math.min((now - start) / ${ms}, 1);
      window.scrollTo(0, from + (${to} - from) * ease(p));
      p < 1 ? requestAnimationFrame(step) : done();
    };
    step(start);
  })`);
}

/** Resting position. The clip opens and closes here so the loop has no jump. */
const CURSOR_HOME = { x: 760, y: 700 };

const CURSOR_SVG =
  '<svg width="22" height="30" viewBox="0 0 12 19" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width=".9">' +
  '<path d="M1 1l10 9.5-4.6.3 2.8 6-2.4 1.1-2.7-6L1 15z"/></svg>';

/** Injects a cursor that survives client-side navigation. */
function installCursor(page: Page) {
  return page.addInitScript(`(function () {
    var draw = function () {
      if (document.getElementById('__demo_cursor')) return;
      var el = document.createElement('div');
      el.id = '__demo_cursor';
      el.innerHTML = ${JSON.stringify(CURSOR_SVG)};
      el.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;' +
        'pointer-events:none;transition:transform .55s cubic-bezier(.33,1,.68,1);' +
        'filter:drop-shadow(0 3px 8px rgba(0,0,0,.5));' +
        'transform:translate(${CURSOR_HOME.x}px,${CURSOR_HOME.y}px)';
      document.documentElement.appendChild(el);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', draw);
    } else { draw(); }
    setInterval(draw, 400);
  })()`);
}

const moveCursor = (page: Page, x: number, y: number) =>
  page.evaluate(`(function () {
    var el = document.getElementById('__demo_cursor');
    if (el) el.style.transform = 'translate(${Math.round(x)}px, ${Math.round(y)}px)';
  })()`);

/** Glide the synthetic cursor to an element, pause, then really click it. */
async function pointAndClick(page: Page, selector: string, settle = 650) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible", timeout: 15_000 });
  const box = await target.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await moveCursor(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
  await target.click();
  await page.waitForTimeout(settle);
}

async function main() {
  const videoDir = await mkdtemp(join(tmpdir(), "hero-demo-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: SIZE },
    storageState: STORAGE && existsSync(STORAGE) ? STORAGE : undefined,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await installCursor(page);

  await page.goto(`${BASE}/apps`, { waitUntil: "networkidle" });
  // Preview thumbnails redirect to S3; without this the opening frame — which
  // is also the closing frame — records an empty grid.
  await page.waitForTimeout(3000);
  await glideScroll(page, 0, 1);
  await page.waitForTimeout(900);

  // 1. Switch platform — the fastest way to show this is a multi-platform catalog.
  await pointAndClick(page, 'button[aria-label*="App platform"]', 500);
  const ios = page.getByRole("option", { name: /ios/i }).first();
  if (await ios.isVisible().catch(() => false)) {
    const box = await ios.boundingBox();
    if (box) await moveCursor(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(450);
    await ios.click();
    await page.waitForTimeout(1600);
  } else {
    await page.keyboard.press("Escape");
  }

  // 2. Open a taxonomy filter so the demo shows the catalog is structured.
  await pointAndClick(page, 'button[aria-label*="Screens filters"]', 1100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);

  // 3. Read the wall.
  await glideScroll(page, 1000, 1600);
  await page.waitForTimeout(1100);

  // 4. Cross into Flows — the part of the catalog a screenshot cannot show.
  //    It loads slower than Apps, so it gets the longest settle in the script.
  await glideScroll(page, 0, 700);
  await pointAndClick(page, 'button:has-text("Flows"), [role="tab"]:has-text("Flows")', 3400);
  await glideScroll(page, 620, 1300);
  await page.waitForTimeout(1500);

  // 5. Return to the opening framing so the hero's `loop` has no visible seam.
  //    The cursor has to come home too — parking it anywhere else makes the
  //    pointer teleport on every repeat.
  await glideScroll(page, 0, 800);
  await pointAndClick(page, '[role="tab"]:has-text("Apps"), button:has-text("Apps")', 1600);
  await moveCursor(page, CURSOR_HOME.x, CURSOR_HOME.y);
  await page.waitForTimeout(1100);

  await context.close();
  await browser.close();

  const [file] = (await readdir(videoDir)).filter((f) => f.endsWith(".webm"));
  if (!file) throw new Error("playwright produced no video");
  await rename(join(videoDir, file), OUT);
  await rm(videoDir, { recursive: true, force: true });
  console.log(`recorded: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
