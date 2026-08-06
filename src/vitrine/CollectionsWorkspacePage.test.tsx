import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResearchCollection } from "../db.ts";
import { CollectionsWorkspacePage } from "./components/CollectionsWorkspacePage.tsx";

const collection: ResearchCollection = {
  id: 7,
  name: "Checkout research",
  description: "Patterns for a clearer checkout.",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-03T00:00:00.000Z",
  items: [
    {
      id: 11,
      kind: "screen",
      app: "linear",
      reference_id: "101",
      title: "Checkout overview",
      notes: "",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: 12,
      kind: "flow",
      app: "linear",
      reference_id: "checkout",
      title: "Checkout flow",
      notes: "",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  ],
};

const sharedProps = {
  collections: [collection],
  loaded: true,
  plan: "pro" as const,
  onLoad: async () => [collection],
  onChange: () => undefined,
  onUpgrade: () => undefined,
};

test("summarizes saved evidence in the Collections content panel", () => {
  const html = renderToStaticMarkup(<CollectionsWorkspacePage {...sharedProps} />);
  // The rail is published to the hoisted shell (an effect), so a static render
  // of the page contains content only — rail markup is covered by the shell tests.
  assert.doesNotMatch(html, /projects-workspace__desktop-rail/);
  assert.match(html, />Collections</);
  assert.match(html, /Checkout research/);
  assert.match(html, /1 screen · 1 flow/);
});

test("shows a collection detail with Screen and Flow filters", () => {
  const html = renderToStaticMarkup(
    <CollectionsWorkspacePage {...sharedProps} collectionId={7} />,
  );
  assert.match(html, /Back to Collections/);
  assert.match(html, /Collection items/);
  assert.match(html, />Screens/);
  assert.match(html, />Flows/);
  assert.match(html, /Checkout overview/);
  assert.match(html, /Checkout flow/);
});
