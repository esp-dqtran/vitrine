import { createHash } from "node:crypto";
import type { DesignSystemSnapshot } from "./designSystem.ts";
import type { GetDesignAppMapping } from "./getdesignCatalog.ts";
import { parseGetDesignMarkdown } from "./getdesignParser.ts";
import type { ReplaceImportedDesignSystemInput } from "./getdesignImportStore.ts";

export type GetDesignImportOptions =
  | { mode: "dry-run" }
  | { mode: "apply" }
  | { mode: "rollback"; app: string };

export interface GetDesignImportResult {
  sourceSlug: string;
  app: string;
  sourceHash?: string;
  status: "valid" | "applied" | "unchanged" | "failed" | "rolled_back";
  createdPlatform?: boolean;
  historyId?: string;
  error?: string;
}

export interface GetDesignImportReport {
  mode: GetDesignImportOptions["mode"];
  runId: string;
  expected: number;
  valid: number;
  applied: number;
  unchanged: number;
  failed: number;
  results: GetDesignImportResult[];
}

interface Dependencies {
  mappings: readonly GetDesignAppMapping[];
  readTemplate(sourceSlug: string): Promise<string>;
  inspectTarget(mapping: GetDesignAppMapping): Promise<{ appFound: boolean; webPlatformFound: boolean }>;
  replace(input: ReplaceImportedDesignSystemInput): Promise<{ historyId?: string; changed: boolean; createdPlatform: boolean }>;
  rollback(app: string): Promise<{ historyId: string }>;
  now(): Date;
  runId(): string;
}

export function parseGetDesignImportArgs(args: string[]): GetDesignImportOptions {
  const modes = ["--dry-run", "--apply", "--rollback"].filter((mode) => args.includes(mode));
  if (modes.length !== 1) throw new Error("Choose exactly one mode: --dry-run, --apply, or --rollback <app>");
  if (modes[0] === "--dry-run") return { mode: "dry-run" };
  if (modes[0] === "--apply") return { mode: "apply" };
  const index = args.indexOf("--rollback");
  const app = args[index + 1]?.trim();
  if (!app || app.startsWith("--")) throw new Error("--rollback requires a mapped app name");
  return { mode: "rollback", app };
}

export function redactImportError(error: unknown, databaseUrl: string): string {
  let message = error instanceof Error ? error.message : "GetDesign import failed";
  const secrets = new Set([databaseUrl]);
  try {
    const parsed = new URL(databaseUrl);
    secrets.add(decodeURIComponent(parsed.username));
    secrets.add(decodeURIComponent(parsed.password));
  } catch {
    // Invalid URLs are reported by connection configuration before import work starts.
  }
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join("[redacted]");
  }
  return message;
}

export async function runGetDesignImport(
  options: GetDesignImportOptions,
  dependencies: Dependencies,
): Promise<GetDesignImportReport> {
  const runId = dependencies.runId();
  if (options.mode === "rollback") {
    const mapping = dependencies.mappings.find(({ app }) => app === options.app);
    if (!mapping) throw new Error(`Rollback app is not mapped: ${options.app}`);
    try {
      const result = await dependencies.rollback(options.app);
      return { mode: "rollback", runId, expected: 1, valid: 1, applied: 0, unchanged: 0, failed: 0,
        results: [{ sourceSlug: mapping.sourceSlug, app: mapping.app, status: "rolled_back", historyId: result.historyId }] };
    } catch (error) {
      return { mode: "rollback", runId, expected: 1, valid: 0, applied: 0, unchanged: 0, failed: 1,
        results: [{ sourceSlug: mapping.sourceSlug, app: mapping.app, status: "failed", error: redactImportError(error, "") }] };
    }
  }

  const prepared = await Promise.all(dependencies.mappings.map(async (mapping) => {
    try {
      const markdown = await dependencies.readTemplate(mapping.sourceSlug);
      const sourceHash = createHash("sha256").update(markdown).digest("hex");
      const snapshot = parseGetDesignMarkdown(markdown, mapping.app, dependencies.now().toISOString());
      const target = await dependencies.inspectTarget(mapping);
      if (!target.appFound) throw new Error(`Mapped app not found: ${mapping.app}`);
      if (!target.webPlatformFound && !mapping.createWebPlatform) {
        throw new Error(`Mapped app web platform is missing: ${mapping.app}`);
      }
      return { mapping, sourceHash, snapshot, createdPlatform: !target.webPlatformFound };
    } catch (error) {
      return { mapping, error: redactImportError(error, "") };
    }
  }));

  const results: GetDesignImportResult[] = [];
  for (const item of prepared) {
    if ("error" in item) {
      results.push({ sourceSlug: item.mapping.sourceSlug, app: item.mapping.app, status: "failed", error: item.error });
      continue;
    }
    if (options.mode === "dry-run") {
      results.push({ sourceSlug: item.mapping.sourceSlug, app: item.mapping.app, sourceHash: item.sourceHash,
        status: "valid", createdPlatform: item.createdPlatform });
      continue;
    }
    try {
      const replaced = await dependencies.replace({
        runId, app: item.mapping.app, platform: "web", sourceSlug: item.mapping.sourceSlug,
        sourceHash: item.sourceHash, snapshot: item.snapshot as DesignSystemSnapshot,
        allowCreateWebPlatform: Boolean(item.mapping.createWebPlatform),
      });
      results.push({ sourceSlug: item.mapping.sourceSlug, app: item.mapping.app, sourceHash: item.sourceHash,
        status: replaced.changed ? "applied" : "unchanged", createdPlatform: replaced.createdPlatform,
        historyId: replaced.historyId });
    } catch (error) {
      results.push({ sourceSlug: item.mapping.sourceSlug, app: item.mapping.app, sourceHash: item.sourceHash,
        status: "failed", error: redactImportError(error, "") });
    }
  }
  return {
    mode: options.mode, runId, expected: dependencies.mappings.length,
    valid: results.filter(({ status }) => status !== "failed").length,
    applied: results.filter(({ status }) => status === "applied").length,
    unchanged: results.filter(({ status }) => status === "unchanged").length,
    failed: results.filter(({ status }) => status === "failed").length,
    results,
  };
}
