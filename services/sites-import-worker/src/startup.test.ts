import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SITES_CRAWL_TIMEOUT_MS,
  runSitesCrawlWithTimeout,
  sitesCrawlTimeoutMs,
  startSitesImportWorker,
} from "./start.ts";
import { wappalyzerOptionsFromEnvironment } from "./wappalyzerConfig.ts";

test("Sites worker verifies migrations and storage before consuming", async () => {
  const order: string[] = [];
  await startSitesImportWorker({
    assertMigrations: async () => { order.push("migrations"); },
    assertObjectStorage: async () => { order.push("storage"); },
    consume: async () => { order.push("consume"); },
  });
  assert.deepEqual(order, ["migrations", "storage", "consume"]);
});

test("Sites worker does not consume after a failed startup gate", async () => {
  for (const failed of ["migrations", "storage"] as const) {
    let consumed = false;
    await assert.rejects(startSitesImportWorker({
      assertMigrations: async () => {
        if (failed === "migrations") throw new Error("pending migrations");
      },
      assertObjectStorage: async () => {
        if (failed === "storage") throw new Error("storage unavailable");
      },
      consume: async () => { consumed = true; },
    }), failed === "migrations" ? /pending migrations/ : /storage unavailable/);
    assert.equal(consumed, false);
  }
});

test("Sites worker applies a bounded crawl timeout", async () => {
  assert.equal(sitesCrawlTimeoutMs(undefined), DEFAULT_SITES_CRAWL_TIMEOUT_MS);
  assert.equal(sitesCrawlTimeoutMs("2500"), 2_500);
  assert.throws(() => sitesCrawlTimeoutMs("forever"), /timeout/i);
  assert.throws(() => sitesCrawlTimeoutMs("999"), /timeout/i);

  let closes = 0;
  const result = await runSitesCrawlWithTimeout(
    async () => "done",
    async () => { closes += 1; },
    1_000,
  );
  assert.equal(result, "done");
  assert.equal(closes, 1);

  closes = 0;
  await assert.rejects(
    runSitesCrawlWithTimeout(
      () => new Promise<never>(() => undefined),
      async () => { closes += 1; },
      10,
    ),
    /timed out after 10ms/,
  );
  assert.equal(closes, 1);
});

test("enables Wappalyzer only for an explicitly configured extension", () => {
  assert.equal(wappalyzerOptionsFromEnvironment({}), undefined);
  assert.deepEqual(wappalyzerOptionsFromEnvironment({
    SITE_TECH_WAPPALYZER_EXTENSION_PATH: "/opt/wappalyzer",
    SITE_TECH_WAPPALYZER_TIMEOUT_MS: "25000",
    HEADLESS: "false",
  }), {
    extensionPath: "/opt/wappalyzer",
    timeoutMs: 25_000,
    headless: false,
  });
  assert.throws(
    () => wappalyzerOptionsFromEnvironment({
      SITE_TECH_WAPPALYZER_EXTENSION_PATH: "/opt/wappalyzer",
      SITE_TECH_WAPPALYZER_TIMEOUT_MS: "forever",
    }),
    /timeout/i,
  );
});
