import { pathToFileURL } from "node:url";
import {
  createDatabaseBackup,
  redactRecoveryError,
  type CreateDatabaseBackupOptions,
  type DatabaseBackupResult,
} from "../src/dbRecovery.ts";

function optionalTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error("DB_TOOL_TIMEOUT_MS must be a positive integer");
  }
  return timeout;
}

export function backupOptionsFromEnvironment(
  environment: NodeJS.ProcessEnv,
): CreateDatabaseBackupOptions {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const backupDirectory = environment.BACKUP_DIR?.trim();
  const basename = environment.BACKUP_BASENAME?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!backupDirectory) throw new Error("BACKUP_DIR is required");
  if (!basename) throw new Error("BACKUP_BASENAME is required");
  const timeoutMs = optionalTimeout(environment.DB_TOOL_TIMEOUT_MS);
  return {
    databaseUrl,
    backupDirectory,
    basename,
    ...(environment.RELEASE_ID?.trim() ? { releaseId: environment.RELEASE_ID.trim() } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

export async function runBackupCommand(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DatabaseBackupResult> {
  return createDatabaseBackup({
    ...backupOptionsFromEnvironment(environment),
    environment,
  });
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runBackupCommand()
    .then((result) => process.stdout.write(`${JSON.stringify({ status: "ok", ...result })}\n`))
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({
        status: "error",
        error: redactRecoveryError(error, process.env.DATABASE_URL ?? ""),
      })}\n`);
      process.exitCode = 1;
    });
}
