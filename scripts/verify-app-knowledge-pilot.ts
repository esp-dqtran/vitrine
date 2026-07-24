import { resolve } from 'node:path';
import process from 'node:process';
import pg from 'pg';

export interface PilotManifestItem {
  evidenceId: string;
  imageId: number;
  kind: 'screen' | 'flow_step' | 'ui_element';
  eligibility: 'eligible' | 'quarantined' | 'duplicate';
  flow?: { id: string; stepIndex: number };
}

export interface PilotVerifierInput {
  app: string;
  platform: 'ios' | 'android' | 'web';
  version: number;
  manifest: PilotManifestItem[];
  evidenceRecords: Array<{
    evidenceId: string;
    status: 'pending' | 'complete' | 'failed' | 'cached' | 'quarantined' | 'duplicate';
  }>;
  snapshot: {
    coverage: {
      flowReferences: { total: number; resolved: number; uniqueImages: number };
    };
    claims: Array<{
      id: string;
      kind: string;
      text: string;
      evidenceIds: string[];
    }>;
    designLanguage: Record<string, unknown[]>;
    componentCandidates: Array<{ status: string }>;
    flows: Array<{ id: string; evidenceIds: string[] }>;
  };
  repeatedManifest: {
    repeated: boolean;
    eligible: number;
    cacheHits: number;
    missingCacheEntries: number;
  };
  acceptance: {
    resume: boolean;
    cancel: boolean;
    retry: boolean;
    stale: boolean;
    auth: boolean;
    review: boolean;
  };
  reviewedFlowIds: string[];
  reviewedRoles: string[];
}

export interface PilotVerificationResult {
  ok: boolean;
  failedGates: string[];
  summary: {
    app: string;
    platform: string;
    version: number;
    manifestItems: number;
    eligibleEvidence: number;
    quarantinedUiElements: number;
    flowReferences: number;
    uniqueFlowImages: number;
    claims: number;
    designLanguageClaims: number;
    componentCandidates: number;
    reviewedCompleteFlows: number;
    reviewedRoles: number;
    cacheHits: number;
  };
}

const REQUIRED_UI_ELEMENT_QUARANTINE = 610;
const REQUIRED_FLOW_REFERENCES = 754;
const REQUIRED_UNIQUE_FLOW_IMAGES = 610;
const REQUIRED_REVIEWED_FLOWS = 5;
const REQUIRED_ROLES = ['designer', 'developer', 'product'];

export function verifyAppKnowledgePilot(input: PilotVerifierInput): PilotVerificationResult {
  const failed = new Set<string>();
  const quarantinedUiElements = input.manifest.filter(({ kind, eligibility }) =>
    kind === 'ui_element' && eligibility === 'quarantined').length;
  if (quarantinedUiElements !== REQUIRED_UI_ELEMENT_QUARANTINE) {
    failed.add('ui_element_quarantine');
  }

  const flowItems = input.manifest.filter(({ kind }) => kind === 'flow_step');
  if (
    flowItems.length !== REQUIRED_FLOW_REFERENCES
    || input.snapshot.coverage.flowReferences.total !== REQUIRED_FLOW_REFERENCES
  ) failed.add('flow_reference_count');

  const uniqueFlowImages = new Set(flowItems.map(({ imageId }) => imageId)).size;
  if (
    uniqueFlowImages !== REQUIRED_UNIQUE_FLOW_IMAGES
    || input.snapshot.coverage.flowReferences.uniqueImages !== REQUIRED_UNIQUE_FLOW_IMAGES
  ) failed.add('unique_flow_images');
  if (
    input.snapshot.coverage.flowReferences.resolved
    !== input.snapshot.coverage.flowReferences.total
  ) failed.add('flow_references_resolved');

  const records = new Map(input.evidenceRecords.map((record) => [record.evidenceId, record]));
  const eligible = input.manifest.filter(({ eligibility }) => eligibility === 'eligible');
  const eligibleComplete = eligible.every(({ evidenceId }) => {
    const status = records.get(evidenceId)?.status;
    return status === 'complete' || status === 'cached';
  });
  if (!eligibleComplete) failed.add('eligible_evidence_complete');

  const evidenceIds = new Set(input.manifest.map(({ evidenceId }) => evidenceId));
  const citedEvidenceIds = input.snapshot.claims.flatMap(({ evidenceIds: citations }) => citations);
  if (citedEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) {
    failed.add('citations_known');
  }
  if (input.snapshot.claims.some(({ kind, evidenceIds: citations }) =>
    (kind === 'observed' || kind === 'inferred') && citations.length === 0)) {
    failed.add('observed_inferred_cited');
  }
  const designLanguageClaims = Object.values(input.snapshot.designLanguage)
    .reduce((total, claims) => total + claims.length, 0);
  if (designLanguageClaims === 0) failed.add('design_language_present');
  if (input.snapshot.componentCandidates.some(({ status }) => status !== 'candidate')) {
    failed.add('components_remain_candidates');
  }

  if (
    !input.repeatedManifest.repeated
    || input.repeatedManifest.eligible !== eligible.length
    || input.repeatedManifest.cacheHits !== input.repeatedManifest.eligible
    || input.repeatedManifest.missingCacheEntries !== 0
  ) failed.add('repeated_manifest_cache');

  if (Object.values(input.acceptance).some((accepted) => !accepted)) {
    failed.add('lifecycle_acceptance');
  }

  const completedEvidence = new Set(
    input.evidenceRecords
      .filter(({ status }) => status === 'complete' || status === 'cached')
      .map(({ evidenceId }) => evidenceId),
  );
  const completeFlows = new Set(input.snapshot.flows
    .filter(({ evidenceIds: citations }) =>
      citations.length > 0
      && citations.every((evidenceId) => evidenceIds.has(evidenceId) && completedEvidence.has(evidenceId)))
    .map(({ id }) => id));
  const reviewedCompleteFlows = new Set(input.reviewedFlowIds.filter((id) => completeFlows.has(id))).size;
  if (reviewedCompleteFlows < REQUIRED_REVIEWED_FLOWS) failed.add('reviewed_flows');

  const reviewedRoles = new Set(input.reviewedRoles);
  if (REQUIRED_ROLES.some((role) => !reviewedRoles.has(role))) {
    failed.add('role_projections_reviewed');
  }

  return {
    ok: failed.size === 0,
    failedGates: [...failed],
    summary: {
      app: input.app,
      platform: input.platform,
      version: input.version,
      manifestItems: input.manifest.length,
      eligibleEvidence: eligible.length,
      quarantinedUiElements,
      flowReferences: flowItems.length,
      uniqueFlowImages,
      claims: input.snapshot.claims.length,
      designLanguageClaims,
      componentCandidates: input.snapshot.componentCandidates.length,
      reviewedCompleteFlows,
      reviewedRoles: reviewedRoles.size,
      cacheHits: input.repeatedManifest.cacheHits,
    },
  };
}

function isClaim(value: unknown): value is PilotVerifierInput['snapshot']['claims'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.kind === 'string'
    && typeof item.text === 'string'
    && Array.isArray(item.evidenceIds);
}

function collectClaims(value: unknown, output: PilotVerifierInput['snapshot']['claims'] = []) {
  if (isClaim(value)) {
    output.push({
      id: value.id,
      kind: value.kind,
      text: value.text,
      evidenceIds: value.evidenceIds.filter((item): item is string => typeof item === 'string'),
    });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectClaims(item, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectClaims(item, output));
  }
  return output;
}

function numeric(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Pilot data contains an invalid count');
  return result;
}

function jsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Pilot data contains an invalid JSON array');
  return value;
}

function manifestItems(value: unknown): PilotManifestItem[] {
  return jsonArray(value).map((raw) => {
    const item = raw as Record<string, unknown>;
    const flow = item.flow as Record<string, unknown> | undefined;
    if (
      typeof item.evidenceId !== 'string'
      || !Number.isSafeInteger(Number(item.imageId))
      || !['screen', 'flow_step', 'ui_element'].includes(String(item.kind))
      || !['eligible', 'quarantined', 'duplicate'].includes(String(item.eligibility))
    ) throw new Error('Pilot manifest is invalid');
    return {
      evidenceId: item.evidenceId,
      imageId: Number(item.imageId),
      kind: item.kind as PilotManifestItem['kind'],
      eligibility: item.eligibility as PilotManifestItem['eligibility'],
      ...(flow && typeof flow.id === 'string' && Number.isSafeInteger(Number(flow.stepIndex))
        ? { flow: { id: flow.id, stepIndex: Number(flow.stepIndex) } }
        : {}),
    };
  });
}

interface CliOptions {
  app: string;
  platform: 'ios' | 'android' | 'web';
  version?: number;
}

function cliOptions(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error('Usage: --app APP --platform PLATFORM [--version N]');
    values.set(key.slice(2), value);
  }
  const app = values.get('app')?.trim();
  const platform = values.get('platform');
  const versionText = values.get('version');
  const version = versionText === undefined ? undefined : Number(versionText);
  if (
    !app
    || (platform !== 'ios' && platform !== 'android' && platform !== 'web')
    || (version !== undefined && (!Number.isSafeInteger(version) || version < 1))
  ) throw new Error('Usage: --app APP --platform PLATFORM [--version N]');
  return { app, platform, ...(version ? { version } : {}) };
}

async function loadPilotInput(
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
  options: CliOptions,
): Promise<PilotVerifierInput> {
  const target = await query(
    `SELECT s.id AS snapshot_id, s.current_revision_id, av.version_number
       FROM app_knowledge_snapshots s
       JOIN apps a ON a.id = s.app_id
       JOIN platforms p ON p.id = s.platform_id
       JOIN app_versions av ON av.id = s.capture_version_id
      WHERE a.name = $1 AND p.name = $2
        AND ($3::integer IS NULL OR av.version_number = $3)
      ORDER BY av.version_number DESC LIMIT 1`,
    [options.app, options.platform, options.version ?? null],
  );
  const root = target.rows[0];
  if (!root?.snapshot_id || !root.current_revision_id) {
    throw new Error('Pilot snapshot or current revision was not found');
  }
  const snapshotId = Number(root.snapshot_id);
  const revisionId = Number(root.current_revision_id);
  const [revisionResult, jobsResult, evidenceResult, reviewResult, accessResult] = await Promise.all([
    query(
      `SELECT review_status, content, evidence_manifest
         FROM app_knowledge_revisions
        WHERE snapshot_id = $1 AND id = $2`,
      [snapshotId, revisionId],
    ),
    query(
      `SELECT id, status, source_sha256, evidence_manifest, total_count, cache_hit_count
         FROM app_knowledge_jobs WHERE snapshot_id = $1
        ORDER BY created_at DESC, id DESC`,
      [snapshotId],
    ),
    query(
      `SELECT evidence_id, status, cache_key
         FROM app_knowledge_job_evidence
        WHERE job_id = (
          SELECT id FROM app_knowledge_jobs WHERE snapshot_id = $1
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
      [snapshotId],
    ),
    query(
      `SELECT action, details FROM app_knowledge_review_events
        WHERE snapshot_id = $1 ORDER BY created_at, id`,
      [snapshotId],
    ),
    query(
      `SELECT action, outcome FROM access_events
        WHERE feature_key = 'app_knowledge'
          AND created_at >= (
            SELECT created_at FROM app_knowledge_snapshots WHERE id = $1
          )`,
      [snapshotId],
    ),
  ]);
  const revision = revisionResult.rows[0];
  if (!revision) throw new Error('Pilot revision was not found');
  const content = revision.content as Record<string, unknown>;
  const manifest = manifestItems(revision.evidence_manifest);
  const latestJob = jobsResult.rows[0];
  if (!latestJob) throw new Error('Pilot generation job was not found');
  const latestManifest = JSON.stringify(latestJob.evidence_manifest);
  const matchingJobs = jobsResult.rows.filter((job) =>
    job.source_sha256 === latestJob.source_sha256
    && JSON.stringify(job.evidence_manifest) === latestManifest
    && job.status === 'done');
  const cachedKeys = evidenceResult.rows
    .filter(({ status, cache_key: cacheKey }) => status === 'cached' && typeof cacheKey === 'string')
    .map(({ cache_key: cacheKey }) => cacheKey as string);
  const cacheResult = cachedKeys.length ? await query(
    `SELECT count(*)::integer AS count
       FROM app_knowledge_evidence_cache WHERE cache_key = ANY($1::text[])`,
    [cachedKeys],
  ) : { rows: [{ count: 0 }] };
  const reviewEvents = reviewResult.rows.map((event) => ({
    action: String(event.action),
    entityId: typeof (event.details as Record<string, unknown> | undefined)?.entityId === 'string'
      ? (event.details as Record<string, string>).entityId
      : undefined,
  }));
  const accessActions = new Set(accessResult.rows
    .filter(({ outcome }) => outcome === 'completed' || outcome === 'created')
    .map(({ action }) => String(action)));
  const rawFlows = jsonArray(content.flows);
  const rawDesignLanguage = content.designLanguage;
  if (!rawDesignLanguage || typeof rawDesignLanguage !== 'object' || Array.isArray(rawDesignLanguage)) {
    throw new Error('Pilot design language is invalid');
  }
  const designLanguage = Object.fromEntries(
    Object.entries(rawDesignLanguage).map(([key, value]) => [key, jsonArray(value)]),
  );
  const componentCandidates = jsonArray(content.componentCandidates).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Pilot component candidate is invalid');
    }
    return { status: String((raw as Record<string, unknown>).status) };
  });
  const flows = rawFlows.map((raw) => {
    const flow = raw as Record<string, unknown>;
    const steps = jsonArray(flow.steps);
    return {
      id: String(flow.id),
      evidenceIds: steps.flatMap((step) => {
        const evidenceId = (step as Record<string, unknown>).evidenceId;
        return typeof evidenceId === 'string' ? [evidenceId] : [];
      }),
    };
  });
  const coverage = (content.coverage as Record<string, unknown>).flowReferences as Record<string, unknown>;
  const reviewStatus = String(revision.review_status);
  return {
    app: options.app,
    platform: options.platform,
    version: numeric(root.version_number),
    manifest,
    evidenceRecords: evidenceResult.rows.map((row) => ({
      evidenceId: String(row.evidence_id),
      status: row.status as PilotVerifierInput['evidenceRecords'][number]['status'],
    })),
    snapshot: {
      coverage: {
        flowReferences: {
          total: numeric(coverage.total),
          resolved: numeric(coverage.resolved),
          uniqueImages: numeric(coverage.uniqueImages),
        },
      },
      claims: collectClaims(content),
      designLanguage,
      componentCandidates,
      flows,
    },
    repeatedManifest: {
      repeated: matchingJobs.length >= 2,
      eligible: manifest.filter(({ eligibility }) => eligibility === 'eligible').length,
      cacheHits: numeric(latestJob.cache_hit_count),
      missingCacheEntries: Math.max(0, cachedKeys.length - numeric(cacheResult.rows[0]?.count)),
    },
    acceptance: {
      resume: accessActions.has('app_knowledge_job_resume'),
      cancel: accessActions.has('app_knowledge_job_cancelled'),
      retry: accessActions.has('app_knowledge_job_retry'),
      stale: jobsResult.rows.some(({ status }) => status === 'stale'),
      auth: reviewEvents.some(({ action }) => action === 'pilot_auth_accepted'),
      review: reviewStatus === 'approved'
        && reviewEvents.some(({ action }) => action === 'snapshot_approved'),
    },
    reviewedFlowIds: reviewEvents
      .filter(({ action, entityId }) => action === 'flow_reviewed' && entityId)
      .map(({ entityId }) => entityId!),
    reviewedRoles: reviewEvents
      .filter(({ action, entityId }) => action === 'role_projection_reviewed' && entityId)
      .map(({ entityId }) => entityId!),
  };
}

export async function runPilotVerifier(argv = process.argv.slice(2)): Promise<number> {
  const options = cliOptions(argv);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const input = await loadPilotInput(
      (sql, values) => client.query(sql, values),
      options,
    );
    const result = verifyAppKnowledgePilot(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  runPilotVerifier()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Pilot verification failed'}\n`);
      process.exitCode = 1;
    });
}
