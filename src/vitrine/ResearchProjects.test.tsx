import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  sortProjects,
  ResearchProjectsView,
} from "./components/ProjectsPage.tsx";
import {
  DecisionCanvas,
  type DecisionCanvasActions,
} from "./components/DecisionCanvas.tsx";
import type { ResearchProjectWorkspace } from "../researchProject.ts";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import {
  ProjectInsightsPanel,
  type ProjectInsightsActions,
} from "./components/ProjectInsightsPanel.tsx";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const actions = {
  open: () => {},
  create: async () => {},
  rename: async () => {},
  setPinned: async () => {},
  duplicate: async () => {},
  remove: async () => {},
};

test("renders a personal projects workspace without project status", () => {
  const empty = renderToStaticMarkup(
    <ResearchProjectsView
      projects={[]}
      loading={false}
      error=""
      actions={actions}
    />,
  );
  assert.match(empty, /Create your first project/);

  const populated = renderToStaticMarkup(
    <ResearchProjectsView
      projects={[
        {
          id: PROJECT_ID,
          title: "SSO onboarding",
          question: "How should SSO be introduced?",
          platformFilter: "web",
          pinned: true,
          revision: 3,
          evidenceCount: 6,
          synthesisState: "stale",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      ]}
      loading={false}
      error=""
      actions={actions}
    />,
  );
  assert.match(populated, /SSO onboarding/);
  assert.match(populated, /Pinned/);
  assert.match(populated, /Rename/);
  assert.match(populated, /data-app-discovery-card="true"/);
  // The sort control is gone; projects stay ordered by last updated.
  assert.doesNotMatch(populated, />Sort by</);
  assert.doesNotMatch(populated, /aria-label="Sort: Last updated"/);
  assert.match(populated, /data-variant="primary"[\s\S]*New project/);
  assert.doesNotMatch(populated, /Filter projects/);
  assert.doesNotMatch(populated, /Synthesis stale|Draft|Active|Paused/);
});

test("organizes Projects around Personal and Team scopes", () => {
  const html = renderToStaticMarkup(
    <ResearchProjectsView
      teams={[
        {
          id: 4,
          name: "Northstar",
          role: "owner",
          memberCount: 3,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ]}
      projects={[
        {
          id: PROJECT_ID,
          title: "Checkout redesign",
          question: "",
          platformFilter: "web",
          pinned: false,
          revision: 1,
          evidenceCount: 0,
          synthesisState: "none",
          updatedAt: "2026-08-01T00:00:00.000Z",
          organization: { id: 4, name: "Northstar", role: "owner" },
        },
      ]}
      loading={false}
      error=""
      actions={actions}
    />,
  );

  // The rail and its switcher are published to the hoisted shell (an effect),
  // so a static page render carries content only.
  assert.doesNotMatch(html, /projects-workspace__desktop-rail/);
  assert.match(html, /Northstar/);
  assert.doesNotMatch(html, /3 members/);
  assert.match(html, /Personal projects/);
  assert.doesNotMatch(html, /Team workspace/);
});

test("defines Lumin-style Team dropdowns, modals, and member management layout", () => {
  const css = readFileSync(
    new URL("./projectsWorkspace.css", import.meta.url),
    "utf8",
  );
  const modalCss = readFileSync(
    new URL("./components/AstryxModal.css", import.meta.url),
    "utf8",
  );
  const source = readFileSync(
    new URL("./components/ProjectsPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.projects-team-drawer\s*\{[^}]*width:\s*calc\(var\(--projects-rail-width, 200px\) - 24px\);[^}]*border-radius:\s*var\(--radius-container\);[^}]*transition:\s*opacity 0\.15s,\s*transform 0\.15s;/s,
  );
  assert.match(
    css,
    /\.projects-team-drawer\s*\{[^}]*top:\s*104px;[^}]*max-height:\s*calc\(100dvh - 120px\);/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*700px\)[\s\S]*?\.projects-team-drawer\s*\{[^}]*width:\s*min\(280px, calc\(100vw - 32px\)\);[^}]*transform:\s*translateX\(-100%\);[^}]*transition:\s*transform 0\.3s;/,
  );
  assert.match(
    modalCss,
    /dialog\.astryx-modal\s*\{[^}]*border-radius:\s*24px\s*!important;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__toolbar \.apps-filterbar__filter\s*\{[^}]*height:\s*40px;[^}]*border-radius:\s*8px;/s,
  );
  assert.match(
    source,
    /projects-workspace__modal projects-workspace__modal--invite[\s\S]*?width=\{640\}/,
  );
  assert.match(
    source,
    /role="menu"\s*aria-label=\{`Actions for \$\{project\.title\}`\}/,
  );
  assert.match(
    css,
    /\.team-people__stats\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s,
  );
  assert.match(
    css,
    /\.team-people__list-heading,[\s\S]*?grid-template-columns:\s*minmax\(220px, 1fr\) 120px 140px 90px;/,
  );
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("renders a responsive Lumin-style Projects header", () => {
  const css = readFileSync(
    new URL("./projectsWorkspace.css", import.meta.url),
    "utf8",
  );
  const html = renderToStaticMarkup(
    <ResearchProjectsView
      projects={[]}
      loading={false}
      error=""
      actions={actions}
    />,
  );

  // No header bar, no project search, and no rail in a static page render —
  // the rail is published to the hoisted shell.
  assert.doesNotMatch(html, /projects-workspace__context-bar/);
  assert.doesNotMatch(html, /aria-label="Search projects"/);
  assert.doesNotMatch(html, /aria-label="Workspace navigation"/);
  assert.doesNotMatch(html, /Vitrines libraries/);
  assert.doesNotMatch(html, /projects-workspace__desktop-destination/);
  assert.match(
    css,
    /\.projects-workspace__desktop-rail\s*\{[^}]*width:\s*var\(--projects-rail-width\);[^}]*position:\s*fixed;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-rail\s*\{[^}]*background:\s*transparent;/s,
  );
  // The page reserves the rail gutter plus the panel inset; a margin on the
  // panel would collapse through the page and offset everything by 8px.
  assert.match(
    css,
    /\.projects-workspace\s*\{[^}]*padding:\s*var\(--projects-panel-inset\)/s,
  );
  assert.match(
    css,
    /\.projects-workspace__shell\s*\{[^}]*border-radius:\s*var\(--radius-container\);[^}]*background:\s*var\(--color-background-surface\);/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-divider\s*\{[^}]*width:\s*24px;[^}]*height:\s*1px;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-footer\s*\{[^}]*margin-top:\s*auto;/s,
  );
  assert.match(
    css,
    /\.projects-team-drawer\s*\{[^}]*top:\s*104px;[^}]*left:\s*12px;[^}]*width:\s*calc\(var\(--projects-rail-width, 200px\) - 24px\);[^}]*gap:\s*0;[^}]*background:\s*var\(--color-background-surface\);/s,
  );
  assert.match(
    css,
    /\.projects-team-switcher__current,[\s\S]*?\.projects-team-switcher__spaces\s*\{[^}]*border-radius:\s*var\(--radius-none\);[^}]*background:\s*transparent;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__header-search\s*\{[^}]*width:\s*min\(800px, 100%\);/s,
  );
  // The rail reflows into a top bar below 980px rather than vanishing — hiding it
  // took the team drawer with it, since the switcher is the drawer's only trigger.
  assert.match(
    css,
    /@media \(max-width:\s*980px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*position:\s*static;[^}]*flex-direction:\s*row;/s,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*980px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*980px\)[\s\S]*?\.projects-workspace__search-toggle\s*\{[^}]*display:\s*inline-grid !important;/,
  );
});

test("keeps the Projects sort dropdown content-sized", () => {
  const css = readFileSync(
    new URL("./projectsWorkspace.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.projects-workspace__toolbar\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-start;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__toolbar \.apps-filterbar__filter\s*\{[^}]*width:\s*fit-content;/s,
  );
});

test("sorts projects without mutating the source list", () => {
  const projects = [
    {
      id: PROJECT_ID,
      title: "Wallet",
      question: "Payment flow",
      platformFilter: "all" as const,
      pinned: false,
      revision: 1,
      evidenceCount: 0,
      synthesisState: "none" as const,
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: OTHER_PROJECT_ID,
      title: "Accounts",
      question: "",
      platformFilter: "all" as const,
      pinned: true,
      revision: 2,
      evidenceCount: 0,
      synthesisState: "none" as const,
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
  ];

  assert.deepEqual(
    sortProjects(projects, "updated").map(({ id }) => id),
    [OTHER_PROJECT_ID, PROJECT_ID],
  );
  assert.deepEqual(
    sortProjects(projects, "name").map(({ id }) => id),
    [OTHER_PROJECT_ID, PROJECT_ID],
  );
  assert.deepEqual(
    projects.map(({ id }) => id),
    [PROJECT_ID, OTHER_PROJECT_ID],
  );
});

const workspaceFixture = (): ResearchProjectWorkspace => ({
  id: PROJECT_ID,
  title: "SSO",
  question: "How should SSO work?",
  platformFilter: "web",
  pinned: false,
  constraints: "",
  decision: "",
  rationale: "",
  openQuestions: "",
  revision: 1,
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
  lanes: [
    {
      id: 10,
      title: "Alternative A",
      position: 0,
      conclusion: "",
      items: [
        {
          id: 100,
          projectId: PROJECT_ID,
          laneId: 10,
          position: 0,
          sourceKind: "catalog_screen",
          stepLabel: "Explain SSO",
          note: "",
          tags: [],
          important: false,
          snapshot: { title: "SSO explainer", app: "Linear" },
        },
      ],
    },
    { id: 11, title: "Alternative B", position: 1, conclusion: "", items: [] },
  ],
});

const canvasActions: DecisionCanvasActions = {
  addLane: async () => {},
  updateLane: async () => {},
  deleteLane: async () => {},
  updateItem: async () => {},
  moveItem: async () => {},
  removeItem: async () => {},
};

test("offers keyboard-safe evidence movement", () => {
  const html = renderToStaticMarkup(
    <DecisionCanvas
      workspace={workspaceFixture()}
      disabled={false}
      actions={canvasActions}
    />,
  );
  assert.match(html, /Move earlier/);
  assert.match(html, /Move later/);
  assert.match(html, /Move to Alternative B/);
});

test("exposes responsive decision-canvas layout hooks", () => {
  const html = renderToStaticMarkup(
    <DecisionCanvas
      workspace={workspaceFixture()}
      disabled={false}
      actions={canvasActions}
    />,
  );

  assert.match(html, /class="research-decision-canvas"/);
  assert.match(html, /class="research-decision-canvas__lanes"/);
  assert.match(html, /Compare visual directions/);
  assert.match(html, /New direction/);
  assert.doesNotMatch(html, /Delete empty lane/);
});

test("defines tablet and phone research-canvas layouts", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 360px;/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*1100px\)\s*\{[\s\S]*?\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*800px\)\s*\{[\s\S]*?\.research-project-workspace__rail\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.research-decision-canvas__lanes\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
});

test("shows suggestion reasons and bounded screenshot upload", () => {
  const html = renderToStaticMarkup(
    <EvidenceDrawer
      workspace={workspaceFixture()}
      disabled={false}
      onChange={() => {}}
      initialSuggestions={[
        {
          id: "screen:1",
          kind: "screen",
          app: "Linear",
          platform: "web",
          title: "SSO onboarding",
          description: "Explains SSO",
          appCategories: ["Productivity"],
          tags: [],
          states: [],
          components: [],
          layouts: [],
          visibleText: [],
          versionId: 2,
          imageId: 1,
          score: 10,
          matchedFields: ["flow title", "visible text"],
        },
      ]}
    />,
  );
  assert.match(html, /Matched: flow title, visible text/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /Reference library/);
});

const insightActions: ProjectInsightsActions = {
  save: async () => {},
  synthesize: async () => {},
  exportMarkdown: async () => {},
};

test("labels AI output and preserves designer decisions", () => {
  const workspace = workspaceFixture();
  workspace.decision = "Use progressive SSO setup";
  workspace.synthesis = {
    id: 1,
    projectRevision: 1,
    stale: false,
    createdAt: "2026-07-17T00:00:00.000Z",
    result: {
      executiveRead: "Progressive setup reduces early complexity.",
      observations: [
        { text: "Products explain SSO first.", evidenceIds: ["e100"] },
      ],
      differences: [{ text: "Timing differs.", evidenceIds: ["e100"] }],
      alternatives: [
        { title: "Progressive", tradeoff: "More steps", evidenceIds: ["e100"] },
      ],
      recommendation: { text: "Use progressive setup.", evidenceIds: ["e100"] },
      requirements: [{ text: "Explain why.", evidenceIds: ["e100"] }],
      openQuestions: [],
    },
  };
  const html = renderToStaticMarkup(
    <ProjectInsightsPanel
      workspace={workspace}
      disabled={false}
      actions={insightActions}
    />,
  );
  assert.match(html, /AI-generated draft/);
  assert.match(html, /Observed evidence/);
  assert.match(html, /Designer decision/);
  assert.match(html, /Use progressive SSO setup/);
});

test("opens every Designer Project on its Canvas file index", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const filesSource = readFileSync(
    new URL("./components/ProjectFilesPage.tsx", import.meta.url),
    "utf8",
  );
  const navigationSource = readFileSync(
    new URL("./components/ProjectWorkspaceNav.tsx", import.meta.url),
    "utf8",
  );
  const canvasSource = readFileSync(
    new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /case "project":[\s\S]*?<ProjectFilesPage projectId=\{route\.projectId\} area="canvas"/,
  );
  assert.match(
    appSource,
    /case "project-playground":[\s\S]*?<ProjectPlayground[\s\S]*?projectId=\{route\.projectId\}/,
  );
  // Chrome is published to the hoisted shell; pages render content only.
  assert.match(filesSource, /useWorkspaceChrome\(/);
  assert.doesNotMatch(filesSource, /<WorkspaceShell|<WorkspaceRail|<WorkspaceHeader/);
  assert.match(filesSource, /function CanvasScreenCard/);
  assert.match(filesSource, /<MediaGridCard/);
  assert.match(filesSource, /data-canvas-preview="placeholder"/);
  assert.doesNotMatch(filesSource, /exportToBlob|getDesignerCanvasFile/);
  assert.doesNotMatch(filesSource, /project-file-index__toolbar/);
  assert.match(filesSource, /project-file-index__grid--documents/);
  // Areas moved into the rail tree, so the screen carries neither a tab bar nor
  // a hero of its own — it wears the same page header as every other surface.
  assert.doesNotMatch(filesSource, /<ProjectWorkspaceNav/);
  assert.doesNotMatch(filesSource, /project-files__hero/);
  assert.match(filesSource, /className="projects-workspace__page-header"/);
  assert.match(filesSource, /area === "settings"/);
  assert.match(filesSource, /label="Save changes"/);
  assert.match(navigationSource, /<ToggleButton/);
  assert.match(navigationSource, /label="Settings"/);
  assert.match(appSource, /case "project-settings"/);
  assert.match(navigationSource, /useSlidingIndicator\(active\)/);
  assert.match(navigationSource, /className="project-area-nav__indicator"/);
  assert.doesNotMatch(navigationSource, /<Icon/);
  assert.match(canvasSource, /className="project-canvas-header"/);
  assert.match(canvasSource, /<Excalidraw/);
  assert.doesNotMatch(
    canvasSource,
    /ProjectWorkspaceNav|SegmentedControl|DecisionCanvas|EvidenceDrawer/,
  );
  assert.doesNotMatch(appSource, /components\/ResearchProjectPage/);
});

test("renders the Canvas file index as either a grid or a list", () => {
  const source = readFileSync(
    new URL("./components/ProjectFilesPage.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("./projectFiles.css", import.meta.url), "utf8");

  // Both modes exist and the toggle only shows where it applies: Canvas, and
  // only once there is something to lay out.
  assert.match(source, /useState<CanvasView>\("grid"\)/);
  assert.match(source, /area === "canvas" && canvases\.length \?/);
  assert.match(source, /<SegmentedControlItem value="grid" label="Grid" \/>/);
  assert.match(source, /<SegmentedControlItem value="list" label="List" \/>/);

  // List reuses the single-column track the document index already uses, so a
  // canvas row and a document row line up.
  assert.match(
    source,
    /area === "canvas" && canvasView === "grid"[\s\S]*?grid--canvas[\s\S]*?grid--documents/,
  );
  assert.match(source, /function CanvasListRow/);
  assert.match(source, /className="project-file-row"[\s\S]*?Canvas · Updated/);
  assert.match(css, /\.project-file-index__grid--documents\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
});

test("puts the project hierarchy in the rail instead of a tab bar", () => {
  const navSource = readFileSync(
    new URL("./components/projectRailNav.tsx", import.meta.url),
    "utf8",
  );
  const filesSource = readFileSync(
    new URL("./components/ProjectFilesPage.tsx", import.meta.url),
    "utf8",
  );
  const indexSource = readFileSync(
    new URL("./components/ProjectsPage.tsx", import.meta.url),
    "utf8",
  );
  const railSource = readFileSync(
    new URL("./components/WorkspaceChrome.tsx", import.meta.url),
    "utf8",
  );

  // Projects › every project › the open one's areas.
  assert.match(navSource, /label: 'Projects'[\s\S]*?children: projects\.map/);
  assert.match(navSource, /label: 'Canvas'[\s\S]*?label: 'Documents'/);
  // Exactly one project is expanded — the one you are inside — so there is no
  // collapse state to persist or get out of sync with the route.
  assert.match(navSource, /const isOpen = projectId === openProjectId/);
  assert.match(navSource, /expanded: isOpen/);
  // Settings is the cog on the open project's row, not a third area row.
  assert.match(navSource, /trailing: isOpen \?/);
  assert.match(navSource, /name: 'project-settings'/);

  // One definition, used by both surfaces, so the rail keeps its shape as you
  // move between the index and a project.
  assert.match(filesSource, /projectRailNav\(\{/);
  assert.match(indexSource, /primaryActions: projectRailNav\(\{/);

  // The rail renders children recursively and keeps the trailing control a
  // sibling of the row button — a button cannot nest inside a button.
  assert.match(railSource, /action\.children\.map\(renderAction\)/);
  assert.match(railSource, /\{renderRow\(action\)\}\s*\n\s*\{action\.trailing\}/);
});

test("flattens the rail tree into the compact bar instead of stacking it", () => {
  const css = readFileSync(new URL("./projectsWorkspace.css", import.meta.url), "utf8");
  const railSource = readFileSync(
    new URL("./components/WorkspaceChrome.tsx", import.meta.url),
    "utf8",
  );

  // An indented vertical block inside a horizontal strip makes the bar tall
  // rather than wide, so the wrappers drop out below the breakpoint.
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.projects-workspace__desktop-subnav\s*\{\s*display:\s*contents;/s,
  );
  // Only the path you are on survives: sibling projects would overrun the strip.
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.projects-workspace__desktop-subnav > \.has-children:not\(\.is-open\)\s*\{\s*display:\s*none;/s,
  );
  assert.match(railSource, /action\.children\?\.length \? 'has-children' : null/);
  // `is-open` tracks the effective fold, not the config default, so a branch the
  // reader collapsed stays collapsed when the bar flattens it.
  assert.match(railSource, /isExpanded\(action\) \? 'is-open' : null/);
});

test("lets the project panel fill the page", () => {
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const files = readFileSync(new URL("./projectFiles.css", import.meta.url), "utf8");

  /*
   * .project-files-page rides on the same <main> as .projects-workspace. A
   * `display: flex` here made the content panel a row flex item, so it shrank to
   * its content and left a gutter down the right of the page. It survived only
   * because a `.projects-workspace.project-files-page { display: block }`
   * override outranked it; both are gone now rather than one cancelling
   * the other.
   */
  assert.doesNotMatch(styles, /\.project-files-page\s*\{/);
  assert.doesNotMatch(files, /\.projects-workspace\.project-files-page\s*\{/);
});
