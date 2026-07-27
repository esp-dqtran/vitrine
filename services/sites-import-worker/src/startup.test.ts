import assert from "node:assert/strict";
import test from "node:test";
import { startSitesImportWorker } from "./start.ts";
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
