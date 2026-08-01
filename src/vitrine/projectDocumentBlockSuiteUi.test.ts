import assert from "node:assert/strict";
import test from "node:test";

import {
  projectDocumentBlockSuiteControlLabel,
  projectDocumentToolbarLabel,
} from "./projectDocumentBlockSuiteUi.ts";

test("maps BlockSuite Canvas toolbar hosts to concise accessible names", () => {
  assert.equal(
    projectDocumentToolbarLabel("EDGELESS-DEFAULT-TOOL-BUTTON"),
    "Select",
  );
  assert.equal(
    projectDocumentToolbarLabel("edgeless-template-button"),
    "Templates",
  );
  assert.equal(
    projectDocumentToolbarLabel("edgeless-mindmap-tool-button", "Others"),
    "Mind map",
  );
  assert.equal(
    projectDocumentToolbarLabel("edgeless-zoom-toolbar", undefined, 1),
    "Zoom out",
  );
  assert.equal(
    projectDocumentToolbarLabel("edgeless-shape-tool-button", "Pick a shape"),
    "Pick a shape",
  );
  assert.equal(projectDocumentToolbarLabel("unknown-toolbar"), undefined);
});

test("names BlockSuite Page authoring controls", () => {
  assert.equal(
    projectDocumentBlockSuiteControlLabel(
      { text: "Callout" },
      "inner-slash-menu",
    ),
    "Callout",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel(
      { tooltip: "Bold" },
      "affine-format-bar-widget",
    ),
    "Bold",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "paragraph-button-icon",
    }),
    "Text style",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "highlight-icon",
    }),
    "Highlight color",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-confirm-button",
    }),
    "Apply link",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "tag-delete-icon",
    }),
    "Remove value",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "select-option-icon",
    }),
    "Edit value",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-drag-handle-container",
    }),
    "Select or drag block",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "database-view-button dv-hover selected",
      textContent: "Kanban View",
    }),
    "Kanban View settings",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "database-view-button dv-hover",
      textContent: "Table View",
    }),
    "Switch to Table View",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "database-view-button dv-icon-16 dv-hover",
    }),
    "Add database view",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-database-filter-button",
    }),
    "Filter database",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-database-sort-button",
    }),
    "Sort database",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-database-toolbar-item more-action",
    }),
    "More database actions",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      className: "affine-select-cell-container",
      textContent: "In Progress",
    }),
    "Select value: In Progress",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      ariaLabel: "Duplicate",
    }),
    "Duplicate",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel({
      textContent: "Delete",
    }),
    "Delete",
  );
  assert.equal(
    projectDocumentBlockSuiteControlLabel(
      { text: { type: "template" } },
      "inner-slash-menu",
    ),
    undefined,
  );
});
