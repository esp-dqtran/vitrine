import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const moduleUrl = new URL("./queue-failed-mobbin-sites.ts", import.meta.url);

test("selects only the latest unresolved failed job for each canonical Site URL", async () => {
  assert.equal(
    existsSync(moduleUrl),
    true,
    "queue-failed-mobbin-sites.ts must exist",
  );
  const module = await import("./queue-failed-mobbin-sites.ts") as {
    selectLatestFailedSiteJobs?: (
      rows: Array<{ id: number; url: string | null }>,
      readyUrls?: ReadonlySet<string>,
    ) => Array<{ id: number; url: string }>;
  };
  assert.equal(typeof module.selectLatestFailedSiteJobs, "function");

  const aino =
    "https://mobbin.com/sites/aino-agency-ca792344-3c1c-4684-997c-07720a5e499a/74f1cbeb-a673-44bb-ac27-be291d5fe4fa/preview";
  const shopify =
    "https://mobbin.com/sites/shopify-design-6ebc4665-ba1e-4033-baa7-cc92ade892ea/ad8fb275-19f1-4604-b3d3-98f6a285ed57/preview";

  assert.deepEqual(
    module.selectLatestFailedSiteJobs!(
      [
        { id: 11, url: `${aino}/` },
        { id: 14, url: aino },
        { id: 13, url: shopify },
        { id: 12, url: "https://example.com/not-mobbin" },
        { id: 10, url: null },
      ],
      new Set([shopify]),
    ),
    [{ id: 14, url: aino }],
  );
});
