export const RESEARCH_LIMITS = {
  lanesMin: 2,
  lanesMax: 5,
  itemsMax: 100,
  privateUploadsMax: 25,
  uploadBytesMax: 10 * 1024 * 1024,
  tagsMax: 12,
} as const;

export type ResearchPlatform = "all" | "ios" | "android" | "web";
export type ResearchSourceKind = "catalog_screen" | "catalog_flow_step" | "private_upload";

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
  projectId: number;
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
  alternatives: Array<{ title: string; tradeoff: string; evidenceIds: string[] }>;
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
  id: number;
  title: string;
  question: string;
  platformFilter: ResearchPlatform;
  constraints: string;
  decision: string;
  rationale: string;
  openQuestions: string;
  revision: number;
  lanes: ResearchProjectLane[];
  synthesis?: ResearchSynthesisView;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProjectSummary {
  id: number;
  title: string;
  question: string;
  platformFilter: ResearchPlatform;
  evidenceCount: number;
  synthesisState: "none" | "current" | "stale";
  updatedAt: string;
}

export interface CreateResearchProjectInput {
  title: string;
  question: string;
  platformFilter: ResearchPlatform;
}

export interface ProjectPatch {
  title?: string;
  question?: string;
  platformFilter?: ResearchPlatform;
  constraints?: string;
  decision?: string;
  rationale?: string;
  openQuestions?: string;
}

export interface CreateLaneInput {
  projectId: number;
  expectedRevision: number;
  title: string;
}

export interface UpdateLaneInput {
  projectId: number;
  laneId: number;
  expectedRevision: number;
  title?: string;
  conclusion?: string;
  position?: number;
}

export interface DeleteLaneInput {
  projectId: number;
  laneId: number;
  expectedRevision: number;
}

export interface AddResearchItemInput {
  projectId: number;
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

export interface UpdateResearchItemInput {
  projectId: number;
  itemId: number;
  expectedRevision: number;
  stepLabel?: string;
  note?: string;
  tags?: string[];
  important?: boolean;
}

export interface MoveResearchItemInput {
  projectId: number;
  itemId: number;
  targetLaneId: number;
  targetPosition: number;
  expectedRevision: number;
}

export interface RemoveResearchItemInput {
  projectId: number;
  itemId: number;
  expectedRevision: number;
}

export interface RecordedSynthesis {
  projectId: number;
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
