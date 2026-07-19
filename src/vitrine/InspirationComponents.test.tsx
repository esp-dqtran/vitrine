import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InspirationPrompts } from "./components/InspirationPrompts.tsx";
import { InspirationResults } from "./components/InspirationResults.tsx";

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
