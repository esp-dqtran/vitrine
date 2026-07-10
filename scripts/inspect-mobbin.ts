// Throwaway diagnostic: opens Mobbin, waits for you to log in and open an app's
// screens gallery, then auto-detects once images load and dumps what it found
// (network JSON endpoints, image DOM shape, scroll/pagination behavior) to
// scripts/mobbin-inspection.json so the real crawler's selectors can be fixed.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const jsonResponses: { url: string; status: number; snippet: string }[] = [];

const context = await chromium.launchPersistentContext("data/browser-profile-mobbin", {
  headless: false,
});
const page = context.pages()[0] ?? (await context.newPage());

page.on("response", async (res) => {
  const ct = res.headers()["content-type"] ?? "";
  const url = res.url();
  if (!ct.includes("json")) return;
  if (!/mobbin/i.test(url)) return;
  try {
    const body = await res.text();
    jsonResponses.push({ url, status: res.status(), snippet: body.slice(0, 1500) });
  } catch {
    // response body not available (redirected/aborted) — skip
  }
});

await page.goto("https://mobbin.com", { waitUntil: "domcontentloaded" });

console.log(
  "\nLog in, then open any app and go to its Screens gallery (e.g. search 'Airbnb' -> Screens tab)."
);
console.log("This script will auto-detect once ~15+ screenshots are visible on the page.\n");

const deadline = Date.now() + 10 * 60_000;
let imgCount = 0;
let lastLog = 0;
while (Date.now() < deadline) {
  const pathDepth = new URL(page.url()).pathname.split("/").filter(Boolean).length;
  imgCount = await page.evaluate(() => document.querySelectorAll("img").length);
  const bigCount = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll("img").forEach((i) => {
      if ((i as HTMLImageElement).naturalWidth > 150) n++;
    });
    return n;
  });
  if (pathDepth >= 2 && bigCount > 15) break;
  if (Date.now() - lastLog > 15_000) {
    console.log(`...still waiting (url=${page.url()}, big images=${bigCount})`);
    lastLog = Date.now();
  }
  await page.waitForTimeout(2000);
}

console.log(`Detected gallery at ${page.url()} (${imgCount} <img> tags).`);

const beforeScrollCount = await page.evaluate(() => document.querySelectorAll("img").length);
const beforeHeight = await page.evaluate(() => document.body.scrollHeight);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(2500);
const afterScrollCount = await page.evaluate(() => document.querySelectorAll("img").length);
const afterHeight = await page.evaluate(() => document.body.scrollHeight);

const sampleImages = await page.evaluate(() => {
  const big = Array.from(document.querySelectorAll("img")).filter(
    (img) => (img as HTMLImageElement).naturalWidth > 150
  );
  return big.slice(0, 5).map((img) => {
    const ancestors: string[] = [];
    let cur: Element | null = img.parentElement;
    for (let i = 0; i < 4 && cur; i++) {
      ancestors.push(
        `<${cur.tagName.toLowerCase()} class="${(cur as HTMLElement).className}" data-testid="${cur.getAttribute("data-testid") ?? ""}">`
      );
      cur = cur.parentElement;
    }
    return {
      src: (img as HTMLImageElement).currentSrc || img.src,
      srcset: (img as HTMLImageElement).srcset,
      width: (img as HTMLImageElement).naturalWidth,
      height: (img as HTMLImageElement).naturalHeight,
      alt: img.alt,
      ancestors,
    };
  });
});

const result = {
  finalUrl: page.url(),
  scrollTest: { beforeScrollCount, afterScrollCount, beforeHeight, afterHeight },
  sampleImages,
  jsonResponses: jsonResponses.slice(0, 20),
};

writeFileSync("scripts/mobbin-inspection.json", JSON.stringify(result, null, 2));
console.log("Wrote scripts/mobbin-inspection.json");

await context.close();
