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

function allowed(
  input: AutomaticAppKnowledgeTarget,
  dependencies: AutomaticAppKnowledgeDependencies,
): boolean {
  if (!dependencies.allowlist) return true;
  return dependencies.allowlist.has(input.app)
    || dependencies.allowlist.has(`${input.app}/${input.platform}`);
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
