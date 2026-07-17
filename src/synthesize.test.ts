import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBatchPrompt, chunk, pairUp } from "./synthesize.ts";
import { buildMergePrompt } from "./prompt.ts";
import type { DesignSystemSnapshot } from "./designSystem.ts";

const image = (image_url: string, description: string) => ({
  id: 1,
  app: "linear",
  platform: "web",
  image_url,
  description,
});

test("labels every screen description with its evidence image id", () => {
  const prompt = buildBatchPrompt("web", "", [image("https://cdn.example.com/a.png", "A blue button, #5E6AD2.")]);
  assert.match(prompt, /image_id=1/);
  assert.match(prompt, /A blue button, #5E6AD2\./);
});

test("later batches feed the structured snapshot back for deduplication", () => {
  const previous = JSON.stringify({ tokens: [], components: [], flows: [] });
  const prompt = buildBatchPrompt("web", previous, [image("https://cdn.example.com/b.png", "A gray badge.")]);
  assert.match(prompt, /existing structured snapshot/);
  assert.match(prompt, /"components":\[\]/);
});

test("chunk splits into groups of the given size, with a short final group", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test("pairUp pairs items for a merge round, passing an odd one out through alone", () => {
  assert.deepEqual(pairUp([1, 2, 3, 4]), [[1, 2], [3, 4]]);
  assert.deepEqual(pairUp([1, 2, 3]), [[1, 2], [3, undefined]]);
});

const snapshot = (id: string, evidence: number[]): DesignSystemSnapshot => ({
  app: "linear",
  generatedAt: "2026-07-10T00:00:00.000Z",
  tokens: [{ id, kind: "color", name: "Accent", value: "#5E6AD2", role: "primary action", evidence }],
  components: [],
  flows: [],
});

test("merge prompt includes both snapshots and asks for evidence to be unioned, not duplicated", () => {
  const prompt = buildMergePrompt("web", snapshot("accent-a", [1]), snapshot("accent-b", [2]));
  assert.match(prompt, /union their "evidence" arrays/);
  assert.match(prompt, /"id":"accent-a"/);
  assert.match(prompt, /"id":"accent-b"/);
});
