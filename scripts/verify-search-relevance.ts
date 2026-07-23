import { readFile } from "node:fs/promises";
import pg from "pg";
import { createSearchService } from "../services/api/src/search.ts";
import { PostgresSearchStore } from "../src/searchStore.ts";
import { normalizeSearchRequest } from "../src/searchTypes.ts";

interface BenchmarkRow {
  id: string;
  category: string;
  query: string;
  filters?: Record<string, string[]>;
  expectedSourceIds: string[];
  excludedSourceIds?: string[];
}

const databaseUrl = process.env.SEARCH_VERIFICATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("SEARCH_VERIFICATION_DATABASE_URL or DATABASE_URL is required");
const rows = JSON.parse(
  await readFile("data/search-relevance-benchmark.json", "utf8"),
) as BenchmarkRow[];
const pool = new pg.Pool({ connectionString: databaseUrl });
const service = createSearchService({
  store: new PostgresSearchStore(pool),
  embedder: null,
});
const categories = new Map<string, { passed: number; total: number }>();
let passed = 0;
let exactFirst = true;

try {
  for (const row of rows) {
    const result = await service.search(normalizeSearchRequest({
      q: row.query,
      ...(row.filters ?? {}),
      limit: 24,
    }), { publishedOnly: true });
    const sourceIds = result.items.map(({ sourceId }) => sourceId);
    const excluded = row.excludedSourceIds ?? [];
    const leaked = excluded.find((sourceId) => sourceIds.includes(sourceId));
    if (leaked) throw new Error(`authorization benchmark ${row.id} exposed ${leaked}`);
    const rowPassed = row.expectedSourceIds.length === 0
      ? sourceIds.length === 0
      : sourceIds.slice(0, 5).some((sourceId) => row.expectedSourceIds.includes(sourceId));
    if (row.category === "exact" && sourceIds[0] !== row.expectedSourceIds[0]) {
      exactFirst = false;
    }
    const category = categories.get(row.category) ?? { passed: 0, total: 0 };
    category.total += 1;
    if (rowPassed) {
      passed += 1;
      category.passed += 1;
    }
    categories.set(row.category, category);
  }
} finally {
  await pool.end();
}

const overall = passed / rows.length;
const report = {
  overallTopFiveRecall: overall,
  exactFirst,
  passed,
  total: rows.length,
  categories: Object.fromEntries(
    [...categories].map(([category, value]) => [
      category,
      { ...value, recall: value.passed / value.total },
    ]),
  ),
};
console.log(JSON.stringify(report));
if (overall < 0.85 || !exactFirst) process.exitCode = 1;
