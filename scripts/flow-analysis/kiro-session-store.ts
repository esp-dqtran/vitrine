import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

type SessionRow = {
  conversation_id: string;
  created_at: number;
  updated_at: number;
  final_response: string | null;
  usage_info: string | null;
  model_id: string | null;
};

export type KiroSessionResult = {
  conversationId: string;
  finalResponse: string;
  model: string;
  usage: {
    credits?: number;
    elapsed?: string;
  };
  generatedAt: string;
};

function quoted(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function creditsFromUsageInfo(value: string | null): number | undefined {
  if (!value) return undefined;
  const items = JSON.parse(value) as Array<{ value?: unknown; unit?: unknown }>;
  const credits = items
    .filter((item) => item.unit === "credit" && typeof item.value === "number")
    .reduce((total, item) => total + Number(item.value), 0);
  return credits > 0 ? Math.round(credits * 100) / 100 : undefined;
}

export function elapsedLabel(createdAt: number, updatedAt: number): string | undefined {
  const seconds = Math.max(0, Math.round((updatedAt - createdAt) / 1000));
  if (!seconds) return undefined;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export async function findKiroSessionResult(input: {
  cwd: string;
  marker: string;
  startedAfter?: number;
  databasePath?: string;
}): Promise<KiroSessionResult | undefined> {
  const databasePath = input.databasePath
    ?? join(homedir(), "Library", "Application Support", "kiro-cli", "data.sqlite3");
  const lowerBound = input.startedAfter === undefined
    ? ""
    : ` AND updated_at >= ${Math.max(0, Math.floor(input.startedAfter - 60_000))}`;
  const sql = `SELECT
      conversation_id,
      created_at,
      updated_at,
      json_extract(value, '$.transcript[#-1]') AS final_response,
      json_extract(value, '$.user_turn_metadata.usage_info') AS usage_info,
      json_extract(value, '$.model_info.model_id') AS model_id
    FROM conversations_v2
    WHERE key = ${quoted(input.cwd)}
      AND value LIKE ${quoted(`%${input.marker}%`)}
      ${lowerBound}
    ORDER BY updated_at DESC
    LIMIT 3`;
  const { stdout } = await executeFile(
    "sqlite3",
    ["-readonly", "-json", databasePath, sql],
    { maxBuffer: 4_000_000 },
  );
  const rows = JSON.parse(stdout || "[]") as SessionRow[];
  const row = rows.find(({ final_response: response }) =>
    typeof response === "string" && response.trim().startsWith("{")
  );
  if (!row?.final_response) return undefined;
  return {
    conversationId: row.conversation_id,
    finalResponse: row.final_response,
    model: row.model_id ?? "gpt-5.6-terra",
    usage: {
      ...(creditsFromUsageInfo(row.usage_info) === undefined
        ? {}
        : { credits: creditsFromUsageInfo(row.usage_info) }),
      ...(elapsedLabel(row.created_at, row.updated_at) === undefined
        ? {}
        : { elapsed: elapsedLabel(row.created_at, row.updated_at) }),
    },
    generatedAt: new Date(row.updated_at).toISOString(),
  };
}
