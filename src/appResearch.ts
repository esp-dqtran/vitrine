import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type APIRequestContext, type APIResponse, type Route } from "playwright";
import { parseCrawlPlan, parseCrawlStep, type CrawlPlan, type CrawlStep } from "./crawlPlan.ts";
import { planPath, type StepFailure } from "./smartCrawler.ts";

// Research reads only the app's public surface: the homepage plus same-domain pages that
// describe the product (features, docs, pricing, help). No login, no app UI — the output
// is a *draft* crawl plan a human reviews before anything executes.

const MAX_PAGES = 30;
const MAX_PAGE_CHARS = 8_000;
const MAX_CORPUS_CHARS = 60_000; // stay well inside what a chat textarea accepts
const MAX_REDIRECT_HOPS = 10;

const PATH_ALLOWLIST = /^\/(features?|products?|software|solutions|pricing|docs?|guides?|help|support|changelog|whats-new)(\/|$)/i;
const SUBDOMAIN_ALLOWLIST = /^(docs|help|support|guide|developer)\./i;

function writeAtomicIfUnchanged(path: string, contents: string, expectedCurrent: string): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx");
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    if (readFileSync(path, "utf8") !== expectedCurrent) throw new Error("Crawl plan changed during repair; refusing to overwrite it");
    renameSync(temporary, path);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {}
    }
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function isResearchUrl(homepageUrl: string, candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate, homepageUrl);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const base = new URL(homepageUrl).hostname.replace(/^www\./, "");
  const host = url.hostname.replace(/^www\./, "");
  const sameSite = host === base || host.endsWith(`.${base}`);
  if (!sameSite) return false;
  if (SUBDOMAIN_ALLOWLIST.test(url.hostname)) return true;
  return host === base && PATH_ALLOWLIST.test(url.pathname);
}

function isAllowedResearchNavigation(homepageUrl: string, candidate: string): boolean {
  let homepage: URL;
  let url: URL;
  try {
    homepage = new URL(homepageUrl);
    url = new URL(candidate, homepage);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const canonicalHost = (hostname: string) => hostname.replace(/^www\./, "");
  const originalHomepage =
    canonicalHost(url.hostname) === canonicalHost(homepage.hostname) &&
    url.port === homepage.port &&
    url.pathname.replace(/\/$/, "") === homepage.pathname.replace(/\/$/, "");
  return originalHomepage || isResearchUrl(homepageUrl, url.toString());
}

async function fetchResearchDocument(
  request: APIRequestContext,
  homepageUrl: string,
  startUrl: string
): Promise<{ url: string; response: APIResponse }> {
  let current = new URL(startUrl).toString();
  let redirects = 0;
  const visited = new Set<string>();
  while (true) {
    if (!isAllowedResearchNavigation(homepageUrl, current)) throw new Error(`Disallowed research navigation: ${current}`);
    if (visited.has(current)) throw new Error(`Research redirect loop at ${current}`);
    visited.add(current);

    const response = await request.get(current, { maxRedirects: 0, timeout: 20_000 });
    const location = response.headers().location;
    if (location && response.status() >= 300 && response.status() < 400) {
      let next: string;
      try {
        next = new URL(location, current).toString();
      } finally {
        await response.dispose();
      }
      if (!isAllowedResearchNavigation(homepageUrl, next)) throw new Error(`Disallowed research redirect: ${next}`);
      if (redirects++ >= MAX_REDIRECT_HOPS) throw new Error(`Research redirect limit exceeded at ${next}`);
      current = next;
      continue;
    }
    return { url: current, response };
  }
}

export interface ResearchPage {
  url: string;
  text: string;
}

export function buildCorpus(pages: ResearchPage[]): string {
  let corpus = "";
  for (const page of pages) {
    const chunk = `\n\n===== ${page.url} =====\n${page.text.slice(0, MAX_PAGE_CHARS)}`;
    if (corpus.length + chunk.length > MAX_CORPUS_CHARS) break;
    corpus += chunk;
  }
  return corpus.trim();
}

export async function collectResearchPages(homepageUrl: string): Promise<ResearchPage[]> {
  let homepage: URL;
  try {
    homepage = new URL(homepageUrl);
  } catch {
    throw new Error("Homepage URL must be an absolute http(s) URL");
  }
  if (!/^https?:$/.test(homepage.protocol)) throw new Error("Homepage URL must use http or https");

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  try {
    const page = await browser.newPage();
    const queue = [homepage.toString()];
    const visited = new Set<string>();
    const pages: ResearchPage[] = [];
    while (queue.length > 0 && pages.length < MAX_PAGES) {
      const url = queue.shift()!;
      const normalized = new URL(url).toString().replace(/[#?].*$/, "");
      if (visited.has(normalized)) continue;
      visited.add(normalized);
      try {
        const document = await fetchResearchDocument(page.context().request, homepageUrl, normalized);
        let fulfilled = false;
        const handler = async (route: Route) => {
          const request = route.request();
          if (!fulfilled && request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url() === document.url) {
            fulfilled = true;
            await route.fulfill({ response: document.response });
          } else {
            await route.continue();
          }
        };
        let routed = false;
        try {
          await page.route(document.url, handler);
          routed = true;
          await page.goto(document.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          await page.waitForTimeout(1000);
        } finally {
          try {
            if (routed) await page.unroute(document.url, handler);
          } finally {
            await document.response.dispose();
          }
        }
      } catch (error) {
        console.warn(`Skipping ${normalized}: ${error}`);
        continue;
      }
      const finalUrl = page.url();
      if (!isAllowedResearchNavigation(homepageUrl, finalUrl)) {
        console.warn(`Skipping disallowed redirect target ${finalUrl}`);
        continue;
      }
      const finalNormalized = new URL(finalUrl).toString().replace(/[#?].*$/, "");
      const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      if (text.trim()) pages.push({ url: finalNormalized, text: text.trim() });
      console.log(`Researched ${pages.length}/${MAX_PAGES}: ${finalNormalized}`);
      const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href)).catch(() => [] as string[]);
      for (const href of hrefs) {
        if (isResearchUrl(homepageUrl, href)) queue.push(href);
      }
    }
    return pages;
  } finally {
    await browser.close();
  }
}

export function buildResearchPrompt(appName: string, homepageUrl: string, corpus: string): string {
  return `You are helping catalog the user flows of a web application so a scripted browser can walk through them and capture screenshots.

App: ${appName}
Homepage: ${homepageUrl}

Below is text scraped from the app's public website and documentation. Based ONLY on what these pages describe, produce a crawl plan as strict JSON (no markdown fences, no commentary) with exactly this shape:

{
  "app": "${appName}",
  "revision": 1,
  "startUrl": "${homepageUrl}",
  "domain": "<one or two sentences: what this product is and who uses it>",
  "sources": ["<urls you drew from>"],
  "reviewed": false,
  "flows": [
    {
      "id": "<kebab-case-id>",
      "title": "<short human title>",
      "description": "<what a user accomplishes in this flow>",
      "safe": false,
      "requiredSecrets": [],
      "steps": [
        {
          "id": "<stable-step-id>",
          "action": "goto",
          "url": "/some-path",
          "safety": "read",
          "expected": {
            "state": "<human-readable resulting state>",
            "urlPattern": "${homepageUrl}/*",
            "page": "same",
            "visible": { "role": "heading", "name": "Visible heading" }
          }
        }
      ]
    }
  ]
}

Rules:
- Only these actions exist: goto, click, fill, press, waitFor. Nothing else.
- Every step has a stable non-empty id, "safety": "read" or "side-effect", and an "expected" object with a non-empty state label.
- Every expected outcome has at least one observable assertion among url, urlPattern, visible, or hidden. Page alone is not proof; it only says same or new.
- url is exact. urlPattern supports * as its only wildcard; all other regex-looking characters are literal.
- Locator priority is role+name first, visible text second, and CSS only as a last resort. A CSS locator requires a non-empty locatorReason.
- Every click/fill/waitFor step has EXACTLY ONE locator: role+name, text, or css. goto and press have none.
- optional: true is only for nonessential environmental variation and requires a non-empty optionalReason.
- Fill secrets are exact $[A-Z][A-Z0-9_]* references. requiredSecrets contains the matching names without $, uniquely and with no unused names. Never emit literal emails, bearer tokens, passwords, or private keys.
- Steps must use real navigation labels, button texts, and URLs mentioned in the scraped pages. Do not invent UI you have no evidence for.
- 4 to 8 flows, ordered from most public (browsing marketing/docs pages) to most product-internal.
- Mark EVERY flow "safe": false. A human reviewer decides what is safe.
- A safe flow may contain only "read" steps; any "side-effect" step makes the flow unsafe.
- Keep "reviewed": false. A human must review the complete plan.
- Output raw JSON only.

Scraped pages:
${corpus}`;
}

// LLM replies love markdown fences and prose around the JSON — cut from the first "{"
// to the last "}" and let the strict parser judge the rest.
export function extractJson(reply: string): string {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Reply contains no JSON object");
  return reply.slice(start, end + 1);
}

// Never trust the model with the safety fields: a draft plan is always unreviewed and
// every flow unsafe until a human says otherwise.
export function sanitizeDraft(plan: CrawlPlan, appName: string, homepageUrl: string): CrawlPlan {
  return {
    ...plan,
    app: appName,
    revision: 1,
    startUrl: homepageUrl,
    reviewed: false,
    flows: plan.flows.map((flow) => ({
      ...flow,
      safe: false,
      steps: flow.steps.map((step) => ({ ...step, safety: "side-effect" })),
    })),
  };
}

export type AskFn = (prompt: string, filePath?: string) => Promise<string>;

export async function draftPlan(appName: string, homepageUrl: string, corpus: string, ask: AskFn): Promise<CrawlPlan> {
  const prompt = buildResearchPrompt(appName, homepageUrl, corpus);
  let reply = await ask(prompt);
  for (let attempt = 0; ; attempt++) {
    try {
      return sanitizeDraft(parseCrawlPlan(extractJson(reply)), appName, homepageUrl);
    } catch (error) {
      if (attempt >= 1) {
        throw new Error(`LLM did not produce a valid crawl plan after a retry. Last error: ${(error as Error).message}`);
      }
      reply = await ask(
        `${prompt}\n\nYour previous reply failed validation with: ${(error as Error).message}\nReply again with corrected raw JSON only.`
      );
    }
  }
}

export function buildRepairPrompt(failure: StepFailure, flowSteps: CrawlStep[]): string {
  return `A scripted browser walking a web app failed on one step. The attached screenshot shows where it got stuck.

Flow steps so far (the step at index ${failure.stepIndex} failed):
${JSON.stringify(flowSteps, null, 2)}

Failed step:
${JSON.stringify(failure.step, null, 2)}

Error:
${failure.error}

Suggest a corrected replacement for the failed step. Rules:
- Only these actions exist: goto, click, fill, press, waitFor.
- Preserve the stable "id" and include "safety": "read" or "side-effect".
- click/fill/waitFor need EXACTLY ONE locator: role+name, or text (visible wording from the screenshot), or css as a last resort.
- CSS requires a non-empty "locatorReason".
- Include "expected" with a non-empty "state" and at least one of exact url, wildcard-only urlPattern, visible, or hidden. page alone is not proof.
- If the element genuinely may not exist (cookie banner, one-time tip), add "optional": true and a non-empty "optionalReason".
- Fill secrets must be exact $[A-Z][A-Z0-9_]* references; never include literal credentials.
- Reply with the single corrected step as raw JSON only — one object, no fences, no commentary.`;
}

// Reads the failure report, asks the LLM (with the stuck-state screenshot) for a corrected
// step, and patches the plan only after the human confirms. A repair is a new unreviewed
// revision because confirming the replacement is separate from approving the full plan.
export async function repairFlow(
  appName: string,
  flowId: string,
  ask: AskFn,
  confirm: (message: string) => Promise<boolean>,
  dataDir = "data"
): Promise<boolean> {
  const path = planPath(appName, dataDir);
  if (!existsSync(path)) throw new Error(`No crawl plan at ${path}. Run "research ${appName} <homepageUrl>" first.`);
  const originalBytes = readFileSync(path, "utf8");
  const plan = parseCrawlPlan(originalBytes);
  const reportPath = join(dataDir, "crawl-reports", plan.app, "report.json");
  if (!existsSync(reportPath)) throw new Error(`No failure report at ${reportPath}. Run smart-crawl first.`);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as { failures: StepFailure[] };
  const failure = report.failures.find((f) => f.flow === flowId);
  if (!failure) throw new Error(`No recorded failure for flow "${flowId}" in ${reportPath}`);
  const flow = plan.flows.find((f) => f.id === flowId);
  if (!flow) throw new Error(`Flow "${flowId}" is not in the plan anymore`);

  const prompt = buildRepairPrompt(failure, flow.steps);
  const reply = await ask(prompt, existsSync(failure.screenshot) ? failure.screenshot : undefined);
  const fixed = parseCrawlStep(JSON.parse(extractJson(reply)));
  const target = flow.steps[failure.stepIndex];
  if (!target) throw new Error(`Failed step index ${failure.stepIndex} is no longer in flow "${flowId}"`);
  if (fixed.id !== target.id) throw new Error(`Replacement id must match failed step id "${target.id}"`);

  const candidate = parseCrawlPlan(
    JSON.stringify({
      ...plan,
      revision: plan.revision + 1,
      reviewed: false,
      flows: plan.flows.map((candidateFlow) =>
        candidateFlow.id === flowId
          ? { ...candidateFlow, steps: candidateFlow.steps.map((step, index) => (index === failure.stepIndex ? fixed : step)) }
          : candidateFlow
      ),
    })
  );

  const message = `Replace step ${failure.stepIndex + 1} of flow "${flowId}":\n  old: ${JSON.stringify(failure.step)}\n  new: ${JSON.stringify(fixed)}\nApply?`;
  if (!(await confirm(message))) return false;

  writeAtomicIfUnchanged(path, JSON.stringify(candidate, null, 2), originalBytes);
  console.log(`Patched ${path}. Re-run smart-crawl (captured states dedupe for free).`);
  return true;
}

export async function researchApp(appName: string, homepageUrl: string, ask: AskFn, dataDir = "data"): Promise<string> {
  new URL(homepageUrl);
  const pages = await collectResearchPages(homepageUrl);
  if (pages.length === 0) throw new Error(`Could not read any public pages from ${homepageUrl}`);
  const plan = await draftPlan(appName, homepageUrl, buildCorpus(pages), ask);
  const path = planPath(appName, dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(plan, null, 2));
  console.log(`Draft crawl plan written to ${path} (${plan.flows.length} flows).`);
  console.log(`Review it, fix or delete flows, mark truly read-only ones "safe": true, then set "reviewed": true and run smart-crawl.`);
  return path;
}
