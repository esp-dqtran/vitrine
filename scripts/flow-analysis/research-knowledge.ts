import { readFile } from "node:fs/promises";

export type ResearchPlatform = "all" | "ios" | "android" | "web";
export type ResearchClaimKind =
  | "documented-capability"
  | "domain-reference"
  | "constraint"
  | "policy";

export interface AppResearchSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  sourceType: "official-help" | "official-developer" | "app-store";
  scopeNote: string;
}

export interface AppResearchClaim {
  id: string;
  sourceIds: string[];
  kind: ResearchClaimKind;
  text: string;
  topics: string[];
  platforms: ResearchPlatform[];
  regions: string[];
  scopeNote: string;
  alwaysInclude?: boolean;
}

export interface AppResearchKnowledge {
  schemaVersion: 1;
  app: string;
  generatedAt: string;
  separationPolicy: {
    visualEvidenceAuthority: string;
    documentedContextAuthority: string;
    conflictPolicy: string;
  };
  sources: AppResearchSource[];
  claims: AppResearchClaim[];
}

export interface FlowResearchContext {
  app: string;
  knowledgeGeneratedAt: string;
  policy: AppResearchKnowledge["separationPolicy"];
  claims: Array<AppResearchClaim & {
    sources: Array<Pick<AppResearchSource, "id" | "title" | "url" | "scopeNote">>;
    relevanceScore: number;
  }>;
}

type FlowContextInput = {
  platform: Exclude<ResearchPlatform, "all">;
  title: string;
  category?: string;
  tags?: string[];
  unknowns?: string[];
};

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${label}`);
  return value.trim();
};

const texts = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid ${label}`);
  }
  const result = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  if (!result.length) throw new Error(`Invalid ${label}`);
  return result;
};

const timestamp = (value: unknown, label: string): string => {
  const parsed = text(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`Invalid ${label}`);
  return parsed;
};

const identifier = (value: unknown, label: string): string => {
  const parsed = text(value, label);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed)) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
};

const sourceType = (value: unknown): AppResearchSource["sourceType"] => {
  if (!["official-help", "official-developer", "app-store"].includes(String(value))) {
    throw new Error("Invalid research source type");
  }
  return value as AppResearchSource["sourceType"];
};

const claimKind = (value: unknown): ResearchClaimKind => {
  if (!["documented-capability", "domain-reference", "constraint", "policy"].includes(String(value))) {
    throw new Error("Invalid research claim kind");
  }
  return value as ResearchClaimKind;
};

const platforms = (value: unknown): ResearchPlatform[] => {
  const values = texts(value, "research claim platforms");
  if (values.some((item) => !["all", "ios", "android", "web"].includes(item))) {
    throw new Error("Invalid research claim platform");
  }
  return values as ResearchPlatform[];
};

export function parseAppResearchKnowledge(value: unknown): AppResearchKnowledge {
  const root = record(value, "research knowledge");
  if (root.schemaVersion !== 1) throw new Error("Unsupported research knowledge schema");
  const sourceValues = root.sources;
  const claimValues = root.claims;
  if (!Array.isArray(sourceValues) || !Array.isArray(claimValues)) {
    throw new Error("Research knowledge requires sources and claims");
  }
  const sourceIds = new Set<string>();
  const sources = sourceValues.map((value, index): AppResearchSource => {
    const item = record(value, `research source ${index + 1}`);
    const id = identifier(item.id, `research source ${index + 1} ID`);
    if (sourceIds.has(id)) throw new Error(`Duplicate research source ${id}`);
    sourceIds.add(id);
    const url = text(item.url, `research source ${id} URL`);
    if (!url.startsWith("https://")) throw new Error(`Research source ${id} must use HTTPS`);
    return {
      id,
      title: text(item.title, `research source ${id} title`),
      url,
      publisher: text(item.publisher, `research source ${id} publisher`),
      retrievedAt: timestamp(item.retrievedAt, `research source ${id} retrieval time`),
      sourceType: sourceType(item.sourceType),
      scopeNote: text(item.scopeNote, `research source ${id} scope note`),
    };
  });
  const claimIds = new Set<string>();
  const claims = claimValues.map((value, index): AppResearchClaim => {
    const item = record(value, `research claim ${index + 1}`);
    const id = identifier(item.id, `research claim ${index + 1} ID`);
    if (claimIds.has(id)) throw new Error(`Duplicate research claim ${id}`);
    claimIds.add(id);
    const claimSourceIds = texts(item.sourceIds, `research claim ${id} sources`);
    const unknownSource = claimSourceIds.find((sourceId) => !sourceIds.has(sourceId));
    if (unknownSource) throw new Error(`Research claim ${id} cites unknown source ${unknownSource}`);
    return {
      id,
      sourceIds: claimSourceIds,
      kind: claimKind(item.kind),
      text: text(item.text, `research claim ${id} text`),
      topics: texts(item.topics, `research claim ${id} topics`).map((topic) =>
        topic.toLowerCase()
      ),
      platforms: platforms(item.platforms),
      regions: texts(item.regions, `research claim ${id} regions`),
      scopeNote: text(item.scopeNote, `research claim ${id} scope note`),
      ...(item.alwaysInclude === true ? { alwaysInclude: true } : {}),
    };
  });
  const policy = record(root.separationPolicy, "research separation policy");
  return {
    schemaVersion: 1,
    app: identifier(root.app, "research app"),
    generatedAt: timestamp(root.generatedAt, "research generation time"),
    separationPolicy: {
      visualEvidenceAuthority: text(
        policy.visualEvidenceAuthority,
        "visual evidence authority",
      ),
      documentedContextAuthority: text(
        policy.documentedContextAuthority,
        "documented context authority",
      ),
      conflictPolicy: text(policy.conflictPolicy, "research conflict policy"),
    },
    sources,
    claims,
  };
}

export async function loadAppResearchKnowledge(
  path: string,
): Promise<AppResearchKnowledge | undefined> {
  try {
    return parseAppResearchKnowledge(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function tokens(values: Array<string | undefined>): Set<string> {
  return new Set(
    values.flatMap((value) => (value ?? "").toLowerCase().split(/[^a-z0-9]+/))
      .filter((value) => value.length > 1 && !STOP_WORDS.has(value)),
  );
}

function relevanceScore(claim: AppResearchClaim, input: FlowContextInput): number {
  if (!claim.platforms.includes("all") && !claim.platforms.includes(input.platform)) {
    return 0;
  }
  const flowTokens = tokens([
    input.title,
    input.category,
    ...(input.tags ?? []),
    ...(input.unknowns ?? []),
  ]);
  const topicTokens = tokens(claim.topics);
  const claimTokens = tokens([claim.text]);
  const topicMatches = [...topicTokens].filter((token) => flowTokens.has(token)).length;
  const textMatches = [...claimTokens].filter((token) => flowTokens.has(token)).length;
  return (claim.alwaysInclude ? 2 : 0)
    + (claim.platforms.includes(input.platform) ? 2 : 1)
    + topicMatches * 4
    + Math.min(textMatches, 4);
}

export function researchContextForFlow(
  knowledge: AppResearchKnowledge | undefined,
  input: FlowContextInput,
  limit = 8,
): FlowResearchContext | undefined {
  if (!knowledge) return undefined;
  const sources = new Map(knowledge.sources.map((source) => [source.id, source]));
  const claims = knowledge.claims
    .map((claim) => ({ claim, relevanceScore: relevanceScore(claim, input) }))
    .filter(({ relevanceScore }) => relevanceScore >= 3)
    .sort((left, right) =>
      right.relevanceScore - left.relevanceScore ||
      left.claim.id.localeCompare(right.claim.id)
    )
    .slice(0, limit)
    .map(({ claim, relevanceScore }) => ({
      ...claim,
      relevanceScore,
      sources: claim.sourceIds.map((sourceId) => {
        const source = sources.get(sourceId)!;
        return {
          id: source.id,
          title: source.title,
          url: source.url,
          scopeNote: source.scopeNote,
        };
      }),
    }));
  if (!claims.length) return undefined;
  return {
    app: knowledge.app,
    knowledgeGeneratedAt: knowledge.generatedAt,
    policy: knowledge.separationPolicy,
    claims,
  };
}

export function researchPromptBlock(context: FlowResearchContext | undefined): string {
  if (!context) return "";
  return [
    "External documented context (not screenshot evidence):",
    "The following claims may clarify terminology or expose questions. Never describe them as visually observed, never assign screenshot evidence IDs to them, and never let them override the attached screenshots.",
    `Visual evidence authority: ${context.policy.visualEvidenceAuthority}`,
    `Documented context authority: ${context.policy.documentedContextAuthority}`,
    `Conflict policy: ${context.policy.conflictPolicy}`,
    JSON.stringify(context.claims.map((claim) => ({
      claimId: claim.id,
      kind: claim.kind,
      text: claim.text,
      scopeNote: claim.scopeNote,
      sources: claim.sources.map(({ id, title, url, scopeNote }) => ({
        id,
        title,
        url,
        scopeNote,
      })),
    }))),
  ].join("\n");
}
