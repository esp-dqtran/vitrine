import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const story = readFileSync(
  new URL("../stories/ProjectsPage.stories.tsx", import.meta.url),
  "utf8",
);

test("publishes the Projects list as a production-grounded page review", () => {
  assert.match(story, /ResearchProjectsView/);
  assert.match(story, /Page 01 · Projects list/);
  assert.match(story, /VisualReview/);
  assert.match(story, /Empty/);
  assert.match(story, /Loading/);
  assert.match(story, /Error/);
  assert.match(story, /productTypography\.css/);
  assert.match(story, /productSpacing\.css/);
  assert.match(story, /productShape\.css/);
  assert.match(story, /productIconography\.css/);
  assert.match(story, /productMotion\.css/);
  assert.match(story, /productResponsive\.css/);
});
