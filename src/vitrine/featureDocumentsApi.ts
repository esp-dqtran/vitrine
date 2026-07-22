import type {
  FeatureDocumentContent,
  FeatureDocumentJobStage,
  FeatureDocumentJobStatus,
  FeatureDocumentJobView,
  FeatureDocumentReviewStatus,
  FeatureDocumentRevisionView,
  FeatureDocumentShareView,
  FeatureDocumentView,
} from '../featureDocument.ts';
import type { PublicFeatureDocumentShare } from '../featureDocumentStore.ts';

export interface CreateFeatureDocumentRequest {
  app: string;
  platform: 'ios' | 'android' | 'web';
  version: number;
  flowId: string;
  focusInstruction: string;
}

export interface EventSourceLike {
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

const headers = { 'content-type': 'application/json' };
const terminalStatuses = new Set<FeatureDocumentJobStatus>(['done', 'error', 'cancelled', 'stale']);
const statuses = new Set<FeatureDocumentJobStatus>(['queued', 'running', 'done', 'error', 'cancelled', 'stale']);
const stages = new Set<FeatureDocumentJobStage>(['preparing', 'analyzing', 'synthesizing', 'validating', 'saving', 'complete']);

async function json<T>(url: string, init: RequestInit | undefined, request: typeof fetch): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
    const error = new Error(body.error ?? `${url} returned ${response.status}`) as Error & { code?: string; status?: number };
    error.code = body.code;
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function pathId(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid Feature Document identifier');
  return String(value);
}

export function createFeatureDocument(
  input: CreateFeatureDocumentRequest,
  request: typeof fetch = fetch,
): Promise<{ documentId: number; jobId: number }> {
  return json('/api/feature-documents', { method: 'POST', headers, body: JSON.stringify(input) }, request);
}

export function getFeatureDocument(documentId: number, request: typeof fetch = fetch): Promise<FeatureDocumentView> {
  return json(`/api/feature-documents/${pathId(documentId)}`, undefined, request);
}

export function saveFeatureDocumentRevision(
  documentId: number,
  revisionId: number,
  content: FeatureDocumentContent,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentRevisionView> {
  pathId(revisionId);
  return json(`/api/feature-documents/${pathId(documentId)}/revisions`, {
    method: 'PATCH', headers, body: JSON.stringify({ revisionId, content }),
  }, request);
}

export function regenerateFeatureDocument(
  documentId: number,
  focusInstruction: string,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentJobView> {
  return json(`/api/feature-documents/${pathId(documentId)}/regenerations`, {
    method: 'POST', headers, body: JSON.stringify({ focusInstruction }),
  }, request);
}

export function restoreFeatureDocumentRevision(
  documentId: number,
  revisionId: number,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentRevisionView> {
  return json(`/api/feature-documents/${pathId(documentId)}/revisions/${pathId(revisionId)}/restore`, {
    method: 'POST', headers, body: '{}',
  }, request);
}

export function setFeatureDocumentReviewStatus(
  documentId: number,
  revisionId: number,
  status: FeatureDocumentReviewStatus,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentView> {
  return json(`/api/feature-documents/${pathId(documentId)}/review-status`, {
    method: 'POST', headers, body: JSON.stringify({ revisionId, status }),
  }, request);
}

export function acknowledgeFeatureDocumentSourceChange(
  documentId: number,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentView> {
  return json(`/api/feature-documents/${pathId(documentId)}/source-change/acknowledge`, {
    method: 'POST', headers, body: '{}',
  }, request);
}

export function cancelFeatureDocumentJob(jobId: number, request: typeof fetch = fetch): Promise<FeatureDocumentJobView> {
  return json(`/api/feature-document-jobs/${pathId(jobId)}/cancel`, { method: 'POST', headers, body: '{}' }, request);
}

export function retryFeatureDocumentJob(jobId: number, request: typeof fetch = fetch): Promise<FeatureDocumentJobView> {
  return json(`/api/feature-document-jobs/${pathId(jobId)}/retry`, { method: 'POST', headers, body: '{}' }, request);
}

export function createFeatureDocumentShare(
  documentId: number,
  revisionId: number,
  request: typeof fetch = fetch,
): Promise<FeatureDocumentShareView> {
  return json(`/api/feature-documents/${pathId(documentId)}/shares`, {
    method: 'POST', headers, body: JSON.stringify({ revisionId }),
  }, request);
}

export function revokeFeatureDocumentShare(
  documentId: number,
  shareId: number,
  request: typeof fetch = fetch,
): Promise<void> {
  return json(`/api/feature-documents/${pathId(documentId)}/shares/${pathId(shareId)}`, { method: 'DELETE' }, request);
}

export async function downloadFeatureDocumentMarkdown(
  documentId: number,
  revisionId: number,
  request: typeof fetch = fetch,
): Promise<{ blob: Blob; filename: string }> {
  pathId(revisionId);
  const response = await request(`/api/feature-documents/${pathId(documentId)}/export.md?revisionId=${revisionId}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Feature Document export returned ${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `feature-document-${documentId}-r${revisionId}.md`;
  return { blob: await response.blob(), filename };
}

export function getPublicFeatureDocumentShare(token: string, request: typeof fetch = fetch): Promise<PublicFeatureDocumentShare> {
  return json(`/api/feature-document-shares/${encodeURIComponent(token)}`, undefined, request);
}

function parsedJob(value: unknown, expectedJobId: number): FeatureDocumentJobView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Feature Document progress event');
  const job = value as Record<string, unknown>;
  if (
    job.id !== expectedJobId
    || !Number.isSafeInteger(job.documentId) || Number(job.documentId) < 1
    || !statuses.has(job.status as FeatureDocumentJobStatus)
    || !stages.has(job.stage as FeatureDocumentJobStage)
    || !Number.isSafeInteger(job.doneCount) || Number(job.doneCount) < 0
    || !Number.isSafeInteger(job.totalCount) || Number(job.totalCount) < 1
    || Number(job.doneCount) > Number(job.totalCount)
    || typeof job.updatedAt !== 'string'
  ) throw new Error('Invalid Feature Document progress event');
  return job as unknown as FeatureDocumentJobView;
}

export function subscribeFeatureDocumentJob(
  jobId: number,
  onUpdate: (job: FeatureDocumentJobView) => void,
  onError: (error: Error) => void,
  createEventSource: EventSourceFactory = (url) => new EventSource(url),
): () => void {
  pathId(jobId);
  const source = createEventSource(`/api/feature-document-jobs/${jobId}/events`);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    source.close();
  };
  source.addEventListener('feature-document-progress', ((event: MessageEvent) => {
    try {
      const job = parsedJob(JSON.parse(event.data), jobId);
      onUpdate(job);
      if (terminalStatuses.has(job.status)) close();
    } catch (error) {
      close();
      onError(error instanceof Error ? error : new Error('Invalid Feature Document progress event'));
    }
  }) as EventListener);
  source.addEventListener('error', (() => {
    if (!closed) onError(new Error('Feature Document progress connection failed'));
  }) as EventListener);
  return close;
}
