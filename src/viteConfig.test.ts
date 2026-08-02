import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.ts";

test("proxies API and Project Document collaboration through their host ports", () => {
  const proxy = config.server?.proxy as Record<string, { target: string; ws?: boolean }>;
  assert.deepEqual(Object.keys(proxy), ["/api/project-document-collaboration", "/api"]);
  assert.equal(proxy["/api/project-document-collaboration"].target, "http://127.0.0.1:3013");
  assert.equal(proxy["/api/project-document-collaboration"].ws, true);
  assert.equal(proxy["/api"].target, "http://127.0.0.1:3010");
});
