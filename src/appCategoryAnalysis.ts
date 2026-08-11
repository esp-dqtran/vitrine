import { query, withTransaction } from "./db.ts";
import {
  extractKiroCliJson,
  runKiroCli,
  type KiroCliRunner,
} from "./kiroCliFeatureDocumentProvider.ts";

export interface AppCategoryOption extends Record<string, unknown> {
  id: number;
  name: string;
  slug: string;
}

export interface AppCategoryAnalysis {
  categories: AppCategoryOption[];
  rationale: string;
  provider: string;
}

export interface AnalyzeAppCategoryInput {
  appId: number;
  app: string;
  displayName: string;
  websiteUrl: string;
  description: string;
  researchText: string[];
}

export interface AppCategoryAnalysisDependencies {
  listCategories(): Promise<AppCategoryOption[]>;
  runModel(prompt: string): Promise<{ output: string; provider: string }>;
  replaceCategories(appId: number, categoryIds: number[]): Promise<void>;
}

function modelConfig(environment: NodeJS.ProcessEnv = process.env): {
  binary: string;
  model: string;
  effort: string;
  provider: string;
} {
  const model = environment.APP_CATEGORY_AI_MODEL?.trim() || "gpt-5.6-terra";
  const effort = environment.APP_CATEGORY_AI_EFFORT?.trim().toLowerCase() || "low";
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(model)) throw new Error("Invalid App category AI model");
  if (!/^(low|medium|high|xhigh|max)$/i.test(effort)) throw new Error("Invalid App category AI effort");
  return {
    binary: environment.KIRO_CLI_BIN?.trim() || "kiro-cli",
    model,
    effort,
    provider: `kiro-cli:${model}`,
  };
}

export function buildAppCategoryPrompt(
  input: Omit<AnalyzeAppCategoryInput, "appId">,
  categories: AppCategoryOption[],
): string {
  return [
    "Classify one software product using only the supplied official-website evidence.",
    "Choose one primary category and at most two genuinely independent secondary categories from the allowed list.",
    "Do not create categories. Do not use tools, browse, or infer unsupported business areas.",
    "Return raw JSON only with this shape: {\"categorySlugs\":[string],\"rationale\":string}.",
    `Allowed categories: ${JSON.stringify(categories.map(({ name, slug }) => ({ name, slug })))}`,
    `Product evidence: ${JSON.stringify({
      app: input.app,
      displayName: input.displayName,
      websiteUrl: input.websiteUrl,
      description: input.description,
      officialWebsiteText: input.researchText.slice(0, 8),
    })}`,
  ].join("\n");
}

export function parseAppCategoryAnalysis(
  value: unknown,
  categories: AppCategoryOption[],
): { categories: AppCategoryOption[]; rationale: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("App category AI output must be an object");
  }
  const record = value as Record<string, unknown>;
  const slugs = Array.isArray(record.categorySlugs) ? record.categorySlugs : [];
  const rationale = typeof record.rationale === "string" ? record.rationale.trim() : "";
  if (slugs.length < 1 || slugs.length > 3 || slugs.some((slug) => typeof slug !== "string")) {
    throw new Error("App category AI must choose one to three categories");
  }
  if (!rationale || rationale.length > 500) throw new Error("App category AI rationale is invalid");
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const selected = [...new Set(slugs as string[])].map((slug) => bySlug.get(slug));
  if (selected.length !== slugs.length || selected.some((category) => !category)) {
    throw new Error("App category AI selected an unknown or duplicate category");
  }
  return { categories: selected as AppCategoryOption[], rationale };
}

async function runCategoryModel(
  prompt: string,
  environment: NodeJS.ProcessEnv = process.env,
  runner: KiroCliRunner = runKiroCli,
): Promise<{ output: string; provider: string }> {
  const config = modelConfig(environment);
  const signal = AbortSignal.timeout(120_000);
  const output = await runner({
    binary: config.binary,
    args: [
      "chat",
      "--model", config.model,
      "--effort", config.effort,
      "--no-interactive",
      "--wrap", "never",
      prompt,
    ],
    cwd: process.cwd(),
    signal,
    maxOutputBytes: 100_000,
    label: "App category AI",
  });
  return { output, provider: config.provider };
}

const defaults: AppCategoryAnalysisDependencies = {
  listCategories: async () => (await query<AppCategoryOption>(
    "SELECT id, name, slug FROM categories ORDER BY lower(name), id",
  )).rows,
  runModel: runCategoryModel,
  replaceCategories: async (appId, categoryIds) => withTransaction(async (client) => {
    await client.query("SELECT id FROM apps WHERE id = $1 FOR UPDATE", [appId]);
    await client.query("DELETE FROM app_categories WHERE app_id = $1", [appId]);
    await client.query(
      `INSERT INTO app_categories (app_id, category_id)
       SELECT $1, unnest($2::integer[])
       ON CONFLICT (app_id, category_id) DO NOTHING`,
      [appId, categoryIds],
    );
  }),
};

export async function analyzeAppCategories(
  input: AnalyzeAppCategoryInput,
  overrides: Partial<AppCategoryAnalysisDependencies> = {},
): Promise<AppCategoryAnalysis> {
  const dependencies = { ...defaults, ...overrides };
  const categories = await dependencies.listCategories();
  if (!categories.length) throw new Error("No App categories are configured");
  const prompt = buildAppCategoryPrompt(input, categories);
  const generated = await dependencies.runModel(prompt);
  const parsedJson = extractKiroCliJson(
    generated.output,
    (candidate) => {
      try {
        parseAppCategoryAnalysis(candidate, categories);
        return true;
      } catch {
        return false;
      }
    },
    "App category AI",
  );
  const parsed = parseAppCategoryAnalysis(parsedJson, categories);
  await dependencies.replaceCategories(input.appId, parsed.categories.map(({ id }) => id));
  return { ...parsed, provider: generated.provider };
}
