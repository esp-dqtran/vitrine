/**
 * Generates the real-product assets for the "Observed in N apps" ad.
 *
 * Everything a video model would mangle — UI, type, screen counts — is captured
 * from the running app instead of prompted. The AI half of the ad (the human
 * cold open, the B-roll) is generated separately from the prompts in the
 * emitted script.md.
 *
 *   npm run dev                                    # in another shell
 *   npx tsx scripts/generate-ad-assets.ts --base http://localhost:5173
 *
 * Options:
 *   --flow "Resetting password"   which flow card to build the ad around
 *   --out  ad-assets              output directory
 *   --storage state.json          record signed-in (export it yourself)
 */
import { chromium, type Page } from "playwright";
import { mkdir, writeFile, readdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const BASE = flag("base", "http://localhost:5173")!;
const FLOW = flag("flow", "Resetting password")!;
const OUT = flag("out", "ad-assets")!;
const STORAGE = flag("storage");
const SIZE = { width: 1600, height: 900 };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function glideScroll(page: Page, to: number, ms = 1200) {
  return page.evaluate(`new Promise((done) => {
    var from = window.scrollY, start = performance.now();
    var ease = function (t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; };
    var step = function (now) {
      var p = Math.min((now - start) / ${ms}, 1);
      window.scrollTo(0, from + (${to} - from) * ease(p));
      p < 1 ? requestAnimationFrame(step) : done();
    };
    step(start);
  })`);
}

/** Pans the flow's horizontal track end to end — this is the ad's hero shot. */
function panTrack(page: Page, name: string, ms: number) {
  return page.evaluate(`new Promise((done) => {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.flow-strip-card'));
    var card = cards.filter(function (c) { return c.innerText.indexOf(${JSON.stringify(name)}) >= 0; })[0];
    if (!card) return done();
    var track = card.querySelector('.flow-strip-card__track');
    if (!track) return done();
    var target = track.scrollWidth - track.clientWidth;
    var start = performance.now();
    var ease = function (t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; };
    var step = function (now) {
      var p = Math.min((now - start) / ${ms}, 1);
      track.scrollLeft = target * ease(p);
      p < 1 ? requestAnimationFrame(step) : done();
    };
    step(start);
  })`);
}

async function main() {
  const dir = join(OUT, slug(FLOW));
  await mkdir(join(dir, "screens"), { recursive: true });
  await mkdir(join(dir, "stills"), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: join(dir, "_video"), size: SIZE },
    storageState: STORAGE && existsSync(STORAGE) ? STORAGE : undefined,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/flows`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  const card = page.locator(".flow-strip-card", { hasText: FLOW }).first();
  await card.waitFor({ state: "visible", timeout: 20_000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  const meta = await card.evaluate((el) => {
    const lines = (el as HTMLElement).innerText.split("\n").filter(Boolean);
    return { title: lines[0] ?? "", stats: lines.find((l) => /screens/.test(l)) ?? "" };
  });

  // Still 1: the claim. This frame is the whole ad in one image.
  await card.screenshot({ path: join(dir, "stills", "claim-card.png") });

  // Pan the strip so every captured screen in the flow passes through frame.
  await panTrack(page, FLOW, 6000);
  await page.waitForTimeout(900);
  await panTrack(page, FLOW, 1);
  await page.waitForTimeout(600);

  // Still 2: the wall behind the claim — scale, in one frame.
  await glideScroll(page, 0, 900);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(dir, "stills", "flows-wall.png") });

  // Pull every screen in the flow at full resolution. These are the filmstrip
  // frames — clean PNGs an editor or a video model can cut against.
  const urls: string[] = await card.evaluate((el) => {
    const track = el.querySelector(".flow-strip-card__track");
    return Array.from(track?.querySelectorAll("img") ?? [])
      .map((i) => i.getAttribute("src") ?? "")
      .filter(Boolean);
  });

  let saved = 0;
  for (const [i, url] of urls.entries()) {
    const res = await page.request.get(url.startsWith("http") ? url : BASE + url);
    if (!res.ok()) continue;
    await writeFile(
      join(dir, "screens", `${String(i + 1).padStart(2, "0")}.png`),
      await res.body(),
    );
    saved++;
  }

  await context.close();
  await browser.close();

  const videoDir = join(dir, "_video");
  const [file] = (await readdir(videoDir)).filter((f) => f.endsWith(".webm"));
  if (file) await rename(join(videoDir, file), join(dir, "strip-pan.webm"));
  await rm(videoDir, { recursive: true, force: true });

  await writeFile(
    join(dir, "meta.json"),
    JSON.stringify({ flow: meta.title, stats: meta.stats, screens: saved }, null, 2),
  );
  console.log(`${meta.title} — ${meta.stats}`);
  console.log(`${saved} screens + stills + strip-pan.webm → ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
