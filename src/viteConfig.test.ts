import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.ts";

test("proxies every Vitrine API route through the host API port", () => {
  const proxy = config.server?.proxy as Record<string, { target: string }>;
  assert.deepEqual(Object.keys(proxy), ["/api"]);
  assert.equal(proxy["/api"].target, "http://127.0.0.1:3010");
});
