import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./components/ProjectPlaygroundPage.tsx", import.meta.url),
  "utf8",
);

test("uses the shared object toolbar for selected free lines", () => {
  assert.match(source, /interface CanvasFreeLineReference/);
  assert.match(source, /element\.type !== "freedraw"/);
  assert.match(
    source,
    /const validPoints = \(freeLine\.points \?\? \[\]\)\.filter/,
  );
  assert.match(source, /freeLine\.x \+ pointBounds\.minX/);
  assert.match(source, /freeLine\.y \+ pointBounds\.minY/);
  assert.match(source, /canvasFreeLineMode/);
  assert.match(
    source,
    /<ProjectSelectionToolbar[\s\S]*ariaLabel="Free line properties"/,
  );
  assert.match(source, /\{ mode: "marker", label: "Marker" \}/);
  assert.match(source, /\{ mode: "highlighter", label: "Highlighter" \}/);
  assert.match(source, /project-free-line-toolbar-left/);
  assert.match(source, /selectedCanvasFocusBounds\.left/);
  assert.match(source, /selectedCanvasFocusBounds\.top - 48/);
  assert.match(source, /Change free line color/);
  assert.match(source, /Free line colors/);
  assert.match(source, /<ProjectObjectToolbarColorPicker[\s\S]*ariaLabel="Change free line color"/);
  assert.match(source, /panelClassName="project-free-line-object-toolbar__color-panel"/);
  assert.match(source, /canvasHighlighterToolbarColors/);
  assert.match(source, /selectedCanvasFreeLineRef\.current/);
  assert.match(
    source,
    /selectedCanvasFreeLineRef\.current = selectedFreeLine/,
  );
  assert.match(
    source,
    /selectedCanvasFreeLine\?\.mode === "highlighter" \? "highlighter" : "marker"/,
  );
  assert.match(source, /updateSelectedCanvasFreeLine/);
  assert.match(source, /captureUpdate: CaptureUpdateAction\.IMMEDIATELY/);
});
