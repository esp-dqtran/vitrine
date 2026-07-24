import { resolve } from 'node:path';
import process from 'node:process';
import pg from 'pg';
import {
  type DesignSystemSnapshot,
  type EvidenceOccurrence,
} from '../src/designSystem.ts';

type Region = { x: number; y: number; width: number; height: number };
type GeneratedEntity = {
  id: string;
  evidence: number[];
  confidence?: number;
  source?: string;
  reviewStatus?: string;
};
type PilotVariant = GeneratedEntity & {
  occurrences: Array<EvidenceOccurrence<number>>;
};
type PilotComponent = {
  id: string;
  evidence: number[];
  confidence?: number;
  status: string;
  variants: PilotVariant[];
};
type PilotFlow = {
  id: string;
  steps: Array<{
    order: number;
    interaction?: string;
    evidence: number[];
  }>;
};

export interface PilotVerifierInput {
  captureVersion: number;
  completedAutomaticJobs: number;
  sourceHashDrift: number;
  quarantinedUiElementsBefore: number;
  quarantinedUiElementsAfter: number;
  protectedSnapshotOverwrites: number;
  designSystemSeedOutcome: 'seeded' | 'replaced' | 'unchanged' | 'conflict' | null;
  tokens: GeneratedEntity[];
  components: PilotComponent[];
  rules: GeneratedEntity[];
  crops: Array<{
    derivedImageId: number;
    sourceImageId: number;
    region: Region;
    metadataVerified: boolean;
  }>;
  flows: PilotFlow[];
  crawledFlows: PilotFlow[];
}

export interface PilotVerificationResult {
  ok: boolean;
  failedGates: string[];
  summary: {
    captureVersion: number;
    completedAutomaticJobs: number;
    sourceHashDrift: number;
    tokens: number;
    components: number;
    variants: number;
    rules: number;
    regions: number;
    verifiedCrops: number;
    flows: number;
    flowSteps: number;
    quarantinedUiElements: number;
    protectedSnapshotOverwrites: number;
  };
}

function confidence(value: unknown): boolean {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1;
}

function generatedEntity(value: GeneratedEntity): boolean {
  return value.id.trim().length > 0
    && value.evidence.length > 0
    && value.evidence.every((id) => Number.isSafeInteger(id) && id > 0)
    && confidence(value.confidence)
    && value.source === 'llm_inferred'
    && value.reviewStatus === 'needs_review';
}

function normalizedRegion(value: Region, coordinateSpace?: string): boolean {
  const coordinates = [value.x, value.y, value.width, value.height];
  return coordinateSpace === 'normalized'
    && coordinates.every(Number.isFinite)
    && value.x >= 0
    && value.y >= 0
    && value.width > 0
    && value.height > 0
    && value.x + value.width <= 1
    && value.y + value.height <= 1
    && !(value.width >= 0.9 && value.height >= 0.9);
}

function sameRegion(left: Region, right: Region): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function flowSignature(flows: PilotFlow[]): string {
  return JSON.stringify([...flows]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((flow) => ({
      id: flow.id,
      steps: flow.steps.map((step) => ({
        order: step.order,
        interaction: step.interaction ?? null,
        evidence: step.evidence,
      })),
    })));
}

export function verifyAppKnowledgePilot(
  input: PilotVerifierInput,
): PilotVerificationResult {
  const failed = new Set<string>();
  if (input.completedAutomaticJobs !== 1) {
    failed.add('completed_automatic_job');
  }
  if (input.sourceHashDrift !== 0) failed.add('source_hash_drift');
  if (
    input.tokens.length === 0
    || input.components.length === 0
    || input.rules.length === 0
  ) failed.add('generated_entities_present');

  const variants = input.components.flatMap((component) => component.variants);
  if (
    input.tokens.some((token) => !generatedEntity(token))
    || input.rules.some((rule) => !generatedEntity(rule))
    || input.components.some((component) =>
      component.id.trim().length === 0
      || component.status !== 'candidate'
      || component.evidence.length === 0
      || !confidence(component.confidence)
      || component.variants.length === 0)
    || variants.some((variant) => !generatedEntity(variant))
  ) failed.add('generated_entity_provenance');

  const occurrences = variants.flatMap((variant) => variant.occurrences);
  if (occurrences.some((occurrence) =>
    !occurrence.region
    || !normalizedRegion(occurrence.region, occurrence.coordinateSpace))) {
    failed.add('normalized_regions');
  }

  const crops = new Map(input.crops.map((crop) => [crop.derivedImageId, crop]));
  if (occurrences.some((occurrence) => {
    if (!occurrence.cropImageId || !occurrence.region) return true;
    const crop = crops.get(occurrence.cropImageId);
    return !crop
      || !crop.metadataVerified
      || crop.sourceImageId !== occurrence.imageId
      || !sameRegion(crop.region, occurrence.region);
  })) failed.add('verified_crop_metadata');

  if (flowSignature(input.flows) !== flowSignature(input.crawledFlows)) {
    failed.add('raw_flows_preserved');
  }
  if (
    input.quarantinedUiElementsBefore
    !== input.quarantinedUiElementsAfter
  ) failed.add('ui_element_quarantine');
  if (input.protectedSnapshotOverwrites !== 0) {
    failed.add('protected_snapshots');
  }
  if (!input.designSystemSeedOutcome) failed.add('design_system_seed_outcome');

  return {
    ok: failed.size === 0,
    failedGates: [...failed],
    summary: {
      captureVersion: input.captureVersion,
      completedAutomaticJobs: input.completedAutomaticJobs,
      sourceHashDrift: input.sourceHashDrift,
      tokens: input.tokens.length,
      components: input.components.length,
      variants: variants.length,
      rules: input.rules.length,
      regions: occurrences.length,
      verifiedCrops: input.crops.filter(({ metadataVerified }) =>
        metadataVerified).length,
      flows: input.flows.length,
      flowSteps: input.flows.reduce((total, flow) =>
        total + flow.steps.length, 0),
      quarantinedUiElements: input.quarantinedUiElementsAfter,
      protectedSnapshotOverwrites: input.protectedSnapshotOverwrites,
    },
  };
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
    if (!key?.startsWith('--') || !value) {
      throw new Error('Usage: --app APP --platform PLATFORM [--version N]');
    }
    values.set(key.slice(2), value);
  }
  const app = values.get('app')?.trim();
  const platform = values.get('platform');
  const rawVersion = values.get('version');
  const version = rawVersion === undefined ? undefined : Number(rawVersion);
  if (
    !app
    || !['ios', 'android', 'web'].includes(platform ?? '')
    || (version !== undefined
      && (!Number.isSafeInteger(version) || version < 1))
  ) throw new Error('Usage: --app APP --platform PLATFORM [--version N]');
  return {
    app,
    platform: platform as CliOptions['platform'],
    ...(version ? { version } : {}),
  };
}

function positive(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`Pilot data contains an invalid ${label}`);
  }
  return result;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Pilot data contains an invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Pilot data contains an invalid ${label}`);
  }
  return value;
}

function storedDesignSystem(value: unknown): DesignSystemSnapshot<number> {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  object(parsed, 'Design System snapshot');
  return parsed as DesignSystemSnapshot<number>;
}

function quarantineCount(value: unknown): number {
  return array(value, 'evidence manifest').filter((raw) => {
    const item = object(raw, 'evidence manifest item');
    return item.kind === 'ui_element' && item.eligibility === 'quarantined';
  }).length;
}

function pilotFlow(value: unknown): PilotFlow[] {
  return array(value, 'flows').map((rawFlow) => {
    const flow = object(rawFlow, 'flow');
    return {
      id: String(flow.id),
      steps: array(flow.steps, 'flow steps').map((rawStep, index) => {
        const step = object(rawStep, 'flow step');
        const evidence = array(step.evidence ?? [], 'flow evidence')
          .map((id) => positive(id, 'flow evidence'));
        return {
          order: step.order === undefined
            ? index
            : positive(step.order, 'flow order'),
          ...(typeof step.interaction === 'string'
            ? { interaction: step.interaction }
            : {}),
          evidence,
        };
      }),
    };
  });
}

function projectedInput(
  snapshot: DesignSystemSnapshot<number>,
): Pick<PilotVerifierInput, 'tokens' | 'components' | 'rules' | 'flows'> {
  return {
    tokens: snapshot.tokens.map((token) => ({
      id: token.id,
      evidence: token.evidence,
      confidence: token.confidence,
      source: token.source,
      reviewStatus: token.reviewStatus,
    })),
    components: snapshot.components.map((component) => {
      const variants = component.variants.map((variant) => ({
        id: variant.id,
        evidence: variant.evidence,
        confidence: variant.confidence,
        source: variant.source,
        reviewStatus: variant.reviewStatus,
        occurrences: variant.occurrences ?? [],
      }));
      return {
        id: component.id,
        evidence: [...new Set(variants.flatMap(({ evidence }) => evidence))],
        confidence: variants.length
          ? Math.min(...variants.map(({ confidence }) => confidence ?? -1))
          : undefined,
        status: 'candidate',
        variants,
      };
    }),
    rules: (snapshot.rules ?? []).map((rule) => ({
      id: rule.id,
      evidence: rule.evidence,
      confidence: rule.confidence,
      source: rule.source,
      reviewStatus: rule.reviewStatus,
    })),
    flows: pilotFlow(snapshot.flows),
  };
}

async function loadPilotInput(
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>,
  options: CliOptions,
): Promise<PilotVerifierInput> {
  const targetResult = await query(
    `SELECT s.id AS snapshot_id, s.current_revision_id, a.id AS app_id,
            av.id AS capture_version_id, av.version_number
       FROM app_knowledge_snapshots s
       JOIN apps a ON a.id = s.app_id
       JOIN platforms p ON p.id = s.platform_id
       JOIN app_versions av ON av.id = s.capture_version_id
      WHERE a.name = $1 AND p.name = $2
        AND ($3::integer IS NULL OR av.version_number = $3)
      ORDER BY av.version_number DESC LIMIT 1`,
    [options.app, options.platform, options.version ?? null],
  );
  const target = targetResult.rows[0];
  if (!target?.snapshot_id || !target.current_revision_id) {
    throw new Error('Pilot snapshot or current revision was not found');
  }
  const snapshotId = positive(target.snapshot_id, 'snapshot');
  const revisionId = positive(target.current_revision_id, 'revision');
  const appId = positive(target.app_id, 'app');
  const [revisionResult, jobsResult, designSystemResult, rawFlowsResult] =
    await Promise.all([
      query(
        `SELECT content, evidence_manifest, source_sha256
           FROM app_knowledge_revisions
          WHERE snapshot_id = $1 AND id = $2`,
        [snapshotId, revisionId],
      ),
      query(
        `SELECT id, status, request_origin, source_sha256, evidence_manifest,
                design_system_seed_outcome
           FROM app_knowledge_jobs
          WHERE snapshot_id = $1
          ORDER BY created_at DESC, id DESC`,
        [snapshotId],
      ),
      query(
        `SELECT snapshot, origin, capture_version_id,
                source_app_knowledge_revision_id
           FROM design_systems
          WHERE app_id = $1 AND platform = $2`,
        [appId, options.platform],
      ),
      query(
        `SELECT flows FROM app_flows
          WHERE app_id = $1 AND platform = $2`,
        [appId, options.platform],
      ),
    ]);
  const revision = revisionResult.rows[0];
  if (!revision) throw new Error('Pilot revision was not found');
  const content = object(revision.content, 'App Knowledge content');
  const identity = object(content.identity, 'App Knowledge identity');
  const automaticJobs = jobsResult.rows.filter(({ request_origin: origin }) =>
    origin === 'automatic');
  const completed = automaticJobs.filter(({ status, source_sha256: hash }) =>
    status === 'done' && hash === revision.source_sha256);
  const latest = automaticJobs[0];
  const projectionRow = designSystemResult.rows[0];
  const snapshot = projectionRow
    ? storedDesignSystem(projectionRow.snapshot)
    : { app: options.app, generatedAt: new Date(0).toISOString(), tokens: [], components: [], flows: [], rules: [] };
  const projected = projectedInput(snapshot);
  const cropResult = latest ? await query(
    `SELECT c.derived_image_id, c.source_image_id, c.region_x, c.region_y,
            c.region_width, c.region_height, c.crop_sha256,
            i.object_key, so.sha256, so.byte_size, so.content_type
       FROM app_knowledge_component_crops c
       JOIN images i ON i.id = c.derived_image_id
       LEFT JOIN stored_objects so ON so.object_key = i.object_key
      WHERE c.job_id = $1
      ORDER BY c.id`,
    [latest.id],
  ) : { rows: [] };
  const sourceHashDrift = [
    identity.sourceSha256 !== revision.source_sha256,
    latest?.source_sha256 !== revision.source_sha256,
    latest?.status === 'stale',
  ].filter(Boolean).length;
  const seedOutcome = latest?.design_system_seed_outcome;
  const projectionHasProtectedEdits = snapshot.tokens.some((token) =>
    token.reviewStatus !== 'needs_review' || token.source !== 'llm_inferred')
    || snapshot.components.some((component) => component.variants.some((variant) =>
      variant.reviewStatus !== 'needs_review'
      || variant.source !== 'llm_inferred'))
    || (snapshot.rules ?? []).some((rule) =>
      rule.reviewStatus !== 'needs_review' || rule.source !== 'llm_inferred');
  const protectedSnapshotOverwrites = projectionRow
    && seedOutcome !== 'conflict'
    && (
      projectionRow.origin !== 'automatic'
      || positive(projectionRow.capture_version_id, 'projected capture version')
        !== positive(target.capture_version_id, 'capture version')
      || positive(
        projectionRow.source_app_knowledge_revision_id,
        'projected source revision',
      ) !== revisionId
      || projectionHasProtectedEdits
    )
    ? 1
    : 0;
  return {
    captureVersion: positive(target.version_number, 'capture version'),
    completedAutomaticJobs: completed.length,
    sourceHashDrift,
    quarantinedUiElementsBefore: latest
      ? quarantineCount(latest.evidence_manifest)
      : 0,
    quarantinedUiElementsAfter: quarantineCount(revision.evidence_manifest),
    protectedSnapshotOverwrites,
    designSystemSeedOutcome:
      ['seeded', 'replaced', 'unchanged', 'conflict'].includes(String(seedOutcome))
        ? seedOutcome as PilotVerifierInput['designSystemSeedOutcome']
        : null,
    ...projected,
    crops: cropResult.rows.map((row) => ({
      derivedImageId: positive(row.derived_image_id, 'derived image'),
      sourceImageId: positive(row.source_image_id, 'source image'),
      region: {
        x: Number(row.region_x),
        y: Number(row.region_y),
        width: Number(row.region_width),
        height: Number(row.region_height),
      },
      metadataVerified: typeof row.object_key === 'string'
        && row.sha256 === row.crop_sha256
        && Number.isSafeInteger(Number(row.byte_size))
        && Number(row.byte_size) > 0
        && ['image/png', 'image/jpeg', 'image/webp'].includes(
          String(row.content_type),
        ),
    })),
    crawledFlows: pilotFlow(rawFlowsResult.rows[0]?.flows ?? []),
  };
}

export async function runPilotVerifier(
  argv = process.argv.slice(2),
): Promise<number> {
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

if (
  process.argv[1]
  && resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  runPilotVerifier()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Pilot verification failed'}\n`,
      );
      process.exitCode = 1;
    });
}
