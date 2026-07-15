import { buildCorpus, extractJson, type ResearchPage } from "./appResearch.ts";
import {
  parseAppDossier,
  type AppDossier,
  type CandidateFlow,
  type DossierClaim,
  type DossierSource,
} from "./autonomousCrawler.ts";
import type { ChatSession } from "./llmChat.ts";

export interface ResearchDossierInput {
  app: string;
  homepageUrl: string;
}

export interface ResearchReport {
  sourceCandidates: string[];
  claims: DossierClaim[];
  candidateFlows: CandidateFlow[];
  roles: string[];
  capabilities: string[];
  openQuestions: string[];
}

export interface VerifiedResearchSource extends DossierSource {
  text: string;
}

export interface ResearchDossierDependencies {
  sessions: ChatSession[];
  collectResearchPages(homepageUrl: string): Promise<ResearchPage[]>;
  fetchAndVerifySources(urls: string[], homepageUrl: string): Promise<VerifiedResearchSource[]>;
}

export const researchAssignments = () => [
  { key: "product", question: "Purpose, audience, terminology and primary navigation" },
  { key: "workflows", question: "Documented end-to-end user goals and prerequisites" },
  { key: "roles-auth", question: "Roles, permissions, sign-in and onboarding" },
  { key: "pricing-risk", question: "Billing, account mutation and destructive workflows" },
  { key: "changes", question: "Recent release notes and newly documented capabilities" },
] as const;

type ResearchAssignment = ReturnType<typeof researchAssignments>[number];

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  return array(value, label).map((item) => {
    if (typeof item !== "string" || !item.trim()) throw new Error(`${label} must contain non-empty strings`);
    return item.trim();
  });
}

export function buildDossierPrompt(
  input: ResearchDossierInput,
  assignment: ResearchAssignment,
  owned: ResearchPage[],
): string {
  return `Research one bounded aspect of ${input.app} using only cited public sources.
Question: ${assignment.question}
Homepage: ${input.homepageUrl}

Return raw JSON with exactly these fields:
{"sourceCandidates":["https://..."],"claims":[{"text":"...","sourceUrls":["https://..."],"confidence":0.9}],"candidateFlows":[{"id":"...","title":"...","goal":"...","productArea":"...","mode":"read","prerequisites":[],"sourceUrls":["https://..."]}],"roles":[],"capabilities":[],"openQuestions":[]}

Every claim and candidate flow must cite its sourceCandidates. Never include credentials, cookies, tokens, or private data.

Owned research pages:
${buildCorpus(owned)}`;
}

export function parseResearchReport(reply: string): ResearchReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(reply));
  } catch (error) {
    throw new Error(`Research report is invalid: ${(error as Error).message}`);
  }
  const raw = object(parsed, "Research report");
  const allowed = new Set(["sourceCandidates", "claims", "candidateFlows", "roles", "capabilities", "openQuestions"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new Error("Research report contains an unexpected field");
  return {
    sourceCandidates: strings(raw.sourceCandidates, "Research source candidates"),
    claims: array(raw.claims, "Research claims").map((value) => object(value, "Research claim") as unknown as DossierClaim),
    candidateFlows: array(raw.candidateFlows, "Research candidate flows").map((value) => object(value, "Research candidate flow") as unknown as CandidateFlow),
    roles: strings(raw.roles, "Research roles"),
    capabilities: strings(raw.capabilities, "Research capabilities"),
    openQuestions: strings(raw.openQuestions, "Research open questions"),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function mergeResearchReports(
  app: string,
  reports: ResearchReport[],
  fetchedSources: VerifiedResearchSource[],
): AppDossier {
  const sourceByUrl = new Map(fetchedSources.map((source) => [source.url, source]));
  const claims = reports.flatMap(({ claims }) => claims);
  const candidateFlows = [...new Map(
    reports.flatMap(({ candidateFlows }) => candidateFlows).map((flow) => [flow.id, flow]),
  ).values()];
  for (const citations of [
    ...claims.map(({ sourceUrls }) => sourceUrls),
    ...candidateFlows.map(({ sourceUrls }) => sourceUrls),
  ]) {
    if (citations.length === 0 || citations.some((url) => !sourceByUrl.has(url))) {
      throw new Error("Research report citation was not fetched successfully");
    }
  }
  const sources = [...sourceByUrl.values()]
    .sort((left, right) => left.url.localeCompare(right.url))
    .map(({ text: _text, ...source }) => source);
  return parseAppDossier({
    app,
    purpose: claims[0]?.text ?? `Research-backed product dossier for ${app}`,
    sources,
    claims,
    roles: unique(reports.flatMap(({ roles }) => roles)),
    capabilities: unique(reports.flatMap(({ capabilities }) => capabilities)),
    candidateFlows,
    openQuestions: unique(reports.flatMap(({ openQuestions }) => openQuestions)),
  });
}

export async function researchDossier(
  input: ResearchDossierInput,
  dependencies: ResearchDossierDependencies,
): Promise<AppDossier> {
  const assignments = researchAssignments();
  if (dependencies.sessions.length < assignments.length) throw new Error("Five research sessions are required");
  const owned = await dependencies.collectResearchPages(input.homepageUrl);
  const reports = await Promise.all(assignments.map((assignment, index) =>
    dependencies.sessions[index].ask(buildDossierPrompt(input, assignment, owned)).then(parseResearchReport)
  ));
  const sourceCandidates = unique(reports.flatMap(({ sourceCandidates }) => sourceCandidates));
  const sources = await dependencies.fetchAndVerifySources(sourceCandidates, input.homepageUrl);
  return mergeResearchReports(input.app, reports, sources);
}
