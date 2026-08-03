/**
 * Records any self-animating page for N seconds. Companion to the motion
 * pages in public/ (orbit.html etc.) — they animate themselves; this just
 * points a browser at them and captures video.
 *
 *   npx tsx scripts/record-page.ts --url http://localhost:5173/orbit.html \
 *     --seconds 16 --out out.webm [--ready __orbitReady]
 *
 * --ready waits for window.<flag> to be truthy before the clock starts, so
 * the recording never opens on half-loaded assets.
 */
import { chromium } from "playwright";
import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const URL = flag("url")!;
const SECONDS = Number(flag("seconds", "16"));
const OUT = flag("out", "recording.webm")!;
const READY = flag("ready");
const SIZE = { width: 1920, height: 1080 };

async function main() {
  if (!URL) throw new Error("--url is required");
  const dir = await mkdtemp(join(tmpdir(), "record-page-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  if (READY) {
    await page.waitForFunction(`window.${READY} === true`, { timeout: 30_000 });
  }
  await page.waitForTimeout(SECONDS * 1000);
  await context.close();
  await browser.close();

  const [file] = (await readdir(dir)).filter((f) => f.endsWith(".webm"));
  if (!file) throw new Error("no video produced");
  await rename(join(dir, file), OUT);
  await rm(dir, { recursive: true, force: true });
  console.log(`recorded: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
