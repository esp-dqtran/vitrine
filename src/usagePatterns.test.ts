import { test } from "node:test";
import assert from "node:assert/strict";
import { usagePatternSummary } from "./usagePatterns.ts";

test("summarizes a Markdown table from its first data row", () => {
  assert.equal(usagePatternSummary(`| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Collapse the navigation and stack cards. |
| Desktop | > 1024px | Show the full navigation. |`), "Mobile — < 768px — Collapse the navigation and stack cards.");
});

test("summarizes numbered guidance without returning only the list marker", () => {
  assert.equal(usagePatternSummary(`1. Focus on one component at a time.
2. Validate it in both themes.`), "Focus on one component at a time.");
});
