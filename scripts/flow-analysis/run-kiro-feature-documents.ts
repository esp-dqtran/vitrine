import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  createJob,
  flowEvidenceImages,
  getVersionFlowsById,
  listAppVersions,
  pool,
  query,
  setJobStatus,
} from "../../src/db.ts";
import type { DesignFlow } from "../../src/designSystem.ts";
import {
  featureEvidenceManifestSha256,
  type FeatureEvidenceManifestItem,
  type FeatureSourceFlow,
} from "../../src/featureDocument.ts";
import { createFeatureDocumentService } from "../../src/featureDocumentService.ts";
import { createFeatureDocumentStore } from "../../src/featureDocumentStore.ts";
import {
  createKiroCliFeatureDocumentProvider,
  runKiroCli,
  type KiroCliInvocation,
} from "../../src/kiroCliFeatureDocumentProvider.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../src/objectStoreConfig.ts";
import { imageObjectById } from "../../src/objectStoreDb.ts";

const PROMPT_VERSION = 13;

type PreparedFlow = {
  flow: DesignFlow;
  source: FeatureSourceFlow;
  manifest: FeatureEvidenceManifestItem[];
  checksum: string;
};

type CompletedFlow = {
  flowId: string;
  title: string;
  documentId: number;
  revisionId: number;
  revisionNumber: number;
  evidenceCount: number;
  visibility: "private" | "catalog";
};

type Failure = {
  flowId: string;
  title: string;
  error: string;
};

type Progress = {
  schemaVersion: 1;
  app: string;
  platform: "ios" | "android" | "web";
  version: number;
  model: string;
  effort: string;
  analysisMode: "whole-flow" | "per-image";
  officialDocumentation: boolean;
  officialDomains: string[];
  workers: number;
  status: "running" | "done" | "error";
  selected: Array<{ flowId: string; title: string; evidenceCount: number }>;
  active: string[];
  completed: CompletedFlow[];
  failed: Failure[];
  credits: number;
  startedAt: string;
  updatedAt: string;
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function commaSeparatedArgument(name: string): string[] | undefined {
  const value = argument(name)?.trim();
  if (!value) return undefined;
  const items = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (items.some((item) => !/^[a-z0-9-]{1,240}$/i.test(item))) {
    throw new Error(`${name} contains an invalid Flow ID`);
  }
  return items;
}

function commaSeparatedDomains(name: string): string[] {
  const value = argument(name)?.trim();
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function platform(value: string | undefined): "ios" | "android" | "web" {
  if (value === undefined || value === "ios") return "ios";
  if (value === "android" || value === "web") return value;
  throw new Error("--platform must be ios, android, or web");
}

function visibility(value: string | undefined): "private" | "catalog" {
  if (value === undefined || value === "catalog") return "catalog";
  if (value === "private") return "private";
  throw new Error("--visibility must be private or catalog");
}

function credits(output: string): number {
  const plain = output.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g,
    "",
  );
  const match = plain.match(/Credits:\s*([\d.]+)/i);
  return match ? Number(match[1]) : 0;
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function evidenceCount(flow: DesignFlow): number {
  return flow.steps.reduce((total, step) => total + step.evidence.length, 0);
}

function representativeFlows(flows: DesignFlow[], limit: number): DesignFlow[] {
  const eligible = flows
    .filter((flow) => evidenceCount(flow) > 0 && evidenceCount(flow) <= 12)
    .sort((left, right) =>
      evidenceCount(left) - evidenceCount(right)
      || left.title.localeCompare(right.title)
      || left.id.localeCompare(right.id)
    );
  if (eligible.length <= limit) return eligible;
  if (limit === 1) return [eligible[Math.floor(eligible.length / 2)]];
  const selected: DesignFlow[] = [];
  const identities = new Set<string>();
  for (let index = 0; index < limit; index += 1) {
    const candidate = eligible[Math.round(index * (eligible.length - 1) / (limit - 1))];
    if (!identities.has(candidate.id)) {
      identities.add(candidate.id);
      selected.push(candidate);
    }
  }
  return selected;
}

async function prepareFlow(input: {
  app: string;
  platform: "ios" | "android" | "web";
  versionId: number;
  versionNumber: number;
  flow: DesignFlow;
}): Promise<PreparedFlow | undefined> {
  const imageIds = input.flow.steps.flatMap(({ evidence }) => evidence);
  const images = await flowEvidenceImages({
    app: input.app,
    platform: input.platform,
    versionNumber: input.versionNumber,
    imageIds,
    publishedOnly: false,
  });
  const imageById = new Map(images.map((image) => [Number(image.id), image]));
  const manifest: FeatureEvidenceManifestItem[] = [];
  for (const [stepIndex, step] of input.flow.steps.entries()) {
    for (const [imageIndex, imageId] of step.evidence.entries()) {
      const image = imageById.get(imageId);
      if (!image || !await imageObjectById(imageId)) return undefined;
      manifest.push({
        stepIndex,
        imageIndex,
        imageId,
        evidenceId: `FLOW-STEP-${String(stepIndex + 1).padStart(2, "0")}-IMAGE-${imageId}`,
        stepLabel: step.label,
        ...(step.interaction ? { interaction: step.interaction } : {}),
        description: image.description,
        ...(image.captured_at ? { capturedAt: new Date(image.captured_at).toISOString() } : {}),
      });
    }
  }
  const source: FeatureSourceFlow = {
    app: input.app,
    platform: input.platform,
    versionId: input.versionId,
    flowId: input.flow.id,
    title: input.flow.title,
    description: input.flow.description,
    ...(input.flow.category ? { category: input.flow.category } : {}),
    tags: input.flow.tags,
  };
  return {
    flow: input.flow,
    source,
    manifest,
    checksum: featureEvidenceManifestSha256(manifest),
  };
}

async function main(): Promise<void> {
  const app = argument("--app") ?? "amazon-shopping";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("Invalid --app");
  const targetPlatform = platform(argument("--platform"));
  const targetVisibility = visibility(argument("--visibility"));
  const versionNumber = positiveInteger(argument("--version"), 1, "--version");
  const limit = positiveInteger(argument("--limit"), 10, "--limit");
  const workers = positiveInteger(argument("--workers"), 3, "--workers");
  const timeoutMs = positiveInteger(argument("--timeout-ms"), 180_000, "--timeout-ms");
  const requestedFlowIds = commaSeparatedArgument("--flow-ids");
  const model = argument("--model") ?? "gpt-5.6-terra";
  const effort = argument("--effort") ?? "high";
  const officialDomains = commaSeparatedDomains("--official-domains");
  const officialDocumentation = process.argv.includes("--official-docs")
    || officialDomains.length > 0;
  let measuredCredits = 0;
  const meteredRunner = async (invocation: KiroCliInvocation): Promise<string> => {
    const output = await runKiroCli(invocation);
    measuredCredits += credits(output);
    return output;
  };
  const provider = createKiroCliFeatureDocumentProvider({
    ...process.env,
    KIRO_CLI_FEATURE_DOCUMENT_MODEL: model,
    KIRO_CLI_FEATURE_DOCUMENT_EFFORT: effort,
    KIRO_CLI_FEATURE_DOCUMENT_CWD: process.cwd(),
    KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION: officialDocumentation ? "true" : "false",
    KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS: officialDomains.join(","),
  }, meteredRunner);
  if (!provider) throw new Error("Kiro CLI Feature Document provider is disabled");
  const outputRoot = resolve(
    argument("--output")
      ?? join("data", "feature-descriptions", app, "kiro-feature-documents"),
  );
  const progressPath = join(outputRoot, "progress.json");
  const versions = await listAppVersions(app, targetPlatform, false);
  const version = versions.find(({ version_number }) => version_number === versionNumber);
  if (!version) throw new Error(`Version ${versionNumber} was not found for ${app}/${targetPlatform}`);
  const flows = await getVersionFlowsById({
    app,
    platform: targetPlatform,
    versionId: version.id,
  });
  const existingCatalog = await query<{ source_flow_id: string }>(
    `SELECT d.source_flow_id
     FROM feature_documents d
     JOIN feature_document_revisions r ON r.id = d.current_revision_id
     JOIN apps a ON a.id = d.app_id
     JOIN platforms p ON p.id = d.platform_id
     WHERE d.visibility = 'catalog' AND a.name = $1 AND p.name = $2
       AND r.source_version_id = $3 AND r.provider_model = $4
       AND r.prompt_version = $5`,
    [app, targetPlatform, version.id, provider.model, PROMPT_VERSION],
  );
  const completedCatalogFlowIds = new Set(existingCatalog.rows.map(({ source_flow_id }) => source_flow_id));
  const selectedFlows = requestedFlowIds
    ? requestedFlowIds.map((flowId) => {
      const flow = flows.find(({ id }) => id === flowId);
      if (!flow) throw new Error(`Flow ${flowId} was not found`);
      return flow;
    })
    : representativeFlows(
      flows.filter(({ id }) => !completedCatalogFlowIds.has(id)),
      limit,
    );
  const prepared = (await Promise.all(selectedFlows.map((flow) => prepareFlow({
    app,
    platform: targetPlatform,
    versionId: version.id,
    versionNumber,
    flow,
  })))).filter((item): item is PreparedFlow => item !== undefined);
  const expectedCount = selectedFlows.length;
  if (prepared.length !== expectedCount) {
    throw new Error(`Only ${prepared.length}/${expectedCount} selected Flows have complete object-backed evidence`);
  }
  const user = await query<{ id: number }>(
    "SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1",
    ["admin"],
  );
  const userId = Number(user.rows[0]?.id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("An admin user is required");

  const store = createFeatureDocumentStore();
  const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const service = createFeatureDocumentService({
    store,
    provider,
    objectStore,
    imageObjectById,
    timeoutMs,
    currentSourceManifest: async (source) => {
      const currentFlow = flows.find(({ id }) => id === source.flowId);
      if (!currentFlow) throw new Error("Feature source Flow is no longer available");
      const current = await prepareFlow({
        app: source.app,
        platform: source.platform,
        versionId: source.versionId ?? version.id,
        versionNumber,
        flow: currentFlow,
      });
      if (!current) throw new Error("Feature source evidence is no longer available");
      return { sha256: current.checksum };
    },
  });
  const startedAt = new Date().toISOString();
  const progress: Progress = {
    schemaVersion: 1,
    app,
    platform: targetPlatform,
    version: versionNumber,
    model: provider.model,
    effort,
    analysisMode: provider.analyzeFlow ? "whole-flow" : "per-image",
    officialDocumentation: Boolean(provider.officialDocumentationEnabled),
    officialDomains: [...(provider.officialDocumentationDomains ?? [])],
    workers,
    status: "running",
    selected: prepared.map((item) => ({
      flowId: item.source.flowId,
      title: item.source.title,
      evidenceCount: item.manifest.length,
    })),
    active: [],
    completed: [],
    failed: [],
    credits: 0,
    startedAt,
    updatedAt: startedAt,
  };
  await atomicJson(progressPath, progress);
  let progressWrite = Promise.resolve();
  const updateProgress = async (): Promise<void> => {
    progress.credits = Math.round(measuredCredits * 100) / 100;
    progress.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(progress);
    progressWrite = progressWrite.then(() => atomicJson(progressPath, snapshot));
    await progressWrite;
  };
  let cursor = 0;
  const worker = async (workerId: number): Promise<void> => {
    while (cursor < prepared.length) {
      const item = prepared[cursor];
      cursor += 1;
      progress.active.push(item.source.flowId);
      await updateProgress();
      let transportJobId: number | undefined;
      try {
        transportJobId = await createJob("generate-feature-document", {
          provider: provider.model,
          sourceFlowId: item.source.flowId,
          directBatch: true,
        });
        const existing = await query<{
          id: number;
          job_id: number | null;
          job_status: string | null;
          job_provider_model: string | null;
          job_prompt_version: number | null;
          job_manifest_sha256: string | null;
          visibility: "private" | "catalog";
        }>(
          `SELECT d.id, d.visibility, latest_job.id AS job_id, latest_job.status AS job_status,
                  latest_job.provider_model AS job_provider_model,
                  latest_job.prompt_version AS job_prompt_version,
                  latest_job.evidence_manifest_sha256 AS job_manifest_sha256
           FROM feature_documents d
           JOIN apps a ON a.id = d.app_id
           JOIN platforms p ON p.id = d.platform_id
           LEFT JOIN LATERAL (
             SELECT j.id, j.status, j.provider_model, j.prompt_version,
                    j.evidence_manifest_sha256
             FROM feature_document_jobs j
             WHERE j.document_id = d.id
             ORDER BY j.created_at DESC, j.id DESC
             LIMIT 1
           ) latest_job ON true
           WHERE (d.user_id = $1 OR d.visibility = 'catalog')
             AND a.name = $2 AND p.name = $3 AND d.source_flow_id = $4
           ORDER BY d.updated_at DESC, d.id DESC LIMIT 1`,
          [userId, app, targetPlatform, item.source.flowId],
        );
        const generationInput = {
          transportJobId,
          source: item.source,
          evidenceManifest: item.manifest,
          evidenceManifestSha256: item.checksum,
          focusInstruction: [
            "Create an evidence-backed replication Feature Document for this Flow.",
            "Requirements must describe only current behavior supported by screenshots or explicit interaction metadata.",
            "Keep inferred behavior, proposed improvements, and unknowns visibly separate.",
            "Do not invent destinations, persistence, APIs, error handling, accessibility behavior, analytics, or product priority.",
            "Account for every source screenshot in implementation requirements or explicitly explain why it is unscoped.",
          ].join(" "),
          promptVersion: PROMPT_VERSION,
          providerModel: provider.model,
        };
        const existingDocumentId = existing.rows[0]?.id === undefined
          ? undefined
          : Number(existing.rows[0].id);
        const latest = existing.rows[0];
        const reusableJobId = latest
          && (latest.job_status === "error" || latest.job_status === "cancelled")
          && latest.job_provider_model === provider.model
          && latest.job_prompt_version === PROMPT_VERSION
          && latest.job_manifest_sha256 === item.checksum
          ? Number(latest.job_id)
          : undefined;
        const generation = await (async () => {
          if (latest?.visibility === "catalog" && existingDocumentId !== undefined) {
            const result = reusableJobId !== undefined
              ? await query<{ id: number; document_id: number }>(
                `UPDATE feature_document_jobs j
                 SET transport_job_id = $2, status = 'queued',
                     stage = CASE WHEN j.done_count > 0 THEN 'analyzing' ELSE 'preparing' END,
                     cancel_requested = false, error_code = NULL, error_message = NULL,
                     updated_at = now(), completed_at = NULL
                 FROM feature_documents d
                 WHERE j.id = $1 AND d.id = j.document_id AND d.visibility = 'catalog'
                   AND j.status IN ('error', 'cancelled')
                 RETURNING j.id, j.document_id`,
                [reusableJobId, generationInput.transportJobId],
              )
              : await query<{ id: number; document_id: number }>(
                `INSERT INTO feature_document_jobs
                   (document_id, transport_job_id, requested_by, total_count, source_version_id,
                    source_flow, evidence_manifest, evidence_manifest_sha256, focus_instruction,
                    prompt_version, provider_model)
                 SELECT d.id, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11
                 FROM feature_documents d
                 WHERE d.id = $1 AND d.visibility = 'catalog'
                 RETURNING id, document_id`,
                [
                  existingDocumentId,
                  generationInput.transportJobId,
                  userId,
                  generationInput.evidenceManifest.length,
                  generationInput.source.versionId ?? null,
                  JSON.stringify(generationInput.source),
                  JSON.stringify(generationInput.evidenceManifest),
                  generationInput.evidenceManifestSha256,
                  generationInput.focusInstruction,
                  generationInput.promptVersion,
                  generationInput.providerModel,
                ],
              );
            const row = result.rows[0];
            return row && { id: Number(row.id), documentId: Number(row.document_id) };
          }
          if (reusableJobId !== undefined) {
            return store.retryJob(userId, reusableJobId, transportJobId);
          }
          if (existingDocumentId === undefined) {
            return store.createGeneration(userId, generationInput);
          }
          return store.createRegeneration(userId, existingDocumentId, generationInput);
        })();
        if (!generation) throw new Error("Feature Document generation could not be created");
        const job = "job" in generation ? generation.job : generation;
        const documentId = "document" in generation ? generation.document.id : job.documentId;
        await setJobStatus(transportJobId, "running", `Kiro worker ${workerId}`);
        const status = await service.generate(String(job.id));
        if (status !== "done") throw new Error(`Feature Document job ended as ${status ?? "missing"}`);
        await setJobStatus(transportJobId, "done", "Kiro Feature Document generated");
        const document = await store.getDocument(userId, documentId);
        if (!document?.currentRevision) throw new Error("Generated Feature Document revision is missing");
        if (targetVisibility === "catalog") {
          await query(
            `UPDATE feature_documents
             SET user_id = NULL, visibility = 'catalog', updated_at = now()
             WHERE id = $1 AND current_revision_id = $2`,
            [documentId, document.currentRevision.id],
          );
        }
        progress.completed.push({
          flowId: item.source.flowId,
          title: item.source.title,
          documentId,
          revisionId: document.currentRevision.id,
          revisionNumber: document.currentRevision.revisionNumber,
          evidenceCount: item.manifest.length,
          visibility: targetVisibility,
        });
        console.log(JSON.stringify({
          event: "completed",
          worker: workerId,
          flowId: item.source.flowId,
          title: item.source.title,
          documentId,
          revisionId: document.currentRevision.id,
          evidenceCount: item.manifest.length,
        }));
      } catch (error) {
        if (transportJobId !== undefined) {
          await setJobStatus(
            transportJobId,
            "error",
            error instanceof Error ? error.message.slice(0, 500) : "Kiro generation failed",
          );
        }
        const failure = {
          flowId: item.source.flowId,
          title: item.source.title,
          error: error instanceof Error ? error.message.slice(0, 1_200) : String(error),
        };
        progress.failed.push(failure);
        console.error(JSON.stringify({ event: "failed", worker: workerId, ...failure }));
      } finally {
        progress.active = progress.active.filter((flowId) => flowId !== item.source.flowId);
        await updateProgress();
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(workers, prepared.length) }, (_, index) => worker(index + 1)),
  );
  progress.status = progress.failed.length ? "error" : "done";
  await updateProgress();
  console.log(JSON.stringify({
    event: "done",
    status: progress.status,
    completed: progress.completed.length,
    failed: progress.failed.length,
    credits: progress.credits,
    progressPath,
  }));
  if (progress.failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
