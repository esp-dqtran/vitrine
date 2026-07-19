import { chromium } from "playwright";

const profileDir = process.argv[2];
const email = process.argv[3];
if (!profileDir || !email) throw new Error("usage: _login_window_prefill.ts <profile-dir> <email>");

const context = await chromium.launchPersistentContext(profileDir, { headless: false });
const page = context.pages()[0] ?? (await context.newPage());
await page.bringToFront();
await page.goto("https://mobbin.com/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const candidates = [
  page.getByRole("textbox", { name: /email/i }),
  page.getByPlaceholder(/email/i),
  page.getByLabel(/email/i),
  page.locator('input[type="email"]'),
  page.locator("input").first(),
];

let filled = false;
for (const locator of candidates) {
  try {
    await locator.waitFor({ state: "visible", timeout: 8000 });
    await locator.fill(email);
    filled = true;
    break;
  } catch {
    continue;
  }
}
if (!filled) {
  console.log(`[${profileDir}] Couldn't find a fillable email field automatically — log in manually. Ctrl+C this process when done.`);
  await new Promise(() => {});
}

const submitCandidates = [
  page.getByRole("button", { name: /continue|next|submit|sign in|log in/i }),
  page.locator('button[type="submit"]'),
];
let clicked = false;
for (const locator of submitCandidates) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: 5000 });
    await locator.first().click();
    clicked = true;
    console.log(`[${profileDir}] Email filled and submitted. Enter the verification code yourself when it arrives, then leave it.`);
    break;
  } catch {
    continue;
  }
}
if (!clicked) {
  console.log(`[${profileDir}] Email filled, but couldn't find a Continue/submit button — click it yourself.`);
}
await new Promise(() => {});
