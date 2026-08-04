import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ProjectMoodboardPanel,
  ProjectMoodboardReferenceInspector,
  layoutMoodboardReferenceInSection,
  type ProjectMoodboardReference,
} from "./components/ProjectMoodboardPanel.tsx";

const noop = () => {};

test("moodboard layout places references in two columns and grows the section", () => {
  const first = layoutMoodboardReferenceInSection({
    image: { width: 1200, height: 900 },
    section: { x: 100, y: 200, width: 720, height: 300 },
    occupiedCount: 0,
  });
  const third = layoutMoodboardReferenceInSection({
    image: { width: 1200, height: 900 },
    section: { x: 100, y: 200, width: 720, height: 300 },
    occupiedCount: 2,
  });

  assert.deepEqual(
    { x: first.x, y: first.y, width: first.width, height: first.height },
    { x: 132, y: 264, width: 307, height: 230 },
  );
  assert.equal(third.x, first.x);
  assert.equal(third.y, first.y + 264);
  assert.ok(third.requiredFrameHeight > 300);
});

test("moodboard mode presents one intake hub and the bounded direction structure", () => {
  const markup = renderToStaticMarkup(
    <ProjectMoodboardPanel
      sectionIds={[]}
      referenceCount={3}
      decisionCounts={{ keep: 1, maybe: 2, reject: 0 }}
      message=""
      onOpenProjectReferences={noop}
      onOpenScreens={noop}
      onUpload={noop}
      onCreateSection={noop}
      onCreateStarter={noop}
      onClose={noop}
      readOnly={false}
    />,
  );

  assert.match(markup, /Moodboard/);
  assert.match(markup, /Inspiration inbox/);
  assert.match(markup, /Project references/);
  assert.match(markup, /Browse screens/);
  assert.match(markup, /Upload images/);
  assert.match(markup, /Unsorted/);
  assert.match(markup, /Direction A/);
  assert.match(markup, /Direction B/);
  assert.match(markup, /Final direction/);
  assert.match(markup, /Set up board/);
  assert.match(markup, />1<\/strong> Keep/);
  assert.match(markup, />2<\/strong> Maybe/);
  assert.match(markup, /Smart Compose/);
  assert.match(markup, /Review Smart Compose/);
});

test("moodboard reference inspector exposes context and explicit decisions", () => {
  const reference: ProjectMoodboardReference = {
    elementId: "element-1",
    sourceKind: "screen",
    sourceId: "app-1:12",
    sourceLabel: "Checkout · Confirmation",
    sourceUrl: "/apps/app-1?evidence=SCREEN-12",
    caption: "Strong hierarchy for the final state.",
    decision: "keep",
    sectionId: "direction-a",
    x: 120,
    y: 160,
    width: 300,
    height: 220,
  };
  const markup = renderToStaticMarkup(
    <ProjectMoodboardReferenceInspector
      reference={reference}
      onCaptionChange={noop}
      onDecisionChange={noop}
      sections={[
        { id: "direction-a", title: "Direction A" },
        { id: "final-direction", title: "Final direction" },
      ]}
      onSectionChange={noop}
      onOpenSource={noop}
      onClose={noop}
      readOnly={false}
    />,
  );

  assert.match(markup, /Vitrines screen/);
  assert.match(markup, /Why I saved this/);
  assert.match(markup, /Strong hierarchy for the final state/);
  assert.match(markup, />Keep</);
  assert.match(markup, />Maybe</);
  assert.match(markup, />Reject</);
  assert.match(markup, /Move to section/);
  assert.match(markup, /Direction A/);
  assert.match(markup, /Final direction/);
  assert.match(markup, /Open source/);
});

test("moodboard controls become view-only for project viewers", () => {
  const reference: ProjectMoodboardReference = {
    elementId: "element-1",
    sourceKind: "upload",
    sourceId: "file-1",
    sourceLabel: "reference.png",
    caption: "Useful rhythm.",
    decision: "maybe",
    sectionId: "unsorted",
    x: 0,
    y: 0,
    width: 240,
    height: 180,
  };
  const panel = renderToStaticMarkup(
    <ProjectMoodboardPanel
      sectionIds={["unsorted"]}
      referenceCount={1}
      decisionCounts={{ keep: 0, maybe: 1, reject: 0 }}
      message=""
      onOpenProjectReferences={noop}
      onOpenScreens={noop}
      onUpload={noop}
      onCreateSection={noop}
      onCreateStarter={noop}
      onClose={noop}
      readOnly
    />,
  );
  const inspector = renderToStaticMarkup(
    <ProjectMoodboardReferenceInspector
      reference={reference}
      sections={[{ id: "unsorted", title: "Unsorted" }]}
      onCaptionChange={noop}
      onDecisionChange={noop}
      onSectionChange={noop}
      onClose={noop}
      readOnly
    />,
  );

  assert.match(panel, /View-only access/);
  assert.match(panel, /disabled=""/);
  assert.match(inspector, /View-only access/);
  assert.match(inspector, /disabled=""/);
});
