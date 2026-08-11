import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDesignerCanvasClientMessage } from "./protocol.ts";

const snapshot = {
  type: "excalidraw",
  version: 2,
  source: "https://astryx.design",
  elements: [],
  appState: {},
};

test("accepts versioned Excalidraw scenes and normalizes omitted files", () => {
  assert.deepEqual(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "scene",
    sequence: 1,
    snapshot,
  })), {
    type: "scene",
    sequence: 1,
    snapshot: { ...snapshot, files: {}, comments: [] },
  });
});

test("accepts bounded cursor presence and rejects malformed messages", () => {
  assert.deepEqual(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "cursor",
    pointer: { x: 12, y: -8 },
    button: "down",
    selectedElementIds: ["shape-1"],
  })), {
    type: "cursor",
    pointer: { x: 12, y: -8 },
    button: "down",
    selectedElementIds: ["shape-1"],
  });
  assert.equal(parseDesignerCanvasClientMessage("not json"), undefined);
  assert.equal(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "cursor",
    pointer: { x: Number.MAX_VALUE, y: 0 },
    button: "down",
  })), undefined);
  assert.equal(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "scene",
    sequence: 0,
    snapshot,
  })), undefined);
});

test("accepts compact element patches and rejects malformed patch elements", () => {
  assert.deepEqual(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "patch",
    sequence: 2,
    patch: {
      elements: [{ id: "shape-1", x: 16 }],
      files: { image: { dataURL: "/assets/image" } },
    },
  })), {
    type: "patch",
    sequence: 2,
    patch: {
      elements: [{ id: "shape-1", x: 16 }],
      files: { image: { dataURL: "/assets/image" } },
    },
  });
  assert.equal(parseDesignerCanvasClientMessage(JSON.stringify({
    type: "patch",
    sequence: 3,
    patch: { elements: [{ x: 16 }], files: {} },
  })), undefined);
});
