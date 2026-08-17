import assert from "node:assert/strict";
import test from "node:test";
import { createThreadsCaption, generateDailyThreadsPalette } from "./threadsMarketing.ts";

test("daily palettes are deterministic, role ordered, and readable", () => {
  const palette = generateDailyThreadsPalette("2026-08-16");
  assert.deepEqual(palette, generateDailyThreadsPalette("2026-08-16"));
  assert.deepEqual(palette.colors.map((color) => color.role), ["anchor", "accent", "companion"]);
  assert.deepEqual(palette.colors.map((color) => color.foreground), ["#FFFFFF", "#FFFFFF", "#151311"]);
  assert.ok(palette.colors.every((color) => /^#[0-9A-F]{6}$/.test(color.hex)));
});

test("caption exposes color names and hex values", () => {
  const palette = generateDailyThreadsPalette("2026-08-16");
  const caption = createThreadsCaption(palette);
  for (const color of palette.colors) {
    assert.match(caption, new RegExp(color.name));
    assert.match(caption, new RegExp(color.hex));
  }
});
