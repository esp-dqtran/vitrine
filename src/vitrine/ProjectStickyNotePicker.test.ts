import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { stickyNoteBoundTextPosition } from "./components/stickyNoteTextLayout.ts";

const pickerSource = readFileSync(
  new URL("./components/ProjectStickyNotePicker.tsx", import.meta.url),
  "utf8",
);
const playgroundSource = readFileSync(
  new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
  "utf8",
);
const toolbarSource = readFileSync(
  new URL("./components/ProjectStickyNoteToolbar.tsx", import.meta.url),
  "utf8",
);
const canvasObjectToolbarSource = readFileSync(
  new URL("./components/CanvasObjectToolbar.tsx", import.meta.url),
  "utf8",
);

test("uses a three-note collage for the sticky tool trigger", () => {
  assert.match(pickerSource, /export function StickyNotesCollageGlyph/);
  assert.match(pickerSource, /project-sticky-notes-collage__note--back/);
  assert.match(pickerSource, /project-sticky-notes-collage__note--middle/);
  assert.match(pickerSource, /project-sticky-notes-collage__note--front/);
  assert.match(
    playgroundSource,
    /if \(tool === "sticky"\)\s*\{\s*return <StickyNotesCollageGlyph color=\{stickyColor\} \/>;\s*\}/,
  );
});

test("keeps Sticky Notes toolbar actions bound to the live canvas selection", () => {
  assert.match(
    playgroundSource,
    /const selectedStickyNoteRef = useRef<AstryxStickyNoteReference>\(\);/,
  );
  assert.match(
    playgroundSource,
    /selectedStickyNoteRef\.current = selectedSticky;/,
  );
  assert.match(
    playgroundSource,
    /const note = selectedStickyNoteRef\.current \?\? selectedStickyNote;/,
  );
  assert.match(
    playgroundSource,
    /left\?\.color\.fill === right\?\.color\.fill[\s\S]*left\?\.color\.stroke === right\?\.color\.stroke[\s\S]*left\?\.color\.text === right\?\.color\.text/,
  );
  assert.match(
    playgroundSource,
    /selectedStickyNoteRef\.current = nextNote;[\s\S]*captureUpdate: CaptureUpdateAction\.IMMEDIATELY/,
  );
});

test("keeps Sticky Note text at the FigJam top-left inset", () => {
  assert.match(playgroundSource, /withCanvasElementUpdate\(element, position\)/);
  const container = { x: 100, y: 200, width: 200, height: 160 };
  const text = { width: 60, height: 24 };

  assert.deepEqual(
    stickyNoteBoundTextPosition(container, { ...text, textAlign: "left" }),
    { x: 124, y: 224 },
  );
  assert.deepEqual(
    stickyNoteBoundTextPosition(container, { ...text, textAlign: "center" }),
    { x: 170, y: 224 },
  );
  assert.deepEqual(
    stickyNoteBoundTextPosition(container, { ...text, textAlign: "right" }),
    { x: 216, y: 224 },
  );
});

test("uses the FigJam Sticky Note typography choices and size scale", () => {
  assert.match(toolbarSource, /simple: 6/);
  assert.match(toolbarSource, /bookish: 7/);
  assert.match(toolbarSource, /technical: 3/);
  assert.match(toolbarSource, /cute: 5/);
  assert.match(
    toolbarSource,
    /const projectStickyNoteFontSizes = \[16, 20, 28, 36, 48\] as const/,
  );
  assert.match(toolbarSource, /\["simple", "Simple"\]/);
  assert.match(toolbarSource, /\["bookish", "Bookish"\]/);
  assert.match(toolbarSource, /\["technical", "Technical"\]/);
  assert.match(toolbarSource, /\["cute", "Cute"\]/);
});

test("shows FigJam's empty Sticky Note guidance without saving it as text", () => {
  assert.match(playgroundSource, /text: textElement\?\.type === "text" \? textElement\.text : ""/);
  assert.match(
    playgroundSource,
    /filter\(\(note\) => note\.textElementId && !note\.text\.trim\(\)\)/,
  );
  assert.match(playgroundSource, /Type anything, @mention anyone/);
  assert.match(playgroundSource, /className="project-sticky-note-placeholder"/);
});

test("renders persisted Bold and Strikethrough treatments on Sticky Notes", () => {
  assert.match(toolbarSource, /aria-label="Bold"/);
  assert.match(toolbarSource, /aria-label="Strikethrough"/);
  assert.match(toolbarSource, /stickyNoteUsesRichTextOverlay/);
  assert.match(playgroundSource, /project-sticky-note-rich-text/);
  assert.match(
    playgroundSource,
    /fontWeight: note\.format\.bold \? 700 : 400/,
  );
  assert.match(
    playgroundSource,
    /textDecoration: note\.format\.strikethrough \? "line-through" : "none"/,
  );
});

test("normalizes every committed Sticky Note list line", () => {
  assert.match(playgroundSource, /const normalizedStickyListElements = appState\.editingTextElement/);
  assert.match(
    playgroundSource,
    /stickyNoteReferenceForElement\(container, elements\)[\s\S]*sticky\?\.format\.bulletedList/,
  );
  assert.match(
    playgroundSource,
    /canvasTextWithBulletedList\(textElement\.text, true\)/,
  );
});

test("uses FigJam's compact enter-to-apply link editor", () => {
  assert.match(toolbarSource, /aria-label="Type or paste URL"/);
  assert.match(toolbarSource, /placeholder="Type or paste URL"/);
  assert.match(toolbarSource, /event\.key === "Enter"/);
  assert.match(toolbarSource, /event\.key === "Escape"/);
  assert.match(toolbarSource, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
  assert.doesNotMatch(toolbarSource, /label="Apply"/);
  assert.doesNotMatch(toolbarSource, /project-object-toolbar__link-actions/);
});

test("keeps an active Sticky Note control isolated from canvas shortcuts", () => {
  assert.match(canvasObjectToolbarSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(canvasObjectToolbarSource, /onMouseDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(canvasObjectToolbarSource, /onKeyDown=\{\(event\) => event\.stopPropagation\(\)\}/);
});
