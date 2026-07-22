import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { databasePoolOptions } from "../src/dbPoolConfig.ts";
import { GETDESIGN_APP_MAPPINGS } from "../src/getdesignCatalog.ts";
import { parseGetDesignImportArgs, redactImportError, runGetDesignImport } from "../src/getdesignImportRunner.ts";
import { inspectGetDesignTarget, replaceImportedDesignSystem, rollbackImportedDesignSystem } from "../src/getdesignImportStore.ts";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("getdesign/package.json"));

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: databaseUrl, ...databasePoolOptions(process.env), max: 2 });
  try {
    const report = await runGetDesignImport(parseGetDesignImportArgs(process.argv.slice(2)), {
      mappings: GETDESIGN_APP_MAPPINGS,
      readTemplate: (slug) => readFile(join(packageRoot, "templates", `${slug}.md`), "utf8"),
      inspectTarget: (mapping) => inspectGetDesignTarget(pool, mapping),
      replace: (input) => replaceImportedDesignSystem(pool, input),
      rollback: (app) => rollbackImportedDesignSystem(pool, app),
      now: () => new Date(),
      runId: () => randomUUID(),
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(redactImportError(error, process.env.DATABASE_URL ?? ""));
    process.exitCode = 1;
  });
}
