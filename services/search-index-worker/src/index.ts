import { hostname } from "node:os";
import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { advancedSearchConfigFromEnv } from "../../../src/searchConfig.ts";
import { OpenAICompatibleSearchEmbeddingProvider } from "../../../src/searchEmbedding.ts";
import { PostgresSearchIndexStore } from "../../../src/searchIndexStore.ts";
import { processSearchIndexJob } from "./pipeline.ts";
import { runSearchIndexLoop, startSearchIndexWorker } from "./start.ts";

const workerId = process.env.SEARCH_INDEX_WORKER_ID?.trim()
  || `${hostname()}-${process.pid}`;
const config = advancedSearchConfigFromEnv(process.env);
const embedder = config.embedding
  ? new OpenAICompatibleSearchEmbeddingProvider(config.embedding)
  : null;
const store = new PostgresSearchIndexStore(pool);
const controller = new AbortController();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => controller.abort());
}

await startSearchIndexWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  run: () => runSearchIndexLoop({
    signal: controller.signal,
    claim: () => store.claim(workerId),
    process: async (job) => {
      try {
        const report = await processSearchIndexJob({
          job,
          store,
          embedder,
          signal: controller.signal,
        });
        console.log(JSON.stringify({ event: "search_index_completed", ...report }));
      } catch (error) {
        console.error(JSON.stringify({
          event: "search_index_failed",
          appId: job.appId,
          platform: job.platform,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
  }),
});

await pool.end();
