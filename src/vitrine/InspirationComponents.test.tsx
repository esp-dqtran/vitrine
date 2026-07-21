import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InspirationPrompts } from "./components/InspirationPrompts.tsx";
import { InspirationResults } from "./components/InspirationResults.tsx";
import { InspirationPreview } from "./components/InspirationPreview.tsx";
import { InspirationComparison } from "./components/InspirationComparison.tsx";

test("renders inspiration prompts as actions", () => {
  const html = renderToStaticMarkup(<InspirationPrompts onSelect={() => undefined} />);
  assert.match(html, /What are you designing/);
  assert.match(html, /Onboarding/);
  assert.match(html, /AI assistant/);
});

test("renders thumbnail-first grouped references", () => {
  const html = renderToStaticMarkup(<InspirationResults
    items={[{ id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [], thumbnailUrl: "/thumb.webp" }]}
    activeId="screen:1"
    onPreview={() => undefined}
  />);
  assert.match(html, /Screens/);
  assert.match(html, /\/thumb\.webp/);
  assert.match(html, /Login/);
  assert.match(html, /linear/);
  assert.match(html, /aria-selected="true"/);
});

test("renders preview context and all three actions", () => {
  const html = renderToStaticMarkup(<InspirationPreview
    item={{ id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [], imageUrl: "/full.webp" }}
    related={[]}
    relatedLoading={false}
    collections={[]}
    plan="pro"
    onCollectionsChange={() => undefined}
    onBack={() => undefined}
    onOpen={() => undefined}
    onCompare={() => undefined}
    onSelectRelated={() => undefined}
  />);
  assert.match(html, /Back to results/);
  assert.match(html, /Open/);
  assert.match(html, /Compare/);
  assert.match(html, /Save to collection/);
  assert.match(html, /\/full\.webp/);
  assert.match(html, /Flow context/);
});

test("renders an aligned catalog comparison", () => {
  const html = renderToStaticMarkup(<InspirationComparison
    comparison={{ apps: ["linear", "airbnb"], foundations: [{ id: "accent", label: "Accent", values: ["#111", "#222"], evidenceIds: [[], []] }], components: [], flows: [] }}
    onBack={() => undefined}
  />);
  assert.match(html, /linear/);
  assert.match(html, /airbnb/);
  assert.match(html, /Accent/);
});
