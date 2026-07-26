import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowsPanel } from "./FlowsPanel.tsx";
import { VisualFlowPanel, flowStepItems } from "./VisualFlowPanel.tsx";
import { FlowGallery } from "./FlowGallery.tsx";
import { FlowAnalysisControlsView } from "./FlowAnalysisControls.tsx";
import { buildFlowTreeGroups } from "../flowTree.ts";

const loginFlow = {
  id: "login",
  title: "Login",
  description: "Authenticate with email and password",
  tags: ["Authentication"],
  steps: [
    { label: "Enter email", evidence: [{ imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Email" }] },
    { label: "Enter password", evidence: [{ imageId: 9, imageUrl: "/api/media/linear/fedcba9876543210", description: "Password" }] },
  ],
};

test("renders each flow as a Mobbin-style horizontal screen strip", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} />);
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /class="flow-strip-card__track"/);
  assert.doesNotMatch(html, /flow-strip-card__step-label/);
  assert.match(html, /Login/);
  assert.match(html, /2 screens/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /\/api\/media\/linear\/fedcba9876543210/);
  assert.match(html, /aria-label="Open Login flow"/);
  assert.match(html, /Save/);
  assert.match(html, /Copy/);
  assert.match(html, /aria-label="More flow actions"/);
});

test("keeps the empty flows state inside the shared gallery section", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[]} />);
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /No captured flows yet/);
});

test("does not offer the retired FLOW.md editor", () => {
  const html = renderToStaticMarkup(<FlowsPanel flows={[loginFlow]} app="linear" platform="web" />);
  assert.doesNotMatch(html, /FLOW\.md/);
});

test("VisualFlowPanel renders curator-ordered flow steps with real evidence images", () => {
  const html = renderToStaticMarkup(<VisualFlowPanel flow={loginFlow} />);
  assert.match(html, /Login/);
  assert.match(html, /Enter email/);
  assert.match(html, /Enter password/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
  assert.match(html, /\/api\/media\/linear\/fedcba9876543210/);
});

test("VisualFlowPanel renders persisted Flow and step analysis beside the captured evidence", () => {
  const html = renderToStaticMarkup(
    <VisualFlowPanel
      flow={{
        ...loginFlow,
        insights: {
          purpose: "Authenticate securely",
          feedback: ["Invalid credentials show an inline error"],
          openQuestions: ["Is password recovery available?"],
          confidence: 0.87,
          reviewStatus: "needs_review",
          source: "llm_inferred",
          evidence: loginFlow.steps.flatMap(({ evidence }) => evidence),
        },
        steps: loginFlow.steps.map((step, index) => ({
          ...step,
          analysis: {
            interaction: index === 0 ? "Enter an email address" : "Submit credentials",
            visibleStates: [index === 0 ? "Email field ready" : "Password field ready"],
            systemFeedback: index === 0 ? [] : ["Inline validation"],
            source: "llm_inferred",
          },
        })),
      }}
    />,
  );

  assert.match(html, /aria-label="Flow analysis"/);
  assert.match(html, /Authenticate securely/);
  assert.match(html, /87% confidence/);
  assert.match(html, /Enter an email address/);
  assert.match(html, /Password field ready/);
  assert.match(html, /Inline validation/);
  assert.match(html, /Is password recovery available/);
});

test("offers admins a Flow-specific analysis action without reviving screen analysis", () => {
  const html = renderToStaticMarkup(
    <FlowAnalysisControlsView
      userRole="admin"
      version={3}
      status="missing"
      currentJob={null}
      snapshotId={undefined}
      actions={{ start: async () => undefined }}
    />,
  );

  assert.match(html, /aria-label="Flow analysis controls"/);
  assert.match(html, />Analyze flows</);
  assert.doesNotMatch(html, /Start analysis|Analyze screens|Design System/i);
  assert.equal(
    renderToStaticMarkup(
      <FlowAnalysisControlsView
        userRole="user"
        version={3}
        status="missing"
        currentJob={null}
        snapshotId={undefined}
        actions={null}
      />,
    ),
    "",
  );
});

test("VisualFlowPanel renders a Mobbin-style horizontal flow stage", () => {
  const html = renderToStaticMarkup(<VisualFlowPanel flow={loginFlow} />);
  assert.match(html, /aria-label="Login Visual Flow"/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.doesNotMatch(html, /aria-modal="true"/);
  assert.match(html, /class="visual-flow-panel"/);
  assert.match(html, /Screens/);
  assert.match(html, /Prototype/);
  assert.match(html, /class="visual-flow-panel__stage"/);
  assert.match(html, /class="visual-flow-panel__track"/);
  assert.equal((html.match(/class="visual-flow-panel__screen-card"/g) ?? []).length, 2);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /aria-label="Previous flow screens"/);
  assert.match(html, /aria-label="Next flow screens"/);
  assert.match(html, /Login/);
  assert.match(html, /2 screens/);
  assert.match(html, /Save/);
  assert.match(html, /Copy/);
});

test("VisualFlowPanel renders web flow screenshots as large full-image cards", () => {
  const html = renderToStaticMarkup(<VisualFlowPanel flow={loginFlow} platform="web" />);
  assert.match(html, /class="visual-flow-panel visual-flow-panel--web"/);
  assert.equal((html.match(/visual-flow-panel__screen-card--web/g) ?? []).length, 2);
  assert.match(html, /background:transparent/);
});

test("VisualFlowPanel keeps Document Flow creation out of the visual representation", () => {
  assert.doesNotMatch(
    renderToStaticMarkup(<VisualFlowPanel flow={loginFlow} platform="web" />),
    /Create Feature Document/,
  );
});

test("VisualFlowPanel does not render the auto-generated crawl description", () => {
  const html = renderToStaticMarkup(
    <VisualFlowPanel flow={{ ...loginFlow, description: "Imported from Mobbin: https://mobbin.com/flows/abc" }} />
  );
  assert.doesNotMatch(html, /Imported from Mobbin/);
});

test("maps lightbox items back to source step numbers when some steps lack evidence", () => {
  const items = flowStepItems({
    ...loginFlow,
    steps: [
      { label: "Missing", evidence: [] },
      loginFlow.steps[0],
      loginFlow.steps[1],
    ],
  });
  assert.deepEqual(items.map(({ stepNumber }) => stepNumber), [2, 3]);
});

test("provides separate source-step controls for the focused flow stage", () => {
  const html = renderToStaticMarkup(
    <VisualFlowPanel flow={loginFlow} />,
  );
  assert.match(html, /aria-label="Select visual step 1: Enter email"/);
  assert.match(html, /aria-label="Select visual step 2: Enter password"/);
});

test("groups flows by category, keeping uncategorized flows in their own section", () => {
  const flows = [
    { ...loginFlow, id: "a", title: "Copying a code", category: "Run detail" },
    { ...loginFlow, id: "b", title: "Sharing a run", category: "Run detail" },
    { ...loginFlow, id: "c", title: "Home" },
  ];
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, /Run detail/);
  assert.match(html, /Copying a code/);
  assert.match(html, /Sharing a run/);
  assert.match(html, /Home/);
});

test("filters flows by title via the search box once there are enough to warrant one", () => {
  const flows = Array.from({ length: 9 }, (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i}` }));
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, /Search flows/);
});

test("renders only the first flow batch before the scroll sentinel is reached", () => {
  const flows = Array.from(
    { length: 30 },
    (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i + 1}` }),
  );
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.equal((html.match(/aria-label="Open Flow \d+ flow"/g) ?? []).length, 24);
  assert.match(html, /Open Flow 24 flow/);
  assert.doesNotMatch(html, /Open Flow 25 flow/);
});

test("keeps the full category total while progressively rendering its cards", () => {
  const flows = Array.from(
    { length: 30 },
    (_, i) => ({ ...loginFlow, id: `f${i}`, title: `Flow ${i + 1}`, category: "Settings" }),
  );
  const html = renderToStaticMarkup(<FlowsPanel flows={flows} />);
  assert.match(html, />Settings<\/span><span[^>]*>30<\/span>/);
});

test("FlowGallery keeps card batching and complete category totals independent from tree navigation", () => {
  const flows = Array.from(
    { length: 30 },
    (_, index) => ({
      ...loginFlow,
      id: `settings-${index}`,
      title: `Settings ${index + 1}`,
      category: "Settings",
    }),
  );
  const html = renderToStaticMarkup(
    <FlowGallery
      groups={buildFlowTreeGroups(flows)}
      onSelectFlow={() => undefined}
    />,
  );

  assert.equal((html.match(/aria-label="Open Settings \d+ flow"/g) ?? []).length, 24);
  assert.equal((html.match(/data-flow-strip-card="true"/g) ?? []).length, 24);
  assert.match(html, />Settings<\/span><span[^>]*>30<\/span>/);
  assert.doesNotMatch(html, /Open Settings 25 flow/);
});
