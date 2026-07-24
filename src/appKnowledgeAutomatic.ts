import type { AppKnowledgeJobView } from "./appKnowledgeStore.ts";
import {
  appKnowledgeQueueJob,
  type Job,
} from "./queue.ts";

const SHA256 = /^[0-9a-f]{64}$/;
const ACTIVE_TRANSPORT_STATUSES = new Set(["queued", "running"]);

export interface AutomaticAppKnowledgeTarget {
  app: string;
  platform: "ios" | "android" | "web";
  captureVersionId: number;
  sourceSha256: string;
  providerModel: string;
  promptVersion: number;
}

export interface AutomaticAppKnowledgeStore {
  findAutomaticJob(
    target: AutomaticAppKnowledgeTarget,
  ): Promise<AppKnowledgeJobView | undefined>;
  createAutomaticJob(
    target: AutomaticAppKnowledgeTarget,
    transportJobId: number,
  ): Promise<AppKnowledgeJobView>;
  listQueuedAutomaticJobs(limit: number): Promise<AppKnowledgeJobView[]>;
}

export type AutomaticTransportStatus =
  | "queued"
  | "running"
  | "done"
  | "error"
  | "cancelled";

export interface AutomaticAppKnowledgeDependencies {
  environment?: Record<string, string | undefined>;
  allowlist?: ReadonlySet<string>;
  store: AutomaticAppKnowledgeStore;
  createTransportJob(): Promise<number>;
  getTransportJob(
    transportJobId: number,
  ): Promise<{ status: AutomaticTransportStatus } | undefined>;
  setTransportJobStatus(
    transportJobId: number,
    status: AutomaticTransportStatus,
    message?: string,
  ): Promise<unknown>;
  publishJob(job: Job): Promise<void>;
}

export interface AutomaticAppKnowledgeConfig {
  enabled: boolean;
  allowlist: ReadonlySet<string>;
  promptVersion: number;
  designSystemChunkBytes: number;
  designSystemChunkConcurrency: number;
  flowSynthesisChunkBytes: number;
}

export type AutomaticAppKnowledgeResult =
  | { status: "disabled" }
  | { status: "excluded" }
  | {
      status: "ready";
      job: AppKnowledgeJobView;
      created: boolean;
      published: boolean;
    };

function target(input: AutomaticAppKnowledgeTarget): AutomaticAppKnowledgeTarget {
  if (
    !input.app.trim()
    || !["ios", "android", "web"].includes(input.platform)
    || !Number.isSafeInteger(input.captureVersionId)
    || input.captureVersionId <= 0
    || !SHA256.test(input.sourceSha256)
    || !input.providerModel.trim()
    || !Number.isSafeInteger(input.promptVersion)
    || input.promptVersion <= 0
  ) throw new Error("Invalid automatic App Knowledge target");
  return {
    ...input,
    app: input.app.trim(),
    providerModel: input.providerModel.trim(),
  };
}

function enabled(dependencies: AutomaticAppKnowledgeDependencies): boolean {
  return (dependencies.environment ?? process.env).APP_KNOWLEDGE_AUTO_GENERATE === "1";
}

export function automaticAppKnowledgeAllowlistFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): ReadonlySet<string> {
  const values = (environment.APP_KNOWLEDGE_AUTO_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of values) {
    if (!/^[^,\s:]+:(?:ios|android|web)$/.test(value)) {
      throw new Error(
        "Automatic App Knowledge allowlist entries must use app:platform",
      );
    }
  }
  return new Set(values);
}

function positiveEnvironmentInteger(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = environment[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

export function automaticAppKnowledgeConfigFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): AutomaticAppKnowledgeConfig {
  return {
    enabled: environment.APP_KNOWLEDGE_AUTO_GENERATE === "1",
    allowlist: automaticAppKnowledgeAllowlistFromEnvironment(environment),
    promptVersion: positiveEnvironmentInteger(
      environment,
      "APP_KNOWLEDGE_DESIGN_PROMPT_VERSION",
      2,
      10_000,
    ),
    designSystemChunkBytes: positiveEnvironmentInteger(
      environment,
      "APP_KNOWLEDGE_DESIGN_CHUNK_BYTES",
      24_000,
      2_000_000,
    ),
    designSystemChunkConcurrency: positiveEnvironmentInteger(
      environment,
      "APP_KNOWLEDGE_DESIGN_CHUNK_CONCURRENCY",
      3,
      16,
    ),
    flowSynthesisChunkBytes: positiveEnvironmentInteger(
      environment,
      "APP_KNOWLEDGE_FLOW_CHUNK_BYTES",
      24_000,
      2_000_000,
    ),
  };
}

function allowed(
  input: AutomaticAppKnowledgeTarget,
  dependencies: AutomaticAppKnowledgeDependencies,
): boolean {
  const allowlist = dependencies.allowlist
    ?? automaticAppKnowledgeAllowlistFromEnvironment(
      dependencies.environment ?? process.env,
    );
  return allowlist.has(`${input.app}:${input.platform}`);
}

async function publish(
  job: AppKnowledgeJobView,
  dependencies: AutomaticAppKnowledgeDependencies,
): Promise<void> {
  try {
    await dependencies.publishJob(
      appKnowledgeQueueJob(job.id, job.transportJobId),
    );
  } catch {
    await dependencies.setTransportJobStatus(
      job.transportJobId,
      "error",
      "App Knowledge queue publication failed",
    );
    throw new Error("App Knowledge queue publication failed");
  }
}

export async function ensureAutomaticAppKnowledgeJob(
  rawTarget: AutomaticAppKnowledgeTarget,
  dependencies: AutomaticAppKnowledgeDependencies,
): Promise<AutomaticAppKnowledgeResult> {
  if (!enabled(dependencies)) return { status: "disabled" };
  const checkedTarget = target(rawTarget);
  if (!allowed(checkedTarget, dependencies)) return { status: "excluded" };

  let durable = await dependencies.store.findAutomaticJob(checkedTarget);
  let created = false;
  if (!durable) {
    const transportJobId = await dependencies.createTransportJob();
    durable = await dependencies.store.createAutomaticJob(
      checkedTarget,
      transportJobId,
    );
    created = durable.transportJobId === transportJobId;
    if (!created) {
      await dependencies.setTransportJobStatus(
        transportJobId,
        "cancelled",
        "Superseded by concurrent automatic App Knowledge job",
      );
    }
  }

  const transport = await dependencies.getTransportJob(durable.transportJobId);
  if (transport && ACTIVE_TRANSPORT_STATUSES.has(transport.status)) {
    if (created) {
      await publish(durable, dependencies);
      return { status: "ready", job: durable, created, published: true };
    }
    return { status: "ready", job: durable, created, published: false };
  }

  await publish(durable, dependencies);
  return { status: "ready", job: durable, created, published: true };
}

export interface AutomaticAppKnowledgeReconciliation {
  examined: number;
  published: number;
  skipped: number;
  failed: number;
}

export interface CatalogAutomaticHandoffJob {
  slug: string;
  platform: "ios" | "android" | "web";
  status: string;
  repair?: unknown;
  finishedAt?: string;
}

export async function completeCatalogCrawlAndHandoff<
  T extends CatalogAutomaticHandoffJob,
>(input: {
  job: T;
  saveState(): void;
  log(message: string): void;
  handoff(): Promise<unknown>;
  now?: () => string;
}): Promise<{ warning?: string }> {
  delete input.job.repair;
  input.job.status = "done";
  input.job.finishedAt = (input.now ?? (() => new Date().toISOString()))();
  input.saveState();
  input.log(`Done: ${input.job.slug} (${input.job.platform})`);
  try {
    await input.handoff();
    return {};
  } catch {
    const warning = "Automatic analysis enqueue failed";
    input.log(warning);
    return { warning };
  }
}

export async function reconcileQueuedAppKnowledgeJobs(
  dependencies: AutomaticAppKnowledgeDependencies,
  limit = 50,
): Promise<AutomaticAppKnowledgeReconciliation> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Invalid automatic App Knowledge reconciliation limit");
  }
  const jobs = await dependencies.store.listQueuedAutomaticJobs(limit);
  const result: AutomaticAppKnowledgeReconciliation = {
    examined: jobs.length,
    published: 0,
    skipped: 0,
    failed: 0,
  };
  for (const job of jobs) {
    const transport = await dependencies.getTransportJob(job.transportJobId);
    if (transport && ACTIVE_TRANSPORT_STATUSES.has(transport.status)) {
      result.skipped++;
      continue;
    }
    try {
      await publish(job, dependencies);
      result.published++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
