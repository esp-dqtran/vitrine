import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("production App analysis wiring is Flow-only", () => {
  assert.match(source, /saveAnalyzedAppFlows/);
  assert.equal((source.match(/scope:\s*"flows"/g) ?? []).length, 2);

  const start = source.indexOf("const generateAppKnowledge =");
  const end = source.indexOf("\nconst bulkStorage", start);
  const wiring = source.slice(start, end);
  assert.match(wiring, /mode:\s*"flow-only"/);
  assert.match(wiring, /saveAnalyzedFlows:\s*saveAnalyzedAppFlows/);
  assert.doesNotMatch(wiring, /screenConcurrency|designSystemChunkBytes|designSystemChunkConcurrency/);
});
