export const RESEARCH_LIMITS = {
  lanesMin: 2,
  lanesMax: 5,
  itemsMax: 100,
  privateUploadsMax: 25,
  uploadBytesMax: 10 * 1024 * 1024,
  tagsMax: 12,
} as const;

export type ResearchPlatform = "all" | "ios" | "android" | "web";

export const RESEARCH_PROJECT_ICONS = [
  "initial",
  "folder",
  "grid",
  "book",
  "sparkle",
] as const;

export type ResearchProjectIcon = (typeof RESEARCH_PROJECT_ICONS)[number];

export function normalizeResearchProjectIcon(
  value: unknown,
): ResearchProjectIcon {
  return RESEARCH_PROJECT_ICONS.includes(value as ResearchProjectIcon)
    ? (value as ResearchProjectIcon)
    : "initial";
}
export type ResearchSourceKind =
  | "catalog_screen"
  | "catalog_flow_step"
  | "private_upload";
export type ResearchProjectId = string;

const researchProjectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeResearchProjectId(
  value: unknown,
): ResearchProjectId | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return researchProjectIdPattern.test(normalized) ? normalized : undefined;
}

export interface ResearchEvidenceSnapshot {
  title: string;
  app?: string;
  platform?: string;
  flow?: string;
  step?: string;
  state?: string;
  capturedAt?: string;
  sourcePath?: string;
  description?: string;
}

export interface ResearchProjectItem {
  id: number;
  appId?: string;
  appIconUrl?: string;
  projectId: ResearchProjectId;
  laneId: number;
  position: number;
  sourceKind: ResearchSourceKind;
  stepLabel: string;
  note: string;
  tags: string[];
  important: boolean;
  snapshot: ResearchEvidenceSnapshot;
  mediaUrl?: string;
  restricted?: boolean;
}

export interface ResearchProjectLane {
  id: number;
  title: string;
  position: number;
  conclusion: string;
  items: ResearchProjectItem[];
}

export interface CitedResearchText {
  text: string;
  evidenceIds: string[];
}

export interface ResearchSynthesisResult {
  executiveRead: string;
  observations: CitedResearchText[];
  differences: CitedResearchText[];
  alternatives: Array<{
    title: string;
    tradeoff: string;
    evidenceIds: string[];
  }>;
  recommendation: CitedResearchText;
  requirements: CitedResearchText[];
  openQuestions: string[];
}

export interface ResearchSynthesisView {
  id: number;
  projectRevision: number;
  stale: boolean;
  result: ResearchSynthesisResult;
  createdAt: string;
}

export interface ResearchProjectWorkspace {
  id: ResearchProjectId;
  title: string;
  icon?: ResearchProjectIcon;
  question: string;
  platformFilter: ResearchPlatform;
  pinned: boolean;
  constraints: string;
  decision: string;
  rationale: string;
  openQuestions: string;
  revision: number;
  lanes: ResearchProjectLane[];
  synthesis?: ResearchSynthesisView;
  createdAt: string;
  updatedAt: string;
  organization?: ResearchProjectOrganization;
  access?: ResearchProjectAccess;
}

export interface ResearchProjectCanvas {
  snapshot: Record<string, unknown> | null;
  revision: number;
  updatedAt?: string;
}

export interface ResearchProjectSummary {
  id: ResearchProjectId;
  title: string;
  icon?: ResearchProjectIcon;
  question: string;
  platformFilter: ResearchPlatform;
  pinned: boolean;
  revision: number;
  evidenceCount: number;
  synthesisState: "none" | "current" | "stale";
  updatedAt: string;
  organization?: ResearchProjectOrganization;
  access?: ResearchProjectAccess;
}

export interface ResearchProjectOrganization {
  id: number;
  name: string;
  role?: "owner" | "admin" | "member";
}

export type ResearchProjectMemberRole = "editor" | "viewer";

export interface ResearchProjectAccess {
  role: "owner" | ResearchProjectMemberRole;
  source: "personal" | "team" | "direct";
  canManage: boolean;
}

export interface ResearchProjectMember {
  userId: number;
  email: string;
  role: ResearchProjectMemberRole;
  createdAt: string;
}

export interface ResearchProjectMembersView {
  members: ResearchProjectMember[];
  canManage: boolean;
  organization?: Pick<ResearchProjectOrganization, "id" | "name">;
}

export interface CreateResearchProjectInput {
  title: string;
  question?: string;
  platformFilter?: ResearchPlatform;
  organizationId?: number;
}

export interface ProjectPatch {
  title?: string;
  icon?: ResearchProjectIcon;
  question?: string;
  platformFilter?: ResearchPlatform;
  pinned?: boolean;
  constraints?: string;
  decision?: string;
  rationale?: string;
  openQuestions?: string;
}

export interface CreateLaneInput {
  projectId: ResearchProjectId;
  expectedRevision: number;
  title: string;
}

export interface UpdateLaneInput {
  projectId: ResearchProjectId;
  laneId: number;
  expectedRevision: number;
  title?: string;
  conclusion?: string;
  position?: number;
}

export interface DeleteLaneInput {
  projectId: ResearchProjectId;
  laneId: number;
  expectedRevision: number;
}

export interface AddResearchItemInput {
  projectId: ResearchProjectId;
  laneId: number;
  expectedRevision: number;
  sourceKind: ResearchSourceKind;
  snapshot: ResearchEvidenceSnapshot;
  catalog?: {
    app: string;
    versionId: number;
    imageId: number;
    flowId?: string;
    stepIndex?: number;
  };
  privateObjectKey?: string;
}

export interface AttachResearchFlowInput {
  projectId: ResearchProjectId;
  laneId: number;
  expectedRevision: number;
  catalog: {
    app: string;
    appId: string;
    versionId: number;
    flowId: string;
    platform: Exclude<ResearchPlatform, "all">;
    title: string;
    description?: string;
  };
}

export interface UpdateResearchItemInput {
  projectId: ResearchProjectId;
  itemId: number;
  expectedRevision: number;
  stepLabel?: string;
  note?: string;
  tags?: string[];
  important?: boolean;
}

export interface MoveResearchItemInput {
  projectId: ResearchProjectId;
  itemId: number;
  targetLaneId: number;
  targetPosition: number;
  expectedRevision: number;
}

export interface RemoveResearchItemInput {
  projectId: ResearchProjectId;
  itemId: number;
  expectedRevision: number;
}

export interface RecordedSynthesis {
  projectId: ResearchProjectId;
  projectRevision: number;
  status: "complete" | "failed";
  result?: ResearchSynthesisResult;
  errorCode?: string;
  model: string;
  schemaVersion: number;
}

export class ResearchProjectConflictError extends Error {
  readonly actualRevision: number;

  constructor(actualRevision: number) {
    super("Research project revision conflict");
    this.actualRevision = actualRevision;
  }
}

export function assertExpectedRevision(actual: number, expected: number): void {
  if (actual !== expected) throw new ResearchProjectConflictError(actual);
}

export const defaultResearchLanes = () => [
  { title: "Alternative A", position: 0 },
  { title: "Alternative B", position: 1 },
];

export function normalizeResearchTags(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || value.length > 40 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, RESEARCH_LIMITS.tagsMax);
}
