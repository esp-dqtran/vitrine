import type { AppVersion } from '../db';
import type { DesignFlow, EvidenceView } from '../designSystem';
import type { Platform } from '../platformFromUrl';
import type { AppMetadata, Screen } from './types';

type Requester = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface EvidenceSectionRequest {
  platform: Platform;
  version?: number;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface EvidenceSectionPage {
  screens: Screen[];
  nextCursor: string | null;
  platform: Platform;
  version: AppVersion | null;
}

export interface FlowSectionRequest {
  platform: Platform;
  version?: number;
  signal?: AbortSignal;
}

export interface FlowSectionResult {
  flows: DesignFlow<EvidenceView>[];
  platform: Platform;
  version: AppVersion | null;
}

export interface UiElementSummaryItem {
  type: string;
  group: string;
  count: number;
  imageId: number;
  imageUrl: string;
  thumbnailUrl: string;
  description: string | null;
  purpose: string | null;
  visibleStates: string[];
}

export interface UiElementSummaryResult {
  items: UiElementSummaryItem[];
  totalOccurrences: number;
  totalTypes: number;
  platform: Platform;
  version: AppVersion | null;
}

async function responseJson<T>(response: Response, endpoint: string): Promise<T> {
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchAppMetadata(
  appId: string,
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<AppMetadata> {
  const endpoint = `/api/apps/${encodeURIComponent(appId)}`;
  const response = await request(endpoint, { signal });
  const body = await responseJson<{ app: AppMetadata }>(response, endpoint);
  return body.app;
}

function evidenceUrl(appId: string, section: 'screens' | 'ui-elements', input: EvidenceSectionRequest): string {
  const params = new URLSearchParams({ platform: input.platform });
  if (input.version !== undefined) params.set('version', String(input.version));
  if (input.cursor) params.set('cursor', input.cursor);
  params.set('limit', String(input.limit ?? 48));
  return `/api/apps/${encodeURIComponent(appId)}/${section}?${params.toString()}`;
}

async function fetchEvidenceSection(
  appId: string,
  section: 'screens' | 'ui-elements',
  input: EvidenceSectionRequest,
  request: Requester,
): Promise<EvidenceSectionPage> {
  const endpoint = evidenceUrl(appId, section, input);
  const response = await request(endpoint, { signal: input.signal });
  return responseJson<EvidenceSectionPage>(response, endpoint);
}

export function fetchAppScreens(
  appId: string,
  input: EvidenceSectionRequest,
  request: Requester = fetch,
): Promise<EvidenceSectionPage> {
  return fetchEvidenceSection(appId, 'screens', input, request);
}

export function fetchAppUiElements(
  appId: string,
  input: EvidenceSectionRequest,
  request: Requester = fetch,
): Promise<EvidenceSectionPage> {
  return fetchEvidenceSection(appId, 'ui-elements', input, request);
}

export async function fetchAppUiElementSummary(
  appId: string,
  input: Omit<EvidenceSectionRequest, 'cursor'>,
  request: Requester = fetch,
): Promise<UiElementSummaryResult> {
  const params = new URLSearchParams({ platform: input.platform });
  if (input.version !== undefined) params.set('version', String(input.version));
  params.set('limit', String(input.limit ?? 12));
  const endpoint = `/api/apps/${encodeURIComponent(appId)}/ui-element-summary?${params.toString()}`;
  const response = await request(endpoint, { signal: input.signal });
  return responseJson<UiElementSummaryResult>(response, endpoint);
}

export async function fetchAppFlows(
  appId: string,
  input: FlowSectionRequest,
  request: Requester = fetch,
): Promise<FlowSectionResult> {
  const params = new URLSearchParams({ platform: input.platform });
  if (input.version !== undefined) params.set('version', String(input.version));
  const endpoint = `/api/apps/${encodeURIComponent(appId)}/flows?${params.toString()}`;
  const response = await request(endpoint, { signal: input.signal });
  return responseJson<FlowSectionResult>(response, endpoint);
}
