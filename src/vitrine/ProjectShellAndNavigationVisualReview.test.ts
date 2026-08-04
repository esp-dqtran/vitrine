import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const story = readFileSync(
  new URL(
    "../stories/Projects/ProjectShellAndNavigation.stories.tsx",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL("../stories/Projects/ProjectShellAndNavigation.css", import.meta.url),
  "utf8",
);

test("publishes Projects shell and navigation as a dedicated component-system review", () => {
  assert.match(story, /Projects\/Component system\/01 Shell and Navigation/);
  assert.match(story, /Vitrines · Projects component system/);
  assert.match(story, /Visual review · Awaiting approval/);
  assert.match(story, /title="Product header"/);
  assert.match(story, /title="Workspace navigation"/);
  assert.match(story, /title="Search and menus"/);
  assert.match(story, /title="Responsive contract"/);
  assert.match(story, /export const VisualReview/);
});

test("reuses production Projects navigation controls", () => {
  assert.match(story, /WorkspaceHeader/);
  assert.match(story, /WorkspaceRail/);
  assert.match(story, /DiscoverySortDropdown/);
  assert.match(story, /AstryxDropdown/);
  assert.match(story, /TextInput/);
  assert.match(story, /projectsWorkspace\.css/);
  assert.match(story, /AstryxDropdown\.css/);
});

test("makes project ordering explicit and uses the approved primary action trigger", () => {
  assert.match(story, />Sort by<\/span>/);
  assert.match(story, /label="More actions"/);
  assert.match(story, /triggerVariant="primary"/);
  assert.match(styles, /project-shell-review__sort-control/);
});

test("documents the actual Projects responsive thresholds", () => {
  assert.match(story, /Desktop · 981\+/);
  assert.match(story, /Tablet · 701–980/);
  assert.match(story, /Mobile · 700 and below/);
  assert.match(styles, /@media \(max-width: 700px\)/);
});
