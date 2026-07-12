import { test } from "node:test";
import assert from "node:assert/strict";
import type { CrawledImage } from "./db.ts";
import type { DesignFlow, DesignSystemSnapshot } from "./designSystem.ts";
import { buildComparison, searchCatalog } from "./catalogResearch.ts";

const images: CrawledImage[] = [
  {
    id: 1,
    app: "linear",
    platform: "web",
    image_url: "linear-login.webp",
    description: "Dark login form",
    analysis: {
      description: "Dark login form",
      purpose: "Sign in",
      pageType: "Login",
      productArea: "Authentication",
      theme: "dark",
      visibleStates: ["default", "disabled"],
      componentNames: ["Text input", "Primary button"],
    },
  },
  {
    id: 2,
    app: "airbnb",
    platform: "web",
    image_url: "airbnb-search.webp",
    description: "Destination search",
    analysis: {
      description: "Destination search",
      purpose: "Find a stay",
      pageType: "Search",
      productArea: "Discovery",
      theme: "light",
      visibleStates: ["expanded"],
      componentNames: ["Search input"],
    },
  },
];

const systems: DesignSystemSnapshot[] = [
  {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color-accent", kind: "color", name: "Accent", value: "#5E6AD2", role: "Primary action", evidence: [1] }],
    components: [{
      id: "button",
      name: "Button",
      category: "Actions",
      description: "Triggers an action",
      variants: [{ id: "primary", name: "Primary", description: "Filled action", evidence: [1] }],
    }],
    flows: [],
  },
  {
    app: "airbnb",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color-accent", kind: "color", name: "Accent", value: "#FF385C", role: "Primary action", evidence: [2] }],
    components: [{
      id: "search-input",
      name: "Search input",
      category: "Inputs",
      description: "Selects a destination",
      variants: [{ id: "expanded", name: "Expanded", description: "Expanded search", evidence: [2] }],
    }],
    flows: [],
  },
];

const flows: Array<{ app: string; flows: DesignFlow[] }> = [{
  app: "linear",
  flows: [{
    id: "sign-in",
    title: "Sign in",
    description: "Authenticate with email",
    tags: ["Authentication"],
    steps: [{ label: "Enter credentials", evidence: [1] }],
  }],
}];

test("searches every observed catalog entity and returns evidence-backed facets", () => {
  const result = searchCatalog({ images, systems, flows }, { query: "primary", kind: "all" });
  assert.ok(result.items.some(({ id }) => id === "component:linear:button"));
  assert.deepEqual(result.items.find(({ id }) => id === "token:linear:color-accent")?.evidenceIds, [1]);
  assert.ok(result.facets.kinds.component >= 1);
  assert.ok(result.facets.themes.includes("dark"));

  const filtered = searchCatalog(
    { images, systems, flows },
    { query: "", kind: "screen", theme: "dark", pageType: "Login", state: "disabled" },
  );
  assert.deepEqual(filtered.items.map(({ id }) => id), ["screen:1"]);
});

test("matches natural phrases across screen purpose and curator-authored flows", () => {
  assert.equal(searchCatalog({ images, systems, flows }, { query: "sign in dark", kind: "all" }).items[0].id, "screen:1");
  assert.equal(searchCatalog({ images, systems, flows }, { query: "authenticate email", kind: "flow" }).items[0].id, "flow:linear:sign-in");
});

test("builds an aligned 2-5 app comparison from observed snapshots and flows", () => {
  const comparison = buildComparison(systems, flows);
  assert.deepEqual(comparison.apps, ["linear", "airbnb"]);
  assert.deepEqual(comparison.foundations.find(({ label }) => label === "Accent")?.values, ["#5E6AD2", "#FF385C"]);
  assert.deepEqual(comparison.components.find(({ label }) => label === "Button")?.values, ["Primary", null]);
  assert.deepEqual(comparison.flows.find(({ label }) => label === "Sign in")?.values, ["1 step", null]);
  assert.throws(() => buildComparison([systems[0]], flows), /2 to 5/);
});
