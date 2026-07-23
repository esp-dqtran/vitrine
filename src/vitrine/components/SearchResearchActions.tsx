import { useEffect, useState } from "react";
import type { ResearchCollection } from "../../db.ts";
import type {
  AddResearchItemInput,
  ResearchProjectSummary,
  ResearchProjectWorkspace,
} from "../../researchProject.ts";
import type { SearchResultItem } from "../../searchTypes.ts";
import {
  addResearchItem,
  getResearchProject,
  listResearchProjects,
} from "../researchProjectsApi.ts";
import type { SaveReference } from "../researchApi.ts";
import { CollectionPicker } from "./CollectionPicker.tsx";

export function searchCollectionReference(item: SearchResultItem): SaveReference {
  return {
    kind: item.entityType,
    app: item.appName,
    referenceId: item.sourceId,
    title: item.title,
  };
}

export function researchItemInput(
  item: SearchResultItem,
  project: ResearchProjectWorkspace,
  laneId: number,
): AddResearchItemInput {
  const versionId = Number(item.sourcePayload.versionId ?? item.versionId);
  const imageId = Number(item.sourcePayload.mediaImageId ?? item.mediaImageId);
  if (!Number.isSafeInteger(versionId) || !Number.isSafeInteger(imageId)) {
    throw new Error("This result has no stable catalog evidence");
  }
  return {
    projectId: project.id,
    laneId,
    expectedRevision: project.revision,
    sourceKind: item.entityType === "screen" ? "catalog_screen" : "catalog_flow_step",
    snapshot: {
      title: item.title,
      app: item.appName,
      platform: item.platform,
      flow: item.flowName,
      capturedAt: item.capturedAt,
      sourcePath: item.sourceId,
      description: item.description,
    },
    catalog: {
      app: item.appName,
      versionId,
      imageId,
      ...(item.flowId ? { flowId: item.flowId } : {}),
      ...(item.flowStepIndex !== undefined ? { stepIndex: item.flowStepIndex } : {}),
    },
  };
}

export function addResultToProject(
  item: SearchResultItem,
  project: ResearchProjectWorkspace,
  laneId: number,
  add: typeof addResearchItem = addResearchItem,
) {
  return add(researchItemInput(item, project, laneId));
}

export function addComparisonSelection(
  selected: SearchResultItem[],
  item: SearchResultItem,
): SearchResultItem[] {
  if (selected.some(({ appId }) => appId === item.appId)) return selected;
  if (selected.length >= 5) throw new Error("Compare supports up to five distinct apps");
  return [...selected, item];
}

export function SearchResearchActions({
  item,
  collections,
  onCollectionsChange,
  plan,
  comparison,
  onComparisonChange,
}: {
  item: SearchResultItem;
  collections: ResearchCollection[];
  onCollectionsChange(collections: ResearchCollection[]): void;
  plan: "free" | "pro";
  comparison: SearchResultItem[];
  onComparisonChange(items: SearchResultItem[]): void;
}) {
  const [projects, setProjects] = useState<ResearchProjectSummary[]>([]);
  const [workspace, setWorkspace] = useState<ResearchProjectWorkspace | null>(null);
  const [laneId, setLaneId] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void listResearchProjects().then(setProjects).catch(() => setProjects([]));
  }, []);
  const selected = comparison.some(({ appId }) => appId === item.appId);
  return (
    <div className="advanced-search-research-actions">
      <CollectionPicker
        reference={searchCollectionReference(item)}
        collections={collections}
        onCollectionsChange={onCollectionsChange}
        plan={plan}
      />
      <label>
        Project
        <select value={workspace?.id ?? ""} onChange={async (event) => {
          const next = await getResearchProject(Number(event.target.value));
          setWorkspace(next);
          setLaneId(next.lanes[0]?.id ?? 0);
        }}>
          <option value="">Choose project</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
      </label>
      {workspace ? (
        <label>
          Lane
          <select value={laneId} onChange={(event) => setLaneId(Number(event.target.value))}>
            {workspace.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        disabled={!workspace || !laneId || !item.versionId || !item.mediaImageId}
        onClick={async () => {
          if (!workspace) return;
          try {
            setWorkspace(await addResultToProject(item, workspace, laneId));
            setMessage("Added to project");
          } catch (error) {
            setMessage((error as Error).message);
          }
        }}
      >Add to research project</button>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          if (selected) {
            onComparisonChange(comparison.filter(({ appId }) => appId !== item.appId));
            return;
          }
          try {
            onComparisonChange(addComparisonSelection(comparison, item));
          } catch (error) {
            setMessage((error as Error).message);
          }
        }}
      >{selected ? "Remove from compare" : "Compare app"}</button>
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}
