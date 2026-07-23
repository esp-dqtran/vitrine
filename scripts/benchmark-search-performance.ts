import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createSearchService } from "../services/api/src/search.ts";
import { PostgresSearchStore } from "../src/searchStore.ts";
import { normalizeSearchRequest } from "../src/searchTypes.ts";

interface BenchmarkRow {
  query: string;
  filters?: Record<string, string[]>;
}

const databaseUrl = process.env.SEARCH_VERIFICATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("SEARCH_VERIFICATION_DATABASE_URL or DATABASE_URL is required");
const rows = JSON.parse(
  await readFile("data/search-relevance-benchmark.json", "utf8"),
) as BenchmarkRow[];
const pool = new pg.Pool({ connectionString: databaseUrl });
const store = new PostgresSearchStore(pool);
const service = createSearchService({ store, embedder: null });
const searchLatencies: number[] = [];
const suggestionLatencies: number[] = [];
const samples = 100;

function metrics(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (value: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
  return {
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    max: Number(sorted.at(-1)!.toFixed(2)),
  };
}

try {
  for (let index = 0; index < samples; index += 1) {
    const row = rows[index % rows.length];
    const started = performance.now();
    await service.search(normalizeSearchRequest({
      q: row.query,
      ...(row.filters ?? {}),
      limit: 24,
    }), { publishedOnly: true });
    searchLatencies.push(performance.now() - started);
  }
  for (let index = 0; index < samples; index += 1) {
    const row = rows[index % rows.length];
    const prefix = row.query.slice(0, Math.max(2, Math.min(8, row.query.length)));
    const started = performance.now();
    await service.suggest(prefix, { publishedOnly: true }, 10);
    suggestionLatencies.push(performance.now() - started);
  }
  const counts = await pool.query<{ entity_type: string; count: number }>(
    `SELECT entity_type, count(*)::integer AS count
     FROM search_documents WHERE index_version = 1 GROUP BY entity_type ORDER BY entity_type`,
  );
  const report = {
    samples,
    search: metrics(searchLatencies),
    suggestions: metrics(suggestionLatencies),
    documentCounts: Object.fromEntries(
      counts.rows.map(({ entity_type, count }) => [entity_type, count]),
    ),
  };
  console.log(JSON.stringify(report));
  if (report.search.p95 >= 750 || report.suggestions.p95 >= 250) process.exitCode = 1;
} finally {
  await pool.end();
}
