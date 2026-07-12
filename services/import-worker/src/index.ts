import { consumeJobs } from "../../../src/queue.ts";
import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createPipelineHandler } from "./pipeline.ts";
import { startImportWorker } from "./start.ts";

await startImportWorker({
  assertMigrations: () => assertMigrationsCurrent(pool),
  consume: async () => {
    console.log("[import-worker] Waiting for jobs...");
    await consumeJobs(createPipelineHandler());
  },
});
