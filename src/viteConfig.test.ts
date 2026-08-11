import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.ts";

test("proxies collaboration sockets before the host API fallback", () => {
  const proxy = config.server?.proxy as Record<string, { target: string }>;
  assert.deepEqual(Object.keys(proxy), [
    "^/assets/(icons|thumbnails|sites|ui-elements)/",
    "/api/project-document-collaboration",
    "/api/designer-canvas-collaboration",
    "/api",
  ]);
  assert.equal(
    proxy["/api/project-document-collaboration"].target,
    "http://127.0.0.1:3013",
  );
  assert.equal(
    proxy["/api/designer-canvas-collaboration"].target,
    "http://127.0.0.1:3012",
  );
  assert.equal(proxy["/api"].target, "http://127.0.0.1:3010");
});
