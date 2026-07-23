import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublishedSearchSource } from "./searchProjection.ts";
import { projectSearchDocuments } from "./searchProjection.ts";

const sourceFixture: PublishedSearchSource = {
  version: {
    id: 9,
    appId: 4,
    app: "Linear",
    platform: "web",
    category: "Productivity",
    publishedAt: "2026-07-23T08:00:00.000Z",
  },
  images: [
    {
      id: 101,
      app: "Linear",
      platform: "web",
      image_url: "https://cdn.test/screen.png",
      kind: "screen",
      description: "A sign-in screen",
      captured_at: "2026-07-22T08:00:00.000Z",
      analysis: {
        description: "A compact authentication screen",
        purpose: "Sign in",
        pageType: "Authentication",
        productArea: "Account access",
        theme: "dark",
        visibleStates: ["default"],
        componentNames: ["Button", "Text field"],
        visibleText: ["Continue with email"],
        layoutPatterns: ["Sidebar"],
      },
    },
    {
      id: 102,
      app: "Linear",
      platform: "web",
      image_url: "https://cdn.test/button.png",
      kind: "ui_element",
      description: "Primary action button",
      analysis: {
        description: "A prominent submit control",
        purpose: "Continue",
        pageType: "Authentication",
        productArea: "Account access",
        theme: "dark",
        visibleStates: ["default"],
        componentNames: ["Button"],
        visibleText: ["Continue"],
        layoutPatterns: [],
      },
    },
  ],
  system: {
    app: "Linear",
    generatedAt: "2026-07-23T08:00:00.000Z",
    tokens: [],
    components: [{
      id: "button",
      name: "Button",
      category: "Actions",
      description: "Triggers a primary action",
      variants: [],
    }],
    flows: [],
  },
  flows: [{
    id: "sign-in",
    title: "Sign in",
    description: "Authenticate with an email address",
    tags: ["authentication"],
    steps: [
      { label: "Open sign in", evidence: [101] },
      { label: "Continue", interaction: "Click the primary button", evidence: [102] },
    ],
  }],
};

test("projects every v1 entity type with stable source identity", () => {
  const documents = projectSearchDocuments(sourceFixture);
  assert.deepEqual(
    documents.map(({ entityType, sourceId }) => [entityType, sourceId]),
    [
      ["app", "app:linear:web"],
      ["screen", "screen:101"],
      ["component", "ui-element:102"],
      ["component", "design-component:linear:web:button"],
      ["pattern", "pattern:linear:web:sidebar"],
      ["flow", "flow:linear:web:sign-in"],
    ],
  );
});

test("keeps visible text searchable without exposing it as generated interpretation", () => {
  const screen = projectSearchDocuments(sourceFixture)
    .find(({ entityType }) => entityType === "screen")!;
  assert.match(screen.searchText, /Continue with email/);
  assert.equal(screen.sourcePayload.visibleTextCount, 1);
});

test("does not emit design tokens as search documents", () => {
  const source = structuredClone(sourceFixture);
  source.system!.tokens.push({
    id: "color-blue",
    kind: "color",
    name: "Blue",
    value: "#00f",
    role: "Brand blue",
    evidence: [101],
    confidence: 1,
  });
  assert.equal(
    projectSearchDocuments(source).some(({ sourceId }) => sourceId.includes("color-blue")),
    false,
  );
});
