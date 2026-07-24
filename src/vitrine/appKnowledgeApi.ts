import type {
  AppKnowledgeCoverage,
  AppKnowledgeReviewStatus,
  AppKnowledgeRoleProjection,
  AppKnowledgeSnapshot,
} from '../appKnowledge.ts';
import type {
  AppKnowledgeJobView,
  AppKnowledgeRevisionView,
  AppKnowledgeSnapshotView,
} from '../appKnowledgeStore.ts';
import type { Platform } from '../platformFromUrl.ts';

export type AppKnowledgeRole = AppKnowledgeRoleProjection['role'];

export interface AppKnowledgeQualityDiagnostics {
  partialCoverage: boolean;
  failedEvidenceCount: number;
  needsReviewScreenIds: string[];
  candidateComponentIds: string[];
  lowConfidenceClaimIds: string[];
  sourceChanged: boolean;
}

export interface AdminAppKnowledgeView {
  snapshot: AppKnowledgeSnapshotView;
  job: AppKnowledgeJobView | null;
  coverage: AppKnowledgeCoverage | null;
  qualityDiagnostics: AppKnowledgeQualityDiagnostics | null;
}

export interface AppKnowledgeEvidenceReference {
  evidenceId: string;
  imageId: number;
  kind: 'screen' | 'flow_step' | 'ui_element';
  flow?: {
    id: string;
    stepIndex: number;
  };
}

export interface ApprovedAppKnowledgeView {
  revision: {
    id: number;
    revisionNumber: number;
    reviewStatus: 'approved';
    createdAt: string;
    evidence: AppKnowledgeEvidenceReference[];
    content: Omit<AppKnowledgeSnapshot, 'identity' | 'coverage'> & {
      identity: Pick<
        AppKnowledgeSnapshot['identity'],
        'app' | 'platform' | 'captureVersionId' | 'generatedAt'
      >;
      coverage: Pick<
        AppKnowledgeCoverage,
        'total' | 'eligible' | 'analyzed' | 'skipped' | 'failed' | 'flowReferences'
      >;
    };
  };
  projection: AppKnowledgeRoleProjection;
}

export type AppKnowledgeView = AdminAppKnowledgeView | ApprovedAppKnowledgeView;

export interface AppKnowledgeEventSource {
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

export type AppKnowledgeEventSourceFactory = (url: string) => AppKnowledgeEventSource;

type Fetch = typeof fetch;
const jsonHeaders = { 'content-type': 'application/json' };
const statuses = new Set(['queued', 'running', 'done', 'error', 'cancelled', 'stale']);
const terminalStatuses = new Set(['done', 'error', 'cancelled', 'stale']);
const requestOrigins = new Set(['manual', 'retry', 'regeneration', 'automatic']);
const designSystemSeedOutcomes = new Set(['seeded', 'replaced', 'unchanged', 'conflict']);
const stages = new Set([
  'preparing',
  'validating_evidence',
  'analyzing',
  'synthesizing',
  'merging',
  'validating_output',
  'saving',
  'complete',
]);
const jobKeys = new Set([
  'id',
  'snapshotId',
  'transportJobId',
  'requestedBy',
  'requestOrigin',
  'status',
  'stage',
  'doneCount',
  'totalCount',
  'synthesisDoneCount',
  'synthesisTotalCount',
  'cacheHitCount',
  'failedCount',
  'providerModel',
  'promptVersion',
  'cancelRequested',
  'retryFailedOnly',
  'manifest',
  'sourceSha256',
  'errorCode',
  'errorMessage',
  'designSystemSeedOutcome',
  'updatedAt',
]);

async function json<T>(url: string, init: RequestInit | undefined, request: Fetch): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
    const error = new Error(body.error ?? `${url} returned ${response.status}`) as Error & {
      code?: string;
      status?: number;
    };
    error.code = body.code;
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function pathId(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Invalid App Knowledge identifier');
  }
  return String(value);
}

function string(value: unknown, maximum = 1_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validManifest(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 20_000) return false;
  return value.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    const object = row.object;
    return string(row.evidenceId, 300)
      && positive(row.imageId)
      && (row.kind === 'screen' || row.kind === 'flow_step' || row.kind === 'ui_element')
      && (row.eligibility === 'eligible' || row.eligibility === 'quarantined' || row.eligibility === 'duplicate')
      && string(row.reason, 120)
      && object !== null
      && typeof object === 'object'
      && !Array.isArray(object);
  });
}

function optionalSafeText(value: unknown, maximum: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= maximum);
}

export function parseAppKnowledgeProgress(
  value: unknown,
  expectedJobId: number,
): AppKnowledgeJobView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid App Knowledge progress event');
  }
  const job = value as Record<string, unknown>;
  if (
    Object.keys(job).some((key) => !jobKeys.has(key))
    || job.id !== expectedJobId
    || !positive(job.snapshotId)
    || !positive(job.transportJobId)
    || (job.requestedBy !== null && !positive(job.requestedBy))
    || !requestOrigins.has(job.requestOrigin as string)
    || !statuses.has(job.status as string)
    || !stages.has(job.stage as string)
    || !count(job.doneCount)
    || !count(job.totalCount)
    || Number(job.doneCount) > Number(job.totalCount)
    || !count(job.synthesisDoneCount)
    || !count(job.synthesisTotalCount)
    || Number(job.synthesisDoneCount) > Number(job.synthesisTotalCount)
    || !count(job.cacheHitCount)
    || !count(job.failedCount)
    || !string(job.providerModel, 160)
    || !positive(job.promptVersion)
    || typeof job.cancelRequested !== 'boolean'
    || typeof job.retryFailedOnly !== 'boolean'
    || !validManifest(job.manifest)
    || !optionalSafeText(job.sourceSha256, 64)
    || (job.sourceSha256 !== undefined && !/^[0-9a-f]{64}$/.test(job.sourceSha256 as string))
    || !optionalSafeText(job.errorCode, 80)
    || !optionalSafeText(job.errorMessage, 1_000)
    || (
      job.designSystemSeedOutcome !== undefined
      && !designSystemSeedOutcomes.has(job.designSystemSeedOutcome as string)
    )
    || !string(job.updatedAt, 80)
    || !Number.isFinite(Date.parse(job.updatedAt as string))
  ) throw new Error('Invalid App Knowledge progress event');
  return job as unknown as AppKnowledgeJobView;
}

export function getAppKnowledge(
  app: string,
  platform: Platform,
  version: number | undefined,
  role: AppKnowledgeRole,
  signal?: AbortSignal,
  request: Fetch = fetch,
): Promise<AppKnowledgeView> {
  const params = new URLSearchParams({ platform });
  if (version !== undefined) params.set('version', pathId(version));
  params.set('role', role);
  return json(`/api/apps/${encodeURIComponent(app)}/analysis?${params}`, { signal }, request);
}

export function startAppKnowledge(
  app: string,
  platform: Platform,
  version: number,
  request: Fetch = fetch,
): Promise<AppKnowledgeJobView> {
  return json('/api/app-knowledge/jobs', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ app, platform, version: Number(pathId(version)) }),
  }, request);
}

export function cancelAppKnowledgeJob(
  jobId: number,
  request: Fetch = fetch,
): Promise<AppKnowledgeJobView> {
  return json(`/api/app-knowledge/jobs/${pathId(jobId)}/cancel`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}',
  }, request);
}

export function resumeAppKnowledgeJob(
  jobId: number,
  request: Fetch = fetch,
): Promise<AppKnowledgeJobView> {
  return json(`/api/app-knowledge/jobs/${pathId(jobId)}/resume`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}',
  }, request);
}

export function retryAppKnowledgeJob(
  jobId: number,
  request: Fetch = fetch,
): Promise<AppKnowledgeJobView> {
  return json(`/api/app-knowledge/jobs/${pathId(jobId)}/retry-failed-evidence`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}',
  }, request);
}

export function regenerateAppKnowledge(
  snapshotId: number,
  request: Fetch = fetch,
): Promise<AppKnowledgeJobView> {
  return json(`/api/app-knowledge/snapshots/${pathId(snapshotId)}/regenerations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}',
  }, request);
}

export function saveAppKnowledgeRevision(
  snapshotId: number,
  revisionId: number,
  content: AppKnowledgeSnapshot,
  request: Fetch = fetch,
): Promise<AppKnowledgeRevisionView> {
  pathId(revisionId);
  return json(`/api/app-knowledge/snapshots/${pathId(snapshotId)}/revisions`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ revisionId, content }),
  }, request);
}

export function setAppKnowledgeReviewStatus(
  snapshotId: number,
  revisionId: number,
  status: Exclude<AppKnowledgeReviewStatus, 'superseded'>,
  request: Fetch = fetch,
): Promise<AppKnowledgeRevisionView> {
  pathId(revisionId);
  return json(`/api/app-knowledge/snapshots/${pathId(snapshotId)}/review-status`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ revisionId, status }),
  }, request);
}

export function acknowledgeAppKnowledgeCoverage(
  snapshotId: number,
  revisionId: number,
  note = '',
  request: Fetch = fetch,
): Promise<unknown> {
  pathId(revisionId);
  return json(`/api/app-knowledge/snapshots/${pathId(snapshotId)}/coverage-acknowledgements`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ revisionId, note }),
  }, request);
}

export function recordAppKnowledgeReviewAction(
  snapshotId: number,
  revisionId: number,
  action:
    | 'claim_edited'
    | 'claim_approved'
    | 'claim_rejected'
    | 'component_confirmed'
    | 'component_rejected'
    | 'token_confirmed'
    | 'token_rejected'
    | 'flow_reviewed'
    | 'role_projection_reviewed'
    | 'pilot_auth_accepted'
    | 'snapshot_submitted'
    | 'snapshot_approved',
  entityId: string,
  request: Fetch = fetch,
): Promise<unknown> {
  pathId(revisionId);
  return json(`/api/app-knowledge/snapshots/${pathId(snapshotId)}/review-actions`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ revisionId, action, entityId }),
  }, request);
}

export function subscribeAppKnowledgeJob(
  jobId: number,
  onUpdate: (job: AppKnowledgeJobView) => void,
  onError: (error: Error) => void,
  eventSourceFactory: AppKnowledgeEventSourceFactory = (url) => new EventSource(url),
): () => void {
  pathId(jobId);
  const source = eventSourceFactory(`/api/app-knowledge/jobs/${jobId}/events`);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    source.close();
  };
  source.addEventListener('app-knowledge-progress', ((event: MessageEvent) => {
    try {
      const job = parseAppKnowledgeProgress(JSON.parse(event.data), jobId);
      onUpdate(job);
      if (terminalStatuses.has(job.status)) close();
    } catch (error) {
      close();
      onError(error instanceof Error ? error : new Error('Invalid App Knowledge progress event'));
    }
  }) as EventListener);
  source.addEventListener('error', (() => {
    if (!closed) onError(new Error('App Knowledge progress connection failed'));
  }) as EventListener);
  return close;
}
