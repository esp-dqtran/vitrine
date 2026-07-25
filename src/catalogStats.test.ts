import assert from "node:assert/strict";
import test from "node:test";
import { catalogStats } from "./db.ts";

test("counts latest published app-platform versions without a correlated lookup", async () => {
  let captured = "";
  const runQuery = async (sql: string) => {
    captured = sql;
    return {
      rows: [{ apps: 1192, screens: 120000, ui_elements: 0 }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  };

  assert.deepEqual(await catalogStats(runQuery as never), {
    apps: 1192,
    screens: 120000,
    uiElements: 0,
  });
  assert.match(captured, /DISTINCT ON \(av\.app_id, av\.platform\)/);
  assert.doesNotMatch(captured, /SELECT MAX\(latest\.version_number\)/);
});
