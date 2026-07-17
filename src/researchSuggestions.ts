import type { ResearchPlatform } from "./researchProject.ts";

export interface ResearchSuggestionCandidate {
  id: string;
  kind: "screen" | "flow_step";
  app: string;
  platform: Exclude<ResearchPlatform, "all">;
  title: string;
  description?: string;
  flowTitle?: string;
  appCategory?: string;
  productArea?: string;
  pageType?: string;
  tags: string[];
  states: string[];
  components: string[];
  layouts: string[];
  visibleText: string[];
  capturedAt?: string;
  sourcePath?: string;
  imageId?: number;
  versionId?: number;
  flowId?: string;
  stepIndex?: number;
}

export interface SuggestionOptions {
  platform: ResearchPlatform;
  limit: number;
}

export interface ResearchSuggestion extends ResearchSuggestionCandidate {
  score: number;
  matchedFields: string[];
}

const STOP_WORDS = new Set(["a", "an", "and", "how", "the", "to", "with"]);

function normalizedTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((token) => !STOP_WORDS.has(token));
}

function matchingTokenCount(tokens: string[], value: string | string[] | undefined): number {
  if (!value) return 0;
  const haystack = (Array.isArray(value) ? value.join(" ") : value).toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function scoreCandidate(tokens: string[], candidate: ResearchSuggestionCandidate): ResearchSuggestion {
  const fields: Array<[string, string | string[] | undefined, number]> = [
    ["flow title", candidate.flowTitle, 6],
    ["app category", candidate.appCategory, 5],
    ["title", candidate.title, 5],
    ["page type", candidate.pageType, 4],
    ["product area", candidate.productArea, 4],
    ["description", candidate.description, 3],
    ["tags", candidate.tags, 3],
    ["states", candidate.states, 3],
    ["visible text", candidate.visibleText, 2],
    ["components", candidate.components, 2],
    ["layouts", candidate.layouts, 2],
    ["app", candidate.app, 1],
  ];
  const matchedFields: string[] = [];
  let score = 0;
  for (const [label, value, weight] of fields) {
    const matches = matchingTokenCount(tokens, value);
    if (!matches) continue;
    matchedFields.push(label);
    score += matches * weight;
  }
  return { ...candidate, score, matchedFields };
}

export function rankResearchSuggestions(
  query: string,
  candidates: ResearchSuggestionCandidate[],
  options: SuggestionOptions,
): ResearchSuggestion[] {
  const tokens = normalizedTokens(query);
  if (!tokens.length) return [];
  return candidates
    .filter((candidate) => options.platform === "all" || candidate.platform === options.platform)
    .map((candidate) => scoreCandidate(tokens, candidate))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || Date.parse(right.capturedAt ?? "0") - Date.parse(left.capturedAt ?? "0")
      || left.id.localeCompare(right.id))
    .slice(0, Math.max(0, options.limit));
}
