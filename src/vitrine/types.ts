import type { CrawlPlan, CrawlStep } from '../crawlPlan';
import type { Platform } from '../platformFromUrl';

export interface Screen {
  id: number;
  type: string;
  productArea: string;
  theme: 'light' | 'dark' | 'mixed';
  visibleStates: string[];
  platform: string;
  description: string | null;
  url: string;
  /** Resized grid-tile preview; use for dense grids, fall back to `url` for lightbox/full view. */
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  layoutPatterns?: string[];
  componentNames?: string[];
  visibleText?: string[];
  capturedAt?: string | null;
  stateContext?: string | null;
  confidence?: number | null;
}

export interface AppSummary {
  id: string;
  app: string;
  cat: string;
  accent: string;
  totalScreens: number;
  platforms?: Platform[];
  analyzedScreens?: number;
  lastCapturedAt?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  previewVideoUrl?: string | null;
}

export interface AppMetadata extends AppSummary {
  totalUiElements: number;
  totalFlows: number;
}

export interface App extends AppSummary {
  screens: Screen[];
}

export interface SitePagePreview {
  id: number;
  title: string;
  position: number;
  url: string;
}

export interface SiteSummary {
  id: number;
  versionId: number;
  name: string;
  slug: string;
  sourceUrl: string;
  label: string;
  isLatest: boolean;
  pageCount: number;
  sectionCount: number;
  previewUrl: string;
  previews: SitePagePreview[];
  updatedAt: string;
}

export interface SiteOcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface SiteVersionOption {
  id: number;
  label: string;
  isLatest: boolean;
  updatedAt: string;
}

export interface SiteSectionView {
  id: number;
  sourceId: string;
  position: number;
  mediaKind: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  cropTop?: number;
  cropBottom?: number;
  videoStartSeconds?: number;
  videoEndSeconds?: number;
  patterns: string[];
  ocrBoxes: SiteOcrBox[];
  sourceMetadata: Record<string, unknown>;
}

export interface SiteVersionPage {
  id: number;
  sourceId: string;
  title: string;
  url: string;
  position: number;
  fullPageImageUrl: string;
  sections: SiteSectionView[];
}

export interface SiteVersionDetail {
  site: { id: number; name: string; slug: string; sourceUrl: string };
  version: { id: number; label: string; isLatest: boolean; previewUrl: string };
  versionOptions: SiteVersionOption[];
  canonicalUrl: string;
  pages: SiteVersionPage[];
}

export type SiteImportResult =
  | { existing: true; siteId: number; versionId: number }
  | { existing: false; id: number };

export type RowStatus = 'Queued' | 'In progress' | 'Complete' | 'Needs attention' | 'Cancelled';

export interface ElementItem {
  category: string;
  type: string;
  height: number;
}

export interface Flow {
  title: string;
  tags: string[];
  steps: string[];
  description: string;
}

export interface Progress {
  id: string;
  stage: 'crawl' | 'caption' | 'synthesize' | 'smart-crawl';
  app: string;
  done: number;
  total: number;
  status: 'running' | 'done' | 'error' | 'cancelled' | 'idle';
  message?: string;
  updatedAt: string;
}

export interface ProgressSnapshot {
  entries: Progress[];
}

export interface Job {
  id: number;
  parent_id: number | null;
  type: 'discover-catalog' | 'import-app' | 'caption-app' | 'synthesize-app' | 'research-app' | 'smart-crawl-app' | 'crawl-public-page';
  payload: { name?: string; url?: string; homepageUrl?: string; provider?: string; runId?: string };
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface JobPipeline {
  root: Job;
  stages: Job[];
}

export interface AdminUser {
  [key: string]: unknown;
  id: number;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
  subscription_status: string | null;
}

export type UserFilter = 'all' | 'admin' | 'pro' | 'free' | 'disabled';
export type UsageRangeKey = '7d' | '30d' | '90d';
export type FeatureKey = 'library' | 'search' | 'collections' | 'exports' | 'research' | 'design_systems' | 'flows' | 'ai_analysis';

export interface AdminUsersPage {
  users: AdminUser[];
  nextCursor: string | null;
  total: number;
}

export interface FeatureUsageRow {
  key: FeatureKey;
  label: string;
  uses: number;
  uniqueUsers: number;
  share: number;
}

export interface FeatureUsageOverview {
  summary: { totalEvents: number; uniqueUsers: number; usedFeatures: number };
  features: FeatureUsageRow[];
  daily: Array<{ day: string; uses: number }>;
}

export interface UserFeatureUsage {
  summary: { totalEvents: number; lastActiveAt: string | null };
  features: FeatureUsageRow[];
  recentEvents: Array<{
    id: number;
    featureKey: FeatureKey;
    featureLabel: string;
    action: string;
    outcome: string;
    appSlug: string | null;
    createdAt: string;
  }>;
}

export interface GrowthStats {
  total_users: number;
  new_users_7d: number;
  active_subscribers: number;
  dau: number;
  wau: number;
  total_free_unlocks: number;
}

export interface DailySignupPoint {
  day: string;
  signups: number;
}

export interface ReferralCampaignMetrics {
  linksCreated: number;
  uniqueReferralVisits: number;
  referredSignups: number;
  referredActivations: number;
  rewardsIssued: number;
  signupToActivationRate: number;
  referredPaidConversions: number;
  organicPaidConversions: number;
  referredRetention: { day7: number; day30: number; day60: number };
  revocations: number;
}

export type CrawlPlanStatus = 'draft' | 'approved' | 'superseded';
export type CrawlRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
export type CrawlRunStepStatus = 'queued' | 'running' | 'completed' | 'skipped' | 'failed';
export type CrawlRepairStatus = 'proposed' | 'applied' | 'rejected';
export type CrawlRetryMode = 'full' | 'failed';
export type CrawlResearchProvider = 'chatgpt' | 'claude';

export interface CrawlRequiredSecretView {
  name: string;
  configured: boolean;
}

export interface CrawlPlanSummary {
  id: string;
  app: string;
  revision: number;
  status: CrawlPlanStatus;
  requiredSecrets: CrawlRequiredSecretView[];
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlPlanView extends CrawlPlanSummary {
  plan: CrawlPlan;
  research_metadata: Record<string, unknown>;
}

export interface CrawlRunEnvironmentView {
  headless?: boolean;
  browserName?: string;
  browserVersion?: string;
  platform?: string;
  workerVersion?: string;
  locale?: string;
  timezone?: string;
  viewport?: { width: number; height: number };
  requestedFlowIds: string[];
  unsafeApproved: boolean;
  disposableAccountAcknowledged: boolean;
  allowSideEffects: boolean;
}

export interface CrawlEvidenceView {
  id: string;
  version_id: number;
  plan_id: string;
  image_id: number;
  flow_id: string;
  step_id: string;
  source_url: string;
  final_url: string;
  state_label: string;
  screenshot_hash: string;
  viewport_width: number;
  viewport_height: number;
  captured_at: string;
  imageUrl?: string;
}

export interface CrawlFailureView {
  flowId: string;
  stepId: string;
  errorClass: string;
  errorMessage: string;
  expected: unknown;
  actual: unknown;
  failureScreenshotUrl?: string;
}

export interface CrawlRunStepView {
  run_id: string;
  flow_id: string;
  step_id: string;
  flow_order: number;
  step_order: number;
  status: CrawlRunStepStatus;
  attempts: number;
  source_url: string | null;
  final_url: string | null;
  expected: unknown | null;
  actual: unknown | null;
  observed_screenshot_hash: string | null;
  evidence_id: string | null;
  error_class: string | null;
  error_message: string | null;
  failureScreenshotUrl?: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface CrawlRepairView {
  id: string;
  plan_id: string;
  run_id: string;
  flow_id: string;
  step_id: string;
  proposed_step: CrawlStep;
  failure: Record<string, unknown>;
  provider: string | null;
  status: CrawlRepairStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  applied_plan_id: string | null;
  created_at: string;
}

export interface CrawlRunView {
  id: string;
  app: string;
  version_id: number;
  plan_id: string | null;
  run_kind: 'planned' | 'autonomous';
  parent_run_id: string | null;
  platform: Platform;
  allow_all: boolean;
  pause_requested_at: string | null;
  status: CrawlRunStatus;
  current_flow_id: string | null;
  current_step_id: string | null;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  cancel_requested_at: string | null;
  retry_of_run_id: string | null;
  retry_mode: 'all' | 'failed' | 'remaining';
  environment: CrawlRunEnvironmentView;
  worker_id: string | null;
  heartbeat_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface CreateAutonomousRunRequest {
  homepageUrl: string;
  platform: Platform;
  provider: CrawlResearchProvider;
  sessionId?: string;
  requiredSecrets: string[];
  allowAll: boolean;
  allowAllAcknowledged: boolean;
  ceilings: { runtimeMinutes: number; actions: number; modelRequests: number; storageBytes: number };
  agentConcurrency: number;
}

export interface AutonomousRunDetailView {
  run: CrawlRunView;
  dossier?: unknown;
  missions: Array<{ id: string; status: string; goal: string; productArea: string; worker_id: string | null }>;
  states: unknown[];
  transitions: unknown[];
}

export interface CrawlSessionView {
  id: string;
  stateVersion: number;
  updatedAt: string;
}

export interface CrawlRunDetailView {
  run: CrawlRunView;
  steps: CrawlRunStepView[];
  evidence?: CrawlEvidenceView[];
  repairs?: CrawlRepairView[];
}

export interface CreateCrawlRunRequest {
  planId: string;
  mode: 'full';
  unsafeApproved?: boolean;
  disposableAccountAcknowledged?: boolean;
  allowSideEffects?: boolean;
  environment?: {
    headless?: boolean;
    browserName?: 'chromium';
    locale?: string;
    timezone?: string;
    viewport?: { width: number; height: number };
  };
}

export interface CrawlRepairRequest {
  flowId: string;
  stepId: string;
  provider?: CrawlResearchProvider;
}

export type {
  DesignSystemSnapshot,
  EvidenceView,
  DesignToken,
  DesignComponent,
} from '../designSystem';
