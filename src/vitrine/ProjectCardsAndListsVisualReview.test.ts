import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const story = readFileSync(
  new URL(
    "../stories/Projects/ProjectCardsAndLists.stories.tsx",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL("../stories/Projects/ProjectCardsAndLists.css", import.meta.url),
  "utf8",
);

test("publishes the real Projects card as the second component review", () => {
  assert.match(story, /Projects\/Component system\/02 Project Cards and Lists/);
  assert.match(story, /ProjectCard/);
  assert.match(story, /projectsWorkspace\.css/);
  assert.match(story, /Visual review · Approved/);
  assert.match(story, /title="Production project grid"/);
  assert.match(story, /title="Ownership and access"/);
  assert.match(story, /title="Card actions"/);
  assert.match(story, /title="Responsive contract"/);
});

test("reviews production permissions and actions without mock card markup", () => {
  assert.match(story, /role: "owner"/);
  assert.match(story, /role: "editor"/);
  assert.match(story, /role: "viewer"/);
  assert.match(story, /<ProjectCard/);
  assert.doesNotMatch(story, /className="mock-project-card"/);
});

test("documents the production card responsive thresholds", () => {
  assert.match(story, /Desktop · 981\+/);
  assert.match(story, /Tablet · 701–980/);
  assert.match(story, /Mobile · 700 and below/);
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
});
