import type { Platform } from "../platformFromUrl.ts";

export interface ProjectDocumentFlowInsertItem {
  app: string;
  appIconUrl?: string | null;
  appId?: string;
  description: string;
  id: string;
  platform?: Platform;
  previews: Array<{ label: string; url: string }>;
  source: "catalog" | "project";
  stepCount: number;
  title: string;
}

interface ProjectDocumentFlowInsertIntent {
  version: 1;
  projectId: string;
  flow: ProjectDocumentFlowInsertItem;
}

const keyPrefix = "vitrines:project-document-flow-insert:";
const pendingIntents = new Map<string, ProjectDocumentFlowInsertIntent>();
const intentKey = (projectId: string) => `${keyPrefix}${projectId}`;

const isFlow = (value: unknown): value is ProjectDocumentFlowInsertItem => {
  if (!value || typeof value !== "object") return false;
  const flow = value as Partial<ProjectDocumentFlowInsertItem>;
  return typeof flow.id === "string"
    && Boolean(flow.id.trim())
    && typeof flow.title === "string"
    && Boolean(flow.title.trim())
    && typeof flow.app === "string"
    && typeof flow.description === "string"
    && (flow.source === "catalog" || flow.source === "project")
    && Number.isSafeInteger(flow.stepCount)
    && Number(flow.stepCount) >= 0
    && Array.isArray(flow.previews)
    && flow.previews.every((preview) => Boolean(
      preview
      && typeof preview.label === "string"
      && typeof preview.url === "string",
    ));
};

export function storeProjectDocumentFlowInsertIntent(
  projectId: string,
  flow: ProjectDocumentFlowInsertItem,
  storage: Pick<Storage, "setItem"> = window.sessionStorage,
): void {
  if (!projectId.trim() || !isFlow(flow)) {
    throw new Error("Invalid project document Flow handoff");
  }
  const intent: ProjectDocumentFlowInsertIntent = {
    version: 1,
    projectId,
    flow,
  };
  pendingIntents.set(projectId, intent);
  storage.setItem(intentKey(projectId), JSON.stringify(intent));
}

export function consumeProjectDocumentFlowInsertIntent(
  projectId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = window.sessionStorage,
): ProjectDocumentFlowInsertItem | undefined {
  const key = intentKey(projectId);
  const pending = pendingIntents.get(projectId);
  pendingIntents.delete(projectId);
  const raw = pending ? JSON.stringify(pending) : storage.getItem(key);
  storage.removeItem(key);
  if (!raw) return undefined;
  try {
    const intent = JSON.parse(raw) as Partial<ProjectDocumentFlowInsertIntent>;
    return intent.version === 1
      && intent.projectId === projectId
      && isFlow(intent.flow)
      ? intent.flow
      : undefined;
  } catch {
    return undefined;
  }
}
