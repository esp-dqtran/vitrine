import assert from "node:assert/strict";
import { test } from "node:test";

test("repairs unescaped UI labels inside ChatGPT JSON strings", async () => {
  const module = await import("./json-repair.ts").catch(() => ({}));
  const repairJsonStringQuotes = (module as {
    repairJsonStringQuotes?: (value: string) => string;
  }).repairJsonStringQuotes;
  assert.equal(typeof repairJsonStringQuotes, "function");

  const invalid = `{"description":"A password item named "Password Admin" is open.","action":"Select "Add to Favorites"","unknowns":["The "View previous version" result is not shown."]}`;
  const parsed = JSON.parse(repairJsonStringQuotes!(invalid));

  assert.deepEqual(parsed, {
    description: 'A password item named "Password Admin" is open.',
    action: 'Select "Add to Favorites"',
    unknowns: ['The "View previous version" result is not shown.'],
  });
});

test("leaves already-valid JSON unchanged", async () => {
  const { repairJsonStringQuotes } = await import("./json-repair.ts").catch(() => ({
    repairJsonStringQuotes: undefined,
  }));
  assert.equal(typeof repairJsonStringQuotes, "function");

  const valid = `{"title":"Item detail","evidenceIds":["S01","S02"],"confidence":0.99}`;
  assert.equal(repairJsonStringQuotes!(valid), valid);
});

test("does not mistake quoted prose followed by a comma for the end of an object value", async () => {
  const { repairJsonStringQuotes } = await import("./json-repair.ts").catch(() => ({
    repairJsonStringQuotes: undefined,
  }));
  assert.equal(typeof repairJsonStringQuotes, "function");

  const invalid = `{"instruction":"Choose "Edit", then save the item.","done":true}`;
  assert.equal(
    JSON.parse(repairJsonStringQuotes!(invalid)).instruction,
    'Choose "Edit", then save the item.',
  );
});
