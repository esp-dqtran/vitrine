import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Page } from "playwright";
import type { AgentObservation, AutonomousMission, MissionMode } from "./autonomousCrawler.ts";
import {
  parseCrawlSteps,
  resolveStepUrl,
  type CrawlAction,
  type CrawlLocator,
  type CrawlPlan,
  type CrawlStep,
} from "./crawlPlan.ts";
import { assertAgentEpisodePlan } from "./smartCrawler.ts";

export interface AgentMission extends AutonomousMission {
  id: string;
}

export interface AgentDecision extends CrawlLocator {
  action: CrawlAction;
  url?: string;
  key?: string;
  value?: string;
  locatorReason?: string;
  optional?: boolean;
  optionalReason?: string;
  expectedState: string;
  expectedUrl?: string;
  expectedUrlPattern?: string;
  expectedVisible?: CrawlLocator;
  expectedHidden?: CrawlLocator;
  expectedPage?: "same" | "new";
  mode: MissionMode;
}

export interface BuildEpisodePlanInput {
  app: string;
  startUrl: string;
  mission: AgentMission;
  observation: AgentObservation;
  decision: AgentDecision | AgentDecision[];
  allowAll: boolean;
  allowedOrigins?: string[];
  sourceUrls?: string[];
}

export interface AgentEpisodeInput extends BuildEpisodePlanInput {
  parentRunId: string;
}

export interface EpisodeResult {
  runId: string;
  missionId: string;
  status: "succeeded" | "failed" | "blocked" | "authentication_required";
}

export interface AuthenticationRequiredEpisodeResult extends EpisodeResult {
  status: "authentication_required";
}

export interface AgentEpisodeDependencies<T extends EpisodeResult = EpisodeResult> {
  saveAutonomousPlan(plan: CrawlPlan, parentRunId: string, missionId: string): Promise<{ id: string }>;
  createChildRun(input: { parentRunId: string; missionId: string; planId: string; allowSideEffects: boolean }): Promise<{ id: string }>;
  executeRun(childRunId: string): Promise<{ id: string }>;
  readEpisodeResult(childRunId: string, missionId: string): Promise<T>;
  checkpointMission(missionId: string, checkpoint: { reason: "authentication_required"; observation: AgentObservation }): Promise<void>;
  requestAuthenticationLease(parentRunId: string, missionId: string): Promise<void>;
}

export interface OriginPolicy {
  allows(value: string): boolean;
  assert(value: string): void;
}

function nonPublicIpv4(host: string): boolean {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19));
}

function isPublicHttpUrl(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ip = isIP(host);
  return ["http:", "https:"].includes(url.protocol)
    && !url.username && !url.password
    && host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local")
    && !(ip === 4 && nonPublicIpv4(host))
    && !(ip === 6 && (host === "::" || host === "::1" || /^(?:fc|fd|fe[89ab]|ff)/i.test(host)));
}

function policyUrl(value: string): URL | undefined {
  try {
    return new URL(value.replace(/\*/g, "wildcard"));
  } catch {
    return undefined;
  }
}

export function createOriginPolicy(startUrl: string, allowedOrigins: string[] = []): OriginPolicy {
  const start = policyUrl(startUrl);
  if (!start || !isPublicHttpUrl(start)) throw new Error("Agent start URL must be a public HTTP(S) URL");
  const origins = new Set([start.origin]);
  for (const value of allowedOrigins) {
    const url = policyUrl(value);
    if (!url || !isPublicHttpUrl(url)) throw new Error(`Allowed origin is not public: ${value}`);
    origins.add(url.origin);
  }
  const allows = (value: string): boolean => {
    const url = policyUrl(value);
    return Boolean(url && isPublicHttpUrl(url) && origins.has(url.origin));
  };
  return {
    allows,
    assert(value: string): void {
      if (!allows(value)) throw new Error(`URL is outside the autonomous origin policy: ${value}`);
    },
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function decisionStep(decision: AgentDecision, missionId: string, index: number, startUrl: string): Record<string, unknown> {
  const expectedUrl = decision.expectedUrl
    ?? (decision.action === "goto" && decision.url ? resolveStepUrl(startUrl, decision.url) : undefined);
  const expected = {
    state: decision.expectedState,
    page: decision.expectedPage ?? "same",
    ...(expectedUrl ? { url: expectedUrl } : {}),
    ...(decision.expectedUrlPattern ? { urlPattern: decision.expectedUrlPattern } : {}),
    ...(decision.expectedVisible ? { visible: decision.expectedVisible } : {}),
    ...(decision.expectedHidden ? { hidden: decision.expectedHidden } : {}),
  };
  return {
    id: `${missionId}-step-${index + 1}`,
    action: decision.action,
    ...(decision.url !== undefined ? { url: decision.url } : {}),
    ...(decision.key !== undefined ? { key: decision.key } : {}),
    ...(decision.value !== undefined ? { value: decision.value } : {}),
    ...(decision.role !== undefined ? { role: decision.role } : {}),
    ...(decision.name !== undefined ? { name: decision.name } : {}),
    ...(decision.text !== undefined ? { text: decision.text } : {}),
    ...(decision.css !== undefined ? { css: decision.css } : {}),
    ...(decision.locatorReason !== undefined ? { locatorReason: decision.locatorReason } : {}),
    ...(decision.optional !== undefined ? { optional: decision.optional } : {}),
    ...(decision.optionalReason !== undefined ? { optionalReason: decision.optionalReason } : {}),
    safety: decision.mode === "mutate" ? "side-effect" : "read",
    expected,
  };
}

export function buildEpisodePlan(input: BuildEpisodePlanInput): CrawlPlan {
  const decisions = Array.isArray(input.decision) ? input.decision : [input.decision];
  if (decisions.some((decision) => decision.mode === "mutate") && !input.allowAll) {
    throw new Error("Autonomous side-effect steps require allow_all");
  }
  const policy = createOriginPolicy(input.startUrl, input.allowedOrigins);
  const steps = parseCrawlSteps(decisions.map((decision, index) => decisionStep(decision, input.mission.id, index, input.startUrl)));
  for (const step of steps) {
    if (step.action === "goto" && step.url) policy.assert(resolveStepUrl(input.startUrl, step.url));
    if (step.expected.url) policy.assert(step.expected.url);
    if (step.expected.urlPattern) policy.assert(step.expected.urlPattern);
  }
  const requiredSecrets = [...new Set(steps.flatMap((step) => {
    const match = step.value?.match(/^\$([A-Z][A-Z0-9_]*)$/);
    return match ? [match[1]] : [];
  }))];
  const plan: CrawlPlan = {
    app: input.app.trim(),
    revision: 1,
    startUrl: input.startUrl,
    domain: input.mission.goal,
    sources: [...new Set(input.sourceUrls ?? [])],
    reviewed: true,
    flows: [{
      id: input.mission.missionKey,
      title: input.mission.goal,
      description: `Autonomous episode from ${input.observation.title || input.observation.url}`,
      safe: steps.every((step) => step.safety === "read"),
      requiredSecrets,
      steps,
    }],
  };
  assertAgentEpisodePlan(plan);
  return freeze(plan);
}

export async function observePage(page: Page): Promise<AgentObservation> {
  const snapshot = await page.locator("body").ariaSnapshot({ timeout: 10_000 });
  const landmarks = (await page.getByRole("heading").allTextContents()).slice(0, 100);
  const controls = await page.locator("button, a, input, select, textarea").evaluateAll((nodes) => nodes.slice(0, 200).map((node) => ({
    role: node.getAttribute("role") ?? node.tagName.toLowerCase(),
    name: node.getAttribute("aria-label") ?? (node.textContent ?? "").trim().slice(0, 160),
  })).filter(({ name }) => name));
  const png = await page.screenshot({ fullPage: true });
  const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
  return {
    url: page.url(),
    title: await page.title(),
    landmarks,
    controls,
    screenshotHash: hash(png),
    domHash: hash(Buffer.from(snapshot)),
  };
}

export async function executeAgentEpisode<T extends EpisodeResult>(
  input: AgentEpisodeInput,
  dependencies: AgentEpisodeDependencies<T>,
): Promise<T | AuthenticationRequiredEpisodeResult> {
  const authenticationRequired = async (): Promise<AuthenticationRequiredEpisodeResult> => {
    await dependencies.checkpointMission(input.mission.id, { reason: "authentication_required", observation: input.observation });
    await dependencies.requestAuthenticationLease(input.parentRunId, input.mission.id);
    return { runId: input.parentRunId, missionId: input.mission.id, status: "authentication_required" };
  };
  if (isAuthenticationObservation(input.observation)) return authenticationRequired();
  const plan = buildEpisodePlan(input);
  const storedPlan = await dependencies.saveAutonomousPlan(plan, input.parentRunId, input.mission.id);
  const child = await dependencies.createChildRun({
    parentRunId: input.parentRunId,
    missionId: input.mission.id,
    planId: storedPlan.id,
    allowSideEffects: input.allowAll,
  });
  const run = await dependencies.executeRun(child.id);
  const result = await dependencies.readEpisodeResult(run.id, input.mission.id);
  if (result.status === "authentication_required") return authenticationRequired();
  return result;
}

export function isAuthenticationObservation(observation: AgentObservation): boolean {
  let path = "";
  try {
    path = new URL(observation.url).pathname;
  } catch {
    path = observation.url;
  }
  return /(?:^|[-_/])(login|sign-?in|authenticate)(?:$|[-_/])/i.test(path)
    || /\b(?:log in|sign in|authentication required)\b/i.test([observation.title, ...observation.landmarks].join(" "));
}
