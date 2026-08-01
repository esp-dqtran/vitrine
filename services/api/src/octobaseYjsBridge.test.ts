import assert from "node:assert/strict";
import test from "node:test";

import {
  isWritableYjsFrame,
  shouldForwardReadOnlyYjsFrame,
} from "./octobaseYjsBridge.ts";

test("read-only Yjs bridge forwards only sync step-one requests", () => {
  assert.equal(
    shouldForwardReadOnlyYjsFrame(Uint8Array.from([0, 0])),
    true,
  );
  assert.equal(
    shouldForwardReadOnlyYjsFrame(Uint8Array.from([0, 1])),
    false,
  );
  assert.equal(
    shouldForwardReadOnlyYjsFrame(Uint8Array.from([0, 2])),
    false,
  );
  assert.equal(
    shouldForwardReadOnlyYjsFrame(Uint8Array.from([1, 0])),
    false,
  );
  assert.equal(
    shouldForwardReadOnlyYjsFrame(new Uint8Array()),
    false,
  );
});

test("identifies only Yjs sync update frames as document writes", () => {
  assert.equal(isWritableYjsFrame(Uint8Array.from([0, 0])), false);
  assert.equal(isWritableYjsFrame(Uint8Array.from([0, 1])), true);
  assert.equal(isWritableYjsFrame(Uint8Array.from([0, 2])), true);
  assert.equal(isWritableYjsFrame(Uint8Array.from([1, 0])), false);
  assert.equal(isWritableYjsFrame(new Uint8Array()), false);
});
