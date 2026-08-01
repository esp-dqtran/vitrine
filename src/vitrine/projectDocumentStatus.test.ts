import assert from "node:assert/strict";
import test from "node:test";

import {
  projectDocumentSaveState,
  type ProjectDocumentSyncState,
} from "./projectDocumentStatus.ts";

const ready: ProjectDocumentSyncState = {
  indexedDbReady: true,
  connected: true,
  synced: true,
  dirty: false,
  disconnected: false,
  failed: false,
};

test("startup and dirty changes are Saving", () => {
  assert.equal(projectDocumentSaveState({
    ...ready,
    indexedDbReady: false,
    synced: false,
  }), "Saving");
  assert.equal(projectDocumentSaveState({ ...ready, dirty: true }), "Saving");
});

test("ready synchronized state is Saved", () => {
  assert.equal(projectDocumentSaveState(ready), "Saved");
});

test("disconnect takes precedence over a connection failure", () => {
  assert.equal(
    projectDocumentSaveState({ ...ready, disconnected: true }),
    "Offline",
  );
  assert.equal(
    projectDocumentSaveState({
      ...ready,
      disconnected: true,
      failed: true,
    }),
    "Offline",
  );
});

test("reconnection remains Saving until synchronization completes", () => {
  assert.equal(
    projectDocumentSaveState({
      ...ready,
      connected: true,
      synced: false,
      disconnected: false,
    }),
    "Saving",
  );
});
