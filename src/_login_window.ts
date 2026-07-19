import { chromium } from "playwright";

const profileDir = process.argv[2];
if (!profileDir) throw new Error("usage: _login_window.ts <profile-dir>");

const context = await chromium.launchPersistentContext(profileDir, { headless: false });
const page = context.pages()[0] ?? (await context.newPage());
await page.bringToFront();
await page.goto("https://mobbin.com/login", { waitUntil: "domcontentloaded" });
console.log(`[${profileDir}] Window open — log in, then leave it. Ctrl+C this process when done.`);
await new Promise(() => {});
