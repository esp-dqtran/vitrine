import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const story = readFileSync(
  "src/stories/Patterns/SaveToProjectAndHandoff.stories.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/stories/Patterns/SaveToProjectAndHandoff.css",
  "utf8",
);

test("save to project review uses the production modal and Vitrines controls", () => {
  assert.match(story, /AstryxModal/);
  assert.match(story, /AstryxModalSurface/);
  assert.match(story, /Save to project/);
  assert.match(story, /Create and save/);
  assert.match(story, /View project/);
  assert.match(story, /ScreenGridCard/);
  assert.match(story, /onSave=\{onSave\}/);
  assert.doesNotMatch(story, /save-review__evidence-footer/);
});

test("save to project review documents duplicate, error, and responsive states", () => {
  assert.match(story, /Already saved/);
  assert.match(story, /Save failed/);
  assert.match(story, /Try again/);
  assert.match(styles, /@media \(max-width: 800px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
