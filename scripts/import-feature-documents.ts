import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  featureEvidenceManifestSha256,
  parseFeatureDocumentContent,
  type FeatureDocumentContent,
  type FeatureEvidenceManifestItem,
  type FeatureSourceFlow,
} from "../src/featureDocument.ts";

type Platform = "android" | "ios" | "web";

export interface FeatureDescriptionArtifact {
  generatedAt: string;
  source: {
    app: string;
    platform: Platform;
    flowId: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    evidence: Array<{
      imageId: number;
      evidenceId: string;
      stepIndex: number;
      imageIndex: number;
      stepLabel: string;
      interaction?: string;
    }>;
  };
  feature: {
    title: string;
    featureDescription: string;
    userGoal: string;
    entryPoint: string;
    completionState: string;
    orderedSteps: Array<{
      evidenceId: string;
      name: string;
      description: string;
      userAction: string;
      systemResponse: string;
      confidence: number;
    }>;
    observedBehavior: Array<{ text: string; evidenceIds: string[] }>;
    inferredRules: Array<{ text: string; evidenceIds: string[]; confidence: number }>;
    requirements: Array<{ id: string; text: string; priority: "must" | "should" | "could"; evidenceIds: string[] }>;
    edgeCases: Array<{ scenario: string; expectedBehavior: string; basis: "observed" | "inferred" | "proposed"; evidenceIds: string[] }>;
    acceptanceCriteria: Array<{ id: string; given: string; when: string; then: string; evidenceIds: string[] }>;
    unknowns: string[];
  };
}

export function catalogDocumentKey(source: FeatureDescriptionArtifact["source"]): string {
  return `${source.app}:${source.platform}:${source.flowId}`;
}

export function artifactMatchesFlow(
  artifact: FeatureDescriptionArtifact,
  flowId?: string,
): boolean {
  return !flowId || artifact.source.flowId === flowId;
}

type ClaimKind = "observed" | "inferred" | "proposed" | "unknown";

function claim(id: string, kind: ClaimKind, text: string, evidenceIds: string[] = [], confidence?: number) {
  return { id, kind, text: text.trim() || "Unknown", evidenceIds, ...(confidence === undefined ? {} : { confidence }) };
}

function evidenceOrUnknown(text: string, evidenceIds: string[], id: string) {
  return evidenceIds.length ? claim(id, "observed", text, evidenceIds) : claim(id, "unknown", text);
}

function userNeed(requirement: string): string {
  const normalized = requirement.trim().replace(/[.!?]+$/, "").replace(/\bmust\b/i, "to");
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function matchingCriterion(
  requirement: FeatureDescriptionArtifact["feature"]["requirements"][number],
  criteria: FeatureDescriptionArtifact["feature"]["acceptanceCriteria"],
  usedCriterionIds: Set<string>,
) {
  return criteria
    .filter((criterion) => !usedCriterionIds.has(criterion.id))
    .map((criterion) => ({
      criterion,
      overlap: criterion.evidenceIds.filter((evidenceId) => requirement.evidenceIds.includes(evidenceId)).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)[0]?.criterion;
}

export function featureDescriptionToContent(artifact: FeatureDescriptionArtifact): FeatureDocumentContent {
  const evidenceIds = artifact.source.evidence.map(({ evidenceId }) => evidenceId);
  const allEvidence = [...evidenceIds];
  const steps = artifact.feature.orderedSteps;
  const usedCriterionIds = new Set<string>();
  const requirements = artifact.feature.requirements.map((item, index) => {
    const sourceCriterion = matchingCriterion(item, artifact.feature.acceptanceCriteria, usedCriterionIds);
    if (sourceCriterion) usedCriterionIds.add(sourceCriterion.id);
    const criterion = sourceCriterion ?? {
      id: `AC-${String(index + 1).padStart(2, "0")}`,
      given: "The user reaches the documented state",
      when: "The requirement is evaluated",
      then: item.text,
      evidenceIds: item.evidenceIds,
    };
    return {
      ...claim(item.id || `REQ-${String(index + 1).padStart(2, "0")}`, item.evidenceIds.length ? "observed" : "proposed", item.text, item.evidenceIds),
      userStory: `As a user, I need ${userNeed(item.text)}, so that I can complete the flow goal.`,
      priority: item.priority,
      preconditions: [artifact.feature.entryPoint],
      acceptanceCriteria: [{
        id: `${criterion.id}-${index + 1}`,
        given: criterion.given,
        when: criterion.when,
        then: criterion.then,
        evidenceIds: criterion.evidenceIds,
      }],
    };
  });
  if (!requirements.length) {
    requirements.push({
      ...claim("REQ-01", "proposed", artifact.feature.featureDescription, []),
      userStory: `As a user, I want to ${artifact.feature.userGoal.toLowerCase()} so that I can complete the flow.`,
      priority: "must",
      preconditions: [artifact.feature.entryPoint],
      acceptanceCriteria: [{
        id: "AC-01",
        given: artifact.feature.entryPoint,
        when: "The user completes the documented steps",
        then: artifact.feature.completionState,
        evidenceIds: allEvidence,
      }],
    });
  }
  return {
    executiveSummary: {
      purpose: claim("summary-purpose", "observed", artifact.feature.featureDescription, allEvidence),
      userValue: claim("summary-user-value", "observed", artifact.feature.userGoal, allEvidence),
      recommendation: claim("summary-recommendation", "proposed", `Preserve the observed ${artifact.source.title} journey and its explicit user feedback.`, []),
    },
    observedFlow: {
      userGoal: claim("flow-user-goal", "observed", artifact.feature.userGoal, allEvidence),
      entryPoint: claim("flow-entry-point", "observed", artifact.feature.entryPoint, allEvidence),
      completionPoint: claim("flow-completion-point", "observed", artifact.feature.completionState, allEvidence),
      journey: steps.map((step, index) => claim(`journey-${index + 1}`, "observed", `${step.name}: ${step.description}`, [step.evidenceId])),
      actors: [claim("actor-primary-user", "proposed", "The primary user completing the flow.", [])],
      visibleStates: steps.map((step, index) => evidenceOrUnknown(step.systemResponse, [step.evidenceId], `visible-state-${index + 1}`)),
    },
    flowAnalysis: {
      effectivePatterns: artifact.feature.observedBehavior.map((item, index) => claim(`pattern-${index + 1}`, "observed", item.text, item.evidenceIds)),
      friction: [],
      missingStates: artifact.feature.unknowns.map((item, index) => claim(`missing-state-${index + 1}`, "unknown", item)),
      inconsistencies: [],
      risksAndAssumptions: artifact.feature.inferredRules.map((item, index) => claim(`risk-${index + 1}`, "inferred", item.text, item.evidenceIds, item.confidence)),
    },
    proposedFeature: {
      problem: claim("proposed-problem", "inferred", artifact.feature.userGoal, allEvidence),
      targetUsers: [claim("target-users", "proposed", "Users who need to complete this flow.", [])],
      goals: [claim("goal-complete-flow", "proposed", artifact.feature.userGoal, [])],
      nonGoals: [claim("non-goal-unseen-states", "unknown", "Behavior not shown in the captured evidence is outside this document." )],
      behavior: steps.map((step, index) => claim(`proposed-behavior-${index + 1}`, "proposed", `${step.userAction} → ${step.systemResponse}`, [step.evidenceId])),
      journey: steps.map((step, index) => claim(`proposed-journey-${index + 1}`, "proposed", step.name, [step.evidenceId])),
    },
    requirements,
    edgeCases: artifact.feature.edgeCases.map((item, index) => claim(`edge-case-${index + 1}`, item.basis === "observed" ? "observed" : item.basis === "inferred" ? "inferred" : "proposed", `${item.scenario}: ${item.expectedBehavior}`, item.evidenceIds)),
    successMetrics: [claim("metric-flow-completion", "proposed", "Flow completion rate.", [])],
    guardrailMetrics: [claim("metric-evidence-fidelity", "proposed", "Rate of generated claims supported by the captured evidence.", [])],
    analyticsEvents: [claim("event-flow-completed", "proposed", "Record when the documented flow reaches its completion state.", [])],
    dependencies: [claim("dependency-source-evidence", "unknown", "The source Flow and its ordered image evidence must remain available.")],
    openQuestions: artifact.feature.unknowns.map((item, index) => claim(`open-question-${index + 1}`, "unknown", item)),
  };
}

interface ImportResult {
  action: "created" | "updated" | "skipped";
  key: string;
  documentId?: number;
  reason?: string;
}

interface SourceRow {
  appId: number;
  platformId: number;
  versionId: number;
}

async function sourceRow(client: pg.PoolClient, source: FeatureDescriptionArtifact["source"]): Promise<SourceRow> {
  const app = await client.query<{ app_id: number; platform_id: number }>(
    `SELECT a.id AS app_id, p.id AS platform_id
     FROM apps a JOIN platforms p ON p.app_id = a.id
     WHERE a.name = $1 AND p.name = $2`, [source.app, source.platform],
  );
  if (!app.rows[0]) throw new Error(`Source app/platform not found: ${source.app}/${source.platform}`);
  const version = await client.query<{ id: number }>(
    `SELECT av.id FROM app_versions av
     WHERE av.app_id = $1 AND av.platform = $2 AND av.status = 'published'
     ORDER BY av.version_number DESC LIMIT 1`, [app.rows[0].app_id, source.platform],
  );
  if (!version.rows[0]) throw new Error(`Published source version not found: ${source.app}/${source.platform}`);
  return { appId: Number(app.rows[0].app_id), platformId: Number(app.rows[0].platform_id), versionId: Number(version.rows[0].id) };
}

async function evidenceManifest(client: pg.PoolClient, source: FeatureDescriptionArtifact["source"], platformId: number, versionId: number): Promise<FeatureEvidenceManifestItem[]> {
  const imageIds = source.evidence.map(({ imageId }) => imageId);
  const images = await client.query<{ id: number; description: string | null }>(
    `SELECT i.id, i.description
     FROM images i JOIN version_images vi ON vi.image_id = i.id
     WHERE i.platform_id = $1 AND vi.version_id = $2 AND i.id = ANY($3::integer[])`,
    [platformId, versionId, imageIds],
  );
  const byId = new Map(images.rows.map((row) => [Number(row.id), row]));
  const missing = source.evidence.find((item) => !byId.has(item.imageId));
  if (missing) throw new Error(`Evidence image ${missing.imageId} is not in the published source version`);
  return source.evidence.map((item) => ({
    stepIndex: item.stepIndex,
    imageIndex: item.imageIndex,
    imageId: item.imageId,
    evidenceId: item.evidenceId,
    stepLabel: item.stepLabel,
    ...(item.interaction ? { interaction: item.interaction } : {}),
    description: byId.get(item.imageId)?.description ?? null,
  }));
}

function sourceFlow(source: FeatureDescriptionArtifact["source"], versionId: number): FeatureSourceFlow {
  return {
    app: source.app,
    platform: source.platform,
    versionId,
    flowId: source.flowId,
    title: source.title,
    description: source.description,
    ...(source.category ? { category: source.category } : {}),
    tags: source.tags,
  };
}

function markdownLooksConsistent(markdown: string, artifact: FeatureDescriptionArtifact): boolean {
  return markdown.startsWith(`# ${artifact.feature.title}`) && markdown.includes(`- Source flow ID: ${artifact.source.flowId}`);
}

async function importArtifact(client: pg.PoolClient, artifact: FeatureDescriptionArtifact, markdown: string, apply: boolean): Promise<ImportResult> {
  const key = catalogDocumentKey(artifact.source);
  if (!markdownLooksConsistent(markdown, artifact)) throw new Error(`Markdown does not match JSON artifact: ${key}`);
  const source = await sourceRow(client, artifact.source);
  const manifest = await evidenceManifest(client, artifact.source, source.platformId, source.versionId);
  const content = parseFeatureDocumentContent(featureDescriptionToContent(artifact), new Set(manifest.map(({ evidenceId }) => evidenceId)));
  const checksum = featureEvidenceManifestSha256(manifest);
  if (!apply) return { action: "created", key };
  await client.query("BEGIN");
  try {
    const existing = await client.query<{
      id: number;
      current_revision_id: number | null;
      author_type: string | null;
      evidence_manifest_sha256: string | null;
      content_unchanged: boolean;
    }>(
      `SELECT d.id, d.current_revision_id, r.author_type, r.evidence_manifest_sha256,
              COALESCE(r.content = $4::jsonb, false) AS content_unchanged
       FROM feature_documents d
       LEFT JOIN feature_document_revisions r ON r.id = d.current_revision_id
       WHERE d.visibility = 'catalog' AND d.app_id = $1 AND d.platform_id = $2 AND d.source_flow_id = $3
       FOR UPDATE OF d`, [source.appId, source.platformId, artifact.source.flowId, JSON.stringify(content)],
    );
    const current = existing.rows[0];
    if (current?.author_type && current.author_type !== "generated") {
      await client.query("ROLLBACK");
      return { action: "skipped", key, documentId: Number(current.id), reason: "human_revision_exists" };
    }
    if (current?.evidence_manifest_sha256 === checksum && current.content_unchanged) {
      await client.query("ROLLBACK");
      return { action: "skipped", key, documentId: Number(current.id), reason: "unchanged" };
    }
    const documentId = current
      ? Number(current.id)
      : Number((await client.query<{ id: number }>(
        `INSERT INTO feature_documents (user_id, app_id, platform_id, source_flow_id, title, visibility)
         VALUES (NULL, $1, $2, $3, $4, 'catalog') RETURNING id`,
        [source.appId, source.platformId, artifact.source.flowId, artifact.feature.title.slice(0, 160)],
      )).rows[0].id);
    const revision = await client.query<{ id: number }>(
      `INSERT INTO feature_document_revisions
         (document_id, revision_number, author_type, review_status, content, source_version_id,
          source_flow, evidence_manifest, evidence_manifest_sha256, focus_instruction,
          prompt_version, provider_model)
       SELECT $1, COALESCE(MAX(revision_number), 0) + 1, 'generated', 'draft', $2::jsonb, $3,
              $4::jsonb, $5::jsonb, $6, $7, 1, 'chatgpt-local-import'
       FROM feature_document_revisions WHERE document_id = $1
       RETURNING id`,
      [documentId, JSON.stringify(content), source.versionId, JSON.stringify(sourceFlow(artifact.source, source.versionId)), JSON.stringify(manifest), checksum, "Imported from the local flow analysis"],
    );
    await client.query("UPDATE feature_documents SET current_revision_id = $2, updated_at = now() WHERE id = $1", [documentId, revision.rows[0].id]);
    await client.query("COMMIT");
    return { action: current ? "updated" : "created", key, documentId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runImport(options: {
  root: string;
  apply: boolean;
  databaseUrl: string;
  flowId?: string;
}): Promise<ImportResult[]> {
  const jsonDir = join(options.root, "json");
  const markdownDir = join(options.root, "markdown");
  const files = (await readdir(jsonDir)).filter((file) => file.endsWith(".json")).sort();
  const pool = new pg.Pool({ connectionString: options.databaseUrl });
  const results: ImportResult[] = [];
  try {
    for (const file of files) {
      const artifact = JSON.parse(await readFile(join(jsonDir, file), "utf8")) as FeatureDescriptionArtifact;
      if (!artifactMatchesFlow(artifact, options.flowId)) continue;
      const markdown = await readFile(join(markdownDir, file.replace(/\.json$/, ".md")), "utf8");
      const client = await pool.connect();
      try { results.push(await importArtifact(client, artifact, markdown, options.apply)); }
      finally { client.release(); }
    }
    return results;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.env.FLOW_ARTIFACT_ROOT ?? "data/feature-descriptions/binance");
  const apply = process.argv.includes("--apply");
  const flowFlag = process.argv.indexOf("--flow");
  const flowId = flowFlag >= 0 ? process.argv[flowFlag + 1]?.trim() : undefined;
  if (flowFlag >= 0 && !flowId) throw new Error("--flow requires a Flow ID");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const results = await runImport({ root, apply, databaseUrl, flowId });
  const summary = results.reduce<Record<string, number>>((acc, result) => ({ ...acc, [result.action]: (acc[result.action] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", summary, results }, null, 2));
}
