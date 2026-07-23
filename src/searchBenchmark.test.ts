import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("search benchmark covers every release category", async () => {
  const rows = JSON.parse(
    await readFile("data/search-relevance-benchmark.json", "utf8"),
  ) as Array<{
    id: string;
    category: string;
    query: string;
    expectedSourceIds: string[];
  }>;
  const categories = new Set(rows.map(({ category }) => category));
  assert.deepEqual([...categories].sort(), [
    "ambiguous",
    "authorization",
    "exact",
    "flow",
    "intent",
    "visible-text",
    "zero-result",
  ]);
  assert.equal(rows.length >= 35, true);
  assert.ok(rows.every(({ id, query, expectedSourceIds }) =>
    id && typeof query === "string" && Array.isArray(expectedSourceIds)));
});

test("search release surfaces keep bounded SQL and accessible interaction contracts", async () => {
  const [store, page, card, css] = await Promise.all([
    readFile("src/searchStore.ts", "utf8"),
    readFile("src/vitrine/components/AdvancedSearchPage.tsx", "utf8"),
    readFile("src/vitrine/components/SearchResultCard.tsx", "utf8"),
    readFile("src/vitrine/styles.css", "utf8"),
  ]);
  assert.match(store, /LIMIT 240/);
  assert.match(store, /Math\.min\(10/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /role="combobox"/);
  assert.match(page, /aria-current=/);
  assert.match(card, /aria-label=\{`Preview/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /advanced-search-preview/);
  assert.match(css, /advanced-search-drawer/);
  assert.match(css, /advanced-search-comparison-tray/);
});
