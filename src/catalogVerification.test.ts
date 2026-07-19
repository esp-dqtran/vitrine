import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCatalogPersistenceComplete,
  CatalogPersistenceError,
  catalogPersistenceRepair,
  type CatalogPersistenceSnapshot,
} from "./catalogVerification.ts";

const complete: CatalogPersistenceSnapshot = {
  app: "airalo",
  platform: "ios",
  screens: 89,
  uiElements: 89,
  flows: 32,
  invalidFlowReferences: 0,
  missingScreenObjects: 0,
  missingUiElementObjects: 0,
  missingFlowObjects: 0,
};

test("persisted verification accepts complete data", () => {
  assert.deepEqual(
    catalogPersistenceRepair({ screens: 89, uiElements: 89, flows: 32 }, complete),
    { screens: false, uiElements: false, flows: false },
  );
});

test("persisted verification maps gaps to exact repair phases", () => {
  assert.deepEqual(catalogPersistenceRepair(
    { screens: 89, uiElements: 89, flows: 32 },
    { ...complete, screens: 88, missingUiElementObjects: 1, invalidFlowReferences: 1 },
  ), { screens: true, uiElements: true, flows: true });
});

test("missing expected totals are unauditable", () => {
  assert.deepEqual(catalogPersistenceRepair({}, complete),
    { screens: true, uiElements: true, flows: true });
});

test("persistence loader requires object backing and normalizes database counters", async () => {
  const verification = await import("./catalogVerification.ts") as Record<string, unknown>;
  assert.equal(typeof verification.loadCatalogPersistence, "function");
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const pool = {
    query: async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      return {
        rows: [{
          app: "airalo",
          platform: "ios",
          screens: "89",
          ui_elements: "89",
          flows: "32",
          invalid_flow_references: "0",
          missing_screen_objects: "1",
          missing_ui_element_objects: "2",
          missing_flow_objects: "3",
        }],
      };
    },
  };

  const load = verification.loadCatalogPersistence as
    ((pool: unknown, jobs: Array<{ app: string; platform: string }>) => Promise<Map<string, CatalogPersistenceSnapshot>>);
  const result = await load(pool, [{ app: "airalo", platform: "ios" }]);

  assert.deepEqual(queries[0]?.params, [JSON.stringify([{ app: "airalo", platform: "ios" }])]);
  assert.match(queries[0]?.text ?? "", /LEFT JOIN stored_objects so ON so\.object_key = i\.object_key/);
  assert.match(queries[0]?.text ?? "", /missing_screen_objects/);
  assert.match(queries[0]?.text ?? "", /missing_ui_element_objects/);
  assert.match(queries[0]?.text ?? "", /missing_flow_objects/);
  assert.deepEqual(result.get("airalo\u0000ios"), {
    ...complete,
    missingScreenObjects: 1,
    missingUiElementObjects: 2,
    missingFlowObjects: 3,
  });
});

test("persisted verification error retains exact repair phases", () => {
  assert.throws(
    () => assertCatalogPersistenceComplete(
      { screens: 144, uiElements: 144, flows: 36 },
      {
        app: "5-minute-journal",
        platform: "ios",
        screens: 144,
        uiElements: 136,
        flows: 0,
        invalidFlowReferences: 0,
        missingScreenObjects: 0,
        missingUiElementObjects: 0,
        missingFlowObjects: 0,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof CatalogPersistenceError);
      assert.deepEqual(error.repair, { screens: false, uiElements: true, flows: true });
      assert.match(error.message, /UI elements 136\/144/);
      assert.match(error.message, /flows 0\/36/);
      return true;
    },
  );
});
