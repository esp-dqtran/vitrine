import assert from "node:assert/strict";
import test from "node:test";
import { resolvePinnedPublicTarget } from "./publicNetworkProxy.ts";

test("pins a public hostname to the validated address", async () => {
  const result = await resolvePinnedPublicTarget(
    "https://example.com:8443/app.js",
    async () => [{ address: "203.0.114.10", family: 4 }],
  );
  assert.deepEqual(result, {
    url: "https://example.com:8443/app.js",
    hostname: "example.com",
    port: 8443,
    address: "203.0.114.10",
    family: 4,
  });
});

test("rejects a hostname when any DNS answer is non-public", async () => {
  await assert.rejects(
    () => resolvePinnedPublicTarget(
      "https://example.com/",
      async () => [
        { address: "203.0.114.10", family: 4 },
        { address: "::ffff:7f00:1", family: 6 },
      ],
    ),
    /public/i,
  );
});
