import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeAppCategories,
  buildAppCategoryPrompt,
  parseAppCategoryAnalysis,
  type AppCategoryOption,
} from "./appCategoryAnalysis.ts";

const categories: AppCategoryOption[] = [
  { id: 1, name: "AI", slug: "ai" },
  { id: 7, name: "Developer Tools", slug: "developer-tools" },
  { id: 21, name: "Productivity", slug: "productivity" },
];

test("builds an evidence-bounded category prompt using only allowed categories", () => {
  const prompt = buildAppCategoryPrompt({
    app: "kilo",
    displayName: "Kilo",
    websiteUrl: "https://kilo.ai/",
    description: "An open-source AI coding agent.",
    researchText: ["Code with AI"],
  }, categories);
  assert.match(prompt, /official-website evidence/);
  assert.match(prompt, /developer-tools/);
  assert.match(prompt, /open-source AI coding agent/);
  assert.match(prompt, /Do not create categories/);
});

test("accepts existing category slugs and rejects unknown or duplicate categories", () => {
  assert.deepEqual(parseAppCategoryAnalysis({
    categorySlugs: ["developer-tools", "ai"],
    rationale: "The product is an AI coding agent for software developers.",
  }, categories).categories.map(({ slug }) => slug), ["developer-tools", "ai"]);
  assert.throws(
    () => parseAppCategoryAnalysis({ categorySlugs: ["other"], rationale: "Unsupported." }, categories),
    /unknown/i,
  );
  assert.throws(
    () => parseAppCategoryAnalysis({ categorySlugs: ["ai", "ai"], rationale: "Duplicate." }, categories),
    /duplicate/i,
  );
});

test("persists the validated AI category selection", async () => {
  let assigned: { appId: number; categoryIds: number[] } | undefined;
  const result = await analyzeAppCategories({
    appId: 42,
    app: "kilo",
    displayName: "Kilo",
    websiteUrl: "https://kilo.ai/",
    description: "An open-source AI coding agent.",
    researchText: ["Code with AI"],
  }, {
    listCategories: async () => categories,
    runModel: async () => ({
      output: 'analysis\n{"categorySlugs":["developer-tools","ai"],"rationale":"AI coding agent for developers."}',
      provider: "test-model",
    }),
    replaceCategories: async (appId, categoryIds) => { assigned = { appId, categoryIds }; },
  });
  assert.deepEqual(assigned, { appId: 42, categoryIds: [7, 1] });
  assert.deepEqual(result.categories.map(({ slug }) => slug), ["developer-tools", "ai"]);
  assert.equal(result.provider, "test-model");
});
