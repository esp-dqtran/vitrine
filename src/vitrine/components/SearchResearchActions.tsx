import { useEffect, useState } from "react";
import { Button, Selector } from "@astryxdesign/core";
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
  if (item.entityType === "site" || !item.appName) {
    throw new Error("Site references are not supported by App collections");
  }
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
  if (item.catalogScope !== "apps" || !item.appName) {
    throw new Error("This result is not App catalog evidence");
  }
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
  if (item.catalogScope !== "apps" || item.appId === undefined) {
    throw new Error("Only Apps can be compared");
  }
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
  if (item.catalogScope !== "apps" || item.appId === undefined || !item.appName) {
    return null;
  }
  const appId = item.appId;
  const selected = comparison.some(({ appId }) => appId === item.appId);
  return (
    <div className="advanced-search-research-actions">
      <CollectionPicker
        reference={searchCollectionReference(item)}
        collections={collections}
        onCollectionsChange={onCollectionsChange}
        plan={plan}
      />
      <Selector
        label="Project"
        value={workspace ? String(workspace.id) : undefined}
        placeholder="Choose project"
        options={projects.map((project) => ({ value: String(project.id), label: project.title }))}
        onChange={async (value) => {
          const next = await getResearchProject(Number(value));
          setWorkspace(next);
          setLaneId(next.lanes[0]?.id ?? 0);
        }}
      />
      {workspace ? (
        <Selector
          label="Lane"
          value={laneId ? String(laneId) : undefined}
          options={workspace.lanes.map((lane) => ({ value: String(lane.id), label: lane.title }))}
          onChange={(value) => setLaneId(Number(value))}
        />
      ) : null}
      <Button
        label="Add to research project"
        isDisabled={!workspace || !laneId || !item.versionId || !item.mediaImageId}
        clickAction={async () => {
          if (!workspace) return;
          try {
            setWorkspace(await addResultToProject(item, workspace, laneId));
            setMessage("Added to project");
          } catch (error) {
            setMessage((error as Error).message);
          }
        }}
      />
      <Button
        label={selected ? "Remove from compare" : "Compare app"}
        variant="secondary"
        aria-pressed={selected}
        onClick={() => {
          if (selected) {
            onComparisonChange(comparison.filter(({ appId: selectedAppId }) => selectedAppId !== appId));
            return;
          }
          try {
            onComparisonChange(addComparisonSelection(comparison, item));
          } catch (error) {
            setMessage((error as Error).message);
          }
        }}
      />
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}
