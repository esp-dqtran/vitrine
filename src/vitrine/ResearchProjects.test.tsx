import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  sortProjects,
  ResearchProjectsView,
} from "./components/ResearchProjectsPage.tsx";
import { DecisionCanvas, type DecisionCanvasActions } from "./components/DecisionCanvas.tsx";
import type { ResearchProjectWorkspace } from "../researchProject.ts";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import { ProjectInsightsPanel, type ProjectInsightsActions } from "./components/ProjectInsightsPanel.tsx";

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
    <ResearchProjectsView projects={[]} loading={false} error="" actions={actions} />,
  );
  assert.match(empty, /Create your first project/);

  const populated = renderToStaticMarkup(<ResearchProjectsView
    projects={[{
      id: 1,
      title: "SSO onboarding",
      question: "How should SSO be introduced?",
      platformFilter: "web",
      pinned: true,
      revision: 3,
      evidenceCount: 6,
      synthesisState: "stale",
      updatedAt: "2026-07-17T00:00:00.000Z",
    }]}
    loading={false}
    error=""
    actions={actions}
  />);
  assert.match(populated, /SSO onboarding/);
  assert.match(populated, /Pinned/);
  assert.match(populated, /Rename/);
  assert.match(populated, /data-app-discovery-card="true"/);
  assert.match(populated, /aria-label="Sort: Last updated"/);
  assert.doesNotMatch(populated, /Filter projects/);
  assert.doesNotMatch(populated, /Synthesis stale|Draft|Active|Paused/);
});

test("sorts projects without mutating the source list", () => {
  const projects = [{
    id: 1,
    title: "Wallet",
    question: "Payment flow",
    platformFilter: "all" as const,
    pinned: false,
    revision: 1,
    evidenceCount: 0,
    synthesisState: "none" as const,
    updatedAt: "2026-07-01T00:00:00.000Z",
  }, {
    id: 2,
    title: "Accounts",
    question: "",
    platformFilter: "all" as const,
    pinned: true,
    revision: 2,
    evidenceCount: 0,
    synthesisState: "none" as const,
    updatedAt: "2026-07-20T00:00:00.000Z",
  }];

  assert.deepEqual(sortProjects(projects, "updated").map(({ id }) => id), [2, 1]);
  assert.deepEqual(sortProjects(projects, "name").map(({ id }) => id), [2, 1]);
  assert.deepEqual(projects.map(({ id }) => id), [1, 2]);
});

const workspaceFixture = (): ResearchProjectWorkspace => ({
  id: 1,
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
      items: [{
        id: 100,
        projectId: 1,
        laneId: 10,
        position: 0,
        sourceKind: "catalog_screen",
        stepLabel: "Explain SSO",
        note: "",
        tags: [],
        important: false,
        snapshot: { title: "SSO explainer", app: "Linear" },
      }],
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
    <DecisionCanvas workspace={workspaceFixture()} disabled={false} actions={canvasActions} />,
  );
  assert.match(html, /Move earlier/);
  assert.match(html, /Move later/);
  assert.match(html, /Move to Alternative B/);
});

test("exposes responsive decision-canvas layout hooks", () => {
  const html = renderToStaticMarkup(
    <DecisionCanvas workspace={workspaceFixture()} disabled={false} actions={canvasActions} />,
  );

  assert.match(html, /class="research-decision-canvas"/);
  assert.match(html, /class="research-decision-canvas__lanes"/);
});

test("defines tablet and phone research-canvas layouts", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*280px minmax\(0, 1fr\) 320px;/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*1100px\)\s*\{[\s\S]*?\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.research-decision-canvas__lanes\s*\{[^}]*grid-auto-flow:\s*row;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*overflow-x:\s*visible;/,
  );
});

test("shows suggestion reasons and bounded screenshot upload", () => {
  const html = renderToStaticMarkup(<EvidenceDrawer
    workspace={workspaceFixture()}
    disabled={false}
    onChange={() => {}}
    initialSuggestions={[{
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
    }]}
  />);
  assert.match(html, /Matched: flow title, visible text/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
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
      observations: [{ text: "Products explain SSO first.", evidenceIds: ["e100"] }],
      differences: [{ text: "Timing differs.", evidenceIds: ["e100"] }],
      alternatives: [{ title: "Progressive", tradeoff: "More steps", evidenceIds: ["e100"] }],
      recommendation: { text: "Use progressive setup.", evidenceIds: ["e100"] },
      requirements: [{ text: "Explain why.", evidenceIds: ["e100"] }],
      openQuestions: [],
    },
  };
  const html = renderToStaticMarkup(<ProjectInsightsPanel workspace={workspace} disabled={false} actions={insightActions} />);
  assert.match(html, /AI-generated draft/);
  assert.match(html, /Observed evidence/);
  assert.match(html, /Designer decision/);
  assert.match(html, /Use progressive SSO setup/);
});
