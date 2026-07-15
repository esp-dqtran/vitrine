import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBatchPrompt } from "./synthesize.ts";

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
