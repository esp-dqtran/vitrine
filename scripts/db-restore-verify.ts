import { pathToFileURL } from "node:url";
import {
  redactRecoveryError,
  verifyDatabaseRestore,
  type DatabaseRestoreResult,
  type VerifyDatabaseRestoreOptions,
} from "../src/dbRecovery.ts";

function optionalTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error("DB_TOOL_TIMEOUT_MS must be a positive integer");
  }
  return timeout;
}

export function restoreOptionsFromArguments(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): VerifyDatabaseRestoreOptions {
  if (args.length !== 2 || !args[0]?.trim() || !args[1]?.trim()) {
    throw new Error("Dump path and target URL are required");
  }
  const timeoutMs = optionalTimeout(environment.DB_TOOL_TIMEOUT_MS);
  return {
    dumpPath: args[0],
    targetUrl: args[1],
    environment,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

export async function runRestoreCommand(
  args: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DatabaseRestoreResult> {
  return verifyDatabaseRestore(restoreOptionsFromArguments(args, environment));
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const targetUrl = process.argv[3] ?? "";
  runRestoreCommand()
    .then((result) => process.stdout.write(`${JSON.stringify({ status: "ok", ...result })}\n`))
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({
        status: "error",
        error: redactRecoveryError(error, targetUrl),
      })}\n`);
      process.exitCode = 1;
    });
}
