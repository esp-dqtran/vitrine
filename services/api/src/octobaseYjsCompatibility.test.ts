import assert from "node:assert/strict";
import test from "node:test";

import {
  octobaseGuidPrefixedUpdate,
  translateOctobaseYjsFrame,
} from "./octobaseYjsCompatibility.ts";

function varUint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function updateFrame(syncType: 1 | 2, update: Uint8Array): Buffer {
  return Buffer.from([0, syncType, ...varUint(update.length), ...update]);
}

test("detects only the expected OctoBase workspace GUID prefix", () => {
  const update = Uint8Array.from([1, 2, 3]);
  const prefixed = octobaseGuidPrefixedUpdate("workspace-1", update);

  assert.deepEqual(
    octobaseGuidPrefixedUpdate("workspace-1", update),
    prefixed,
  );
  assert.notDeepEqual(prefixed, update);
});

test("strips the expected GUID from sync update frames", () => {
  const update = Uint8Array.from([1, 5, 9, 2]);
  const frame = updateFrame(
    2,
    octobaseGuidPrefixedUpdate("workspace-1", update),
  );

  assert.deepEqual(
    translateOctobaseYjsFrame(frame, "workspace-1"),
    updateFrame(2, update),
  );
});

test("strips the expected GUID from sync step-two frames", () => {
  const update = Uint8Array.from([2, 8, 0, 1]);
  const frame = updateFrame(
    1,
    octobaseGuidPrefixedUpdate("workspace-1", update),
  );

  assert.deepEqual(
    translateOctobaseYjsFrame(frame, "workspace-1"),
    updateFrame(1, update),
  );
});

test("leaves normal, unrelated, and malformed frames unchanged", () => {
  const normal = updateFrame(2, Uint8Array.from([1, 2, 3]));
  const anotherWorkspace = updateFrame(
    2,
    octobaseGuidPrefixedUpdate("workspace-2", Uint8Array.from([1, 2, 3])),
  );
  const awareness = Buffer.from([1, 0]);
  const malformed = Buffer.from([0, 2, 99, 1]);

  for (const frame of [normal, anotherWorkspace, awareness, malformed]) {
    assert.deepEqual(
      translateOctobaseYjsFrame(frame, "workspace-1"),
      frame,
    );
  }
});
