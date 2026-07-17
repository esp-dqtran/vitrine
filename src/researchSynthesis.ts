import type {
  CitedResearchText,
  ResearchProjectWorkspace,
  ResearchSynthesisResult,
} from "./researchProject.ts";

export interface ResearchSynthesisPrompt {
  question: string;
  constraints: string;
  lanes: Array<{ title: string; conclusion: string; evidenceIds: string[] }>;
  evidence: Array<{
    id: string;
    lane: string;
    source: ResearchProjectWorkspace["lanes"][number]["items"][number]["snapshot"];
    stepLabel: string;
    note: string;
    tags: string[];
    important: boolean;
  }>;
  validationError?: string;
}

export interface ResearchSynthesisProvider {
  readonly model: string;
  generate(input: ResearchSynthesisPrompt, signal: AbortSignal): Promise<unknown>;
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid synthesis object");
  return value as Record<string, unknown>;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid synthesis ${label}`);
  return value.trim();
};

const strings = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid synthesis ${label}`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
};

function cited(value: unknown, allowed: Set<string>, label: string): CitedResearchText {
  const item = record(value);
  const evidenceIds = strings(item.evidenceIds, `${label} citations`);
  if (!evidenceIds.length) throw new Error(`${label} requires an evidence citation`);
  const unknown = evidenceIds.find((id) => !allowed.has(id));
  if (unknown) throw new Error(`${label} cites unknown evidence: ${unknown}`);
  return { text: string(item.text, label), evidenceIds: [...new Set(evidenceIds)] };
}

const citedList = (value: unknown, allowed: Set<string>, label: string): CitedResearchText[] => {
  if (!Array.isArray(value)) throw new Error(`Invalid synthesis ${label}`);
  return value.map((item, index) => cited(item, allowed, `${label} ${index + 1}`));
};

export function validateSynthesisResult(value: unknown, allowed: Set<string>): ResearchSynthesisResult {
  const result = record(value);
  if (!Array.isArray(result.alternatives)) throw new Error("Invalid synthesis alternatives");
  const alternatives = result.alternatives.map((value, index) => {
    const alternative = record(value);
    const evidenceIds = strings(alternative.evidenceIds, `alternative ${index + 1} citations`);
    if (!evidenceIds.length) throw new Error(`Alternative ${index + 1} requires an evidence citation`);
    const unknown = evidenceIds.find((id) => !allowed.has(id));
    if (unknown) throw new Error(`Alternative ${index + 1} cites unknown evidence: ${unknown}`);
    return {
      title: string(alternative.title, `alternative ${index + 1} title`),
      tradeoff: string(alternative.tradeoff, `alternative ${index + 1} tradeoff`),
      evidenceIds: [...new Set(evidenceIds)],
    };
  });
  return {
    executiveRead: string(result.executiveRead, "executive read"),
    observations: citedList(result.observations, allowed, "observation"),
    differences: citedList(result.differences, allowed, "difference"),
    alternatives,
    recommendation: cited(result.recommendation, allowed, "recommendation"),
    requirements: citedList(result.requirements, allowed, "requirement"),
    openQuestions: strings(result.openQuestions, "open questions"),
  };
}

export function buildResearchSynthesisPrompt(workspace: ResearchProjectWorkspace): ResearchSynthesisPrompt {
  const evidence = workspace.lanes.flatMap((lane) => lane.items.map((item) => ({
    id: `e${item.id}`,
    lane: lane.title,
    source: item.snapshot,
    stepLabel: item.stepLabel,
    note: item.note,
    tags: item.tags,
    important: item.important,
  })));
  return {
    question: workspace.question,
    constraints: workspace.constraints,
    lanes: workspace.lanes.map((lane) => ({
      title: lane.title,
      conclusion: lane.conclusion,
      evidenceIds: lane.items.map((item) => `e${item.id}`),
    })),
    evidence,
  };
}

export async function synthesizeResearchProject(
  workspace: ResearchProjectWorkspace,
  provider: ResearchSynthesisProvider,
  timeoutMs = 60_000,
): Promise<ResearchSynthesisResult> {
  const prompt = buildResearchSynthesisPrompt(workspace);
  const allowed = new Set(prompt.evidence.map(({ id }) => id));
  let validationError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await provider.generate({ ...prompt, validationError }, AbortSignal.timeout(timeoutMs));
    try {
      return validateSynthesisResult(raw, allowed);
    } catch (error) {
      validationError = error instanceof Error ? error.message : "Invalid synthesis";
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Synthesis failed validation");
}

const heading = (value: string): string => value.replace(/[\r\n#]+/g, " ").trim();
const safeSourcePath = (value: string | undefined): string | undefined => {
  if (!value || !value.startsWith("/")) return undefined;
  return value.split("?", 1)[0];
};
const citedMarkdown = (item: CitedResearchText): string => `${item.text} (${item.evidenceIds.join(", ")})`;

export function renderResearchProjectMarkdown(workspace: ResearchProjectWorkspace): string {
  const lines = [
    `# ${heading(workspace.title)}`,
    "",
    `**Research question:** ${workspace.question}`,
    `**Platform:** ${workspace.platformFilter}`,
  ];
  if (workspace.constraints) lines.push(`**Constraints:** ${workspace.constraints}`);
  lines.push("", "## Compared evidence", "");
  for (const lane of workspace.lanes) {
    lines.push(`### ${heading(lane.title)}`, "");
    if (lane.conclusion) lines.push(`Conclusion: ${lane.conclusion}`, "");
    for (const item of lane.items) {
      const id = `e${item.id}`;
      const source = safeSourcePath(item.snapshot.sourcePath);
      lines.push(`- **${id}: ${item.snapshot.title}**${source ? ` — ${source}` : ""}`);
      if (item.note) lines.push(`  - Note: ${item.note}`);
      if (item.tags.length) lines.push(`  - Tags: ${item.tags.join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## Designer decision", "", workspace.decision || "Not decided.", "");
  if (workspace.rationale) lines.push("### Rationale", "", workspace.rationale, "");
  if (workspace.openQuestions) lines.push("### Open questions", "", workspace.openQuestions, "");

  if (workspace.synthesis && !workspace.synthesis.stale) {
    const result = workspace.synthesis.result;
    lines.push("## AI-generated synthesis", "", result.executiveRead, "", "### Observed evidence", "");
    lines.push(...result.observations.map((item) => `- ${citedMarkdown(item)}`), "", "### Meaningful differences", "");
    lines.push(...result.differences.map((item) => `- ${citedMarkdown(item)}`), "", "### Recommendation", "", citedMarkdown(result.recommendation), "", "### Design requirements", "");
    lines.push(...result.requirements.map((item) => `- ${citedMarkdown(item)}`), "");
  }
  return `${lines.join("\n").trim()}\n`;
}
