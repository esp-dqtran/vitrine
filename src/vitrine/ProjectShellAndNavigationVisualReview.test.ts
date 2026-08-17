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
const workspaceStyles = readFileSync(
  new URL("./projectsWorkspace.css", import.meta.url),
  "utf8",
);

test("publishes Projects shell and navigation as a dedicated component-system review", () => {
  assert.match(story, /Projects\/Component system\/01 Shell and Navigation/);
  assert.match(story, /Vitrines · Projects component system/);
  assert.match(story, /Visual review · Awaiting approval/);
  assert.match(story, /title="Product header"/);
  assert.match(story, /title="Workspace navigation"/);
  assert.match(story, /title="Responsive contract"/);
  assert.match(story, /export const VisualReview/);
});

test("reuses production Projects shell controls", () => {
  assert.match(story, /WorkspaceHeader/);
  assert.match(story, /WorkspaceRail/);
  assert.match(story, /onBrandSelect=\{\(\) => undefined\}/);
  assert.match(story, /projects-team-drawer__header/);
  assert.match(story, /projects-team-switcher__check/);
  assert.match(story, /projectsWorkspace\.css/);
});

test("omits the retired project navigation controls", () => {
  assert.doesNotMatch(story, /title="Search and menus"/);
  assert.doesNotMatch(story, /NavigationControlsSpecimen/);
  assert.doesNotMatch(story, /DiscoverySortDropdown/);
});

test("documents the actual Projects responsive thresholds", () => {
  assert.match(story, /Desktop · 981\+/);
  assert.match(story, /Tablet · 701–980/);
  assert.match(story, /Mobile · 700 and below/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(
    styles,
    /@media \(max-width: 700px\)[\s\S]*project-shell-review__rail-frame[\s\S]*flex-direction: row/,
  );
});

test("keeps the sidebar vertical on tablets and preserves compact hit targets", () => {
  const compactRailStyles = workspaceStyles.slice(
    workspaceStyles.indexOf(" * Compact layout for every rail surface."),
  );

  assert.match(compactRailStyles, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(compactRailStyles, /@media \(max-width: 900px\)/);
  assert.match(workspaceStyles, /@media \(min-width: 701px\)/);
  assert.match(
    workspaceStyles,
    /\.projects-workspace__desktop-row-link,[\s\S]*?\.projects-workspace \.projects-workspace__desktop-settings\s*\{[^}]*width:\s*48px(?:\s*!important)?;[^}]*min-height:\s*48px(?:\s*!important)?;/,
  );
  assert.match(
    workspaceStyles,
    /@media \(min-width:\s*701px\)[\s\S]*?\.projects-workspace\s*\{[^}]*padding:\s*var\(--projects-panel-inset\)[^}]*var\(--projects-rail-width\);/s,
  );
  assert.match(
    workspaceStyles,
    /@media \(max-width:\s*700px\)[\s\S]*?\.projects-workspace__desktop-footer\s*\{[^}]*width:\s*auto !important;/s,
  );
  assert.match(
    workspaceStyles,
    /@media \(max-width:\s*700px\)[\s\S]*?\.projects-workspace__desktop-nav\s*\{[^}]*width:\s*auto !important;/s,
  );
});

test("keeps the workspace menu create action visually separated only once", () => {
  assert.doesNotMatch(
    workspaceStyles,
    /\.projects-team-switcher__create\s*\{[^}]*border-top/,
  );
});
