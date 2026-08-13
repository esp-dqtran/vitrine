import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from "@blocknote/core";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { Button, Icon, IconButton } from "@astryxdesign/core";

import type { DesignFlow, EvidenceView } from "../../designSystem.ts";
import type { Platform } from "../../platformFromUrl.ts";
import type { ResearchProjectWorkspace } from "../../researchProject.ts";
import {
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from "../flowCatalogApi.ts";
import { FlowCard } from "./FlowCard.tsx";
import type { ProjectDocumentFlowInsertItem } from "../projectDocumentFlowInsertIntent.ts";

export interface ProjectDocumentFlowOption extends ProjectDocumentFlowInsertItem {
  catalog?: {
    app: string;
    appId: string;
    versionId: number;
    flowId: string;
    platform: Platform;
    title: string;
    description: string;
  };
}

export type ProjectDocumentEvidenceType = "screen" | "flow" | "upload";

export interface ProjectDocumentEvidenceOption {
  app: string;
  appIconUrl: string;
  appId: string;
  capturedAt: string;
  description: string;
  id: string;
  lane: string;
  mediaUrl: string;
  platform: string;
  sourcePath: string;
  stepCount?: number;
  title: string;
  type: ProjectDocumentEvidenceType;
}

const FLOW_PREVIEW_LIMIT = 24;

export const projectFlowReferenceId = (app: string, title: string): string =>
  `project-flow:${encodeURIComponent(app.trim().toLowerCase() || "unknown")}:${encodeURIComponent(title.trim().toLowerCase())}`;

export function projectDocumentFlowOptions(
  workspace: ResearchProjectWorkspace,
): ProjectDocumentFlowOption[] {
  const groups = new Map<string, ProjectDocumentFlowOption>();

  for (const lane of workspace.lanes) {
    for (const item of lane.items) {
      if (item.sourceKind !== "catalog_flow_step") continue;
      const title = item.snapshot.flow?.trim() || item.snapshot.title.trim();
      if (!title) continue;
      const app = item.snapshot.app?.trim() || "Unknown app";
      const appId = item.appId?.trim();
      const id = projectFlowReferenceId(app, title);
      const existing = groups.get(id) ?? {
        app,
        ...(item.appIconUrl ? { appIconUrl: item.appIconUrl } : {}),
        ...(appId ? { appId } : {}),
        description: item.snapshot.description?.trim() || "",
        id,
        previews: [],
        source: "project",
        stepCount: 0,
        title,
      };

      existing.stepCount += 1;
      if (!existing.description && item.snapshot.description?.trim()) {
        existing.description = item.snapshot.description.trim();
      }
      if (!existing.appIconUrl && item.appIconUrl) existing.appIconUrl = item.appIconUrl;
      if (!existing.appId && appId) existing.appId = appId;
      if (item.mediaUrl && existing.previews.length < FLOW_PREVIEW_LIMIT) {
        existing.previews.push({
          label: item.snapshot.step?.trim() || item.stepLabel.trim() || item.snapshot.title,
          url: item.mediaUrl,
        });
      }
      groups.set(id, existing);
    }
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.app.localeCompare(right.app) || left.title.localeCompare(right.title));
}

export function projectDocumentEvidenceOptions(
  workspace: ResearchProjectWorkspace,
): ProjectDocumentEvidenceOption[] {
  return workspace.lanes.flatMap((lane) => lane.items.flatMap((item) => {
    if (item.sourceKind !== "catalog_screen" && item.sourceKind !== "private_upload") {
      return [];
    }
    return [{
      app: item.snapshot.app?.trim() ?? "",
      appIconUrl: item.appIconUrl?.trim() ?? "",
      appId: item.appId?.trim() ?? "",
      capturedAt: item.snapshot.capturedAt?.trim() ?? "",
      description: item.snapshot.description?.trim() || item.note.trim(),
      id: `project-evidence:${item.id}`,
      lane: lane.title.trim(),
      mediaUrl: item.mediaUrl?.trim() ?? "",
      platform: item.snapshot.platform?.trim() ?? "",
      sourcePath: item.snapshot.sourcePath?.trim() ?? "",
      title: item.snapshot.title.trim() || item.stepLabel.trim() || "Untitled evidence",
      type: item.sourceKind === "private_upload" ? "upload" : "screen",
    } satisfies ProjectDocumentEvidenceOption];
  }));
}

export function catalogFlowOption(
  item: FlowCatalogItem,
  platform: Platform,
): ProjectDocumentFlowOption {
  const previews = item.preview.flow.steps.flatMap((step) => {
    const evidence = step.evidence[0];
    return evidence?.thumbnailUrl ? [{ label: step.label, url: evidence.thumbnailUrl }] : [];
  }).slice(0, FLOW_PREVIEW_LIMIT);
  return {
    app: item.preview.appName,
    appIconUrl: item.preview.appIconUrl,
    appId: item.preview.appId,
    catalog: {
      app: item.preview.appName,
      appId: item.preview.appId,
      versionId: item.preview.versionId,
      flowId: item.preview.sourceFlowId,
      platform,
      title: item.preview.flow.title || item.title,
      description: item.preview.flow.description,
    },
    description: item.preview.flow.description,
    id: `catalog-flow:${platform}:${encodeURIComponent(item.preview.appId)}:${item.preview.version}:${encodeURIComponent(item.preview.sourceFlowId)}`,
    platform,
    previews,
    source: "catalog",
    stepCount: item.preview.screenCount || item.preview.flow.steps.length,
    title: item.preview.flow.title || item.title,
  };
}

export function projectDocumentFlowView(
  option: ProjectDocumentFlowOption,
): DesignFlow<EvidenceView> {
  return {
    id: option.id,
    title: option.title || "Untitled flow",
    description: option.description,
    tags: [],
    steps: option.previews.map((preview, index) => ({
      label: preview.label || `Step ${index + 1}`,
      evidence: [{
        imageId: index + 1,
        imageUrl: preview.url,
        thumbnailUrl: preview.url,
        description: preview.label || null,
      }],
    })),
  };
}

function previewSnapshot(value: string): ProjectDocumentFlowOption["previews"] {
  if (!value) return [];
  try {
    const previews = JSON.parse(value) as unknown;
    if (!Array.isArray(previews)) return [];
    return previews.filter((preview): preview is { label: string; url: string } => Boolean(
      preview
      && typeof preview === "object"
      && typeof (preview as { label?: unknown }).label === "string"
      && typeof (preview as { url?: unknown }).url === "string",
    )).slice(0, FLOW_PREVIEW_LIMIT);
  } catch {
    return [];
  }
}

interface ProjectDocumentFlowContextValue {
  evidence: ProjectDocumentEvidenceOption[];
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  onAttachCatalogFlow?: (option: ProjectDocumentFlowOption) => Promise<ProjectDocumentFlowOption>;
}

const ProjectDocumentFlowContext = createContext<ProjectDocumentFlowContextValue>({
  evidence: [],
  flows: [],
  initialPlatform: "web",
});

export function ProjectDocumentFlowProvider({
  children,
  evidence = [],
  flows,
  initialPlatform,
  onAttachCatalogFlow,
}: {
  children: ReactNode;
  evidence?: ProjectDocumentEvidenceOption[];
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  onAttachCatalogFlow?: (option: ProjectDocumentFlowOption) => Promise<ProjectDocumentFlowOption>;
}) {
  const value = useMemo(
    () => ({ evidence, flows, initialPlatform, onAttachCatalogFlow }),
    [evidence, flows, initialPlatform, onAttachCatalogFlow],
  );
  return (
    <ProjectDocumentFlowContext.Provider value={value}>
      {children}
    </ProjectDocumentFlowContext.Provider>
  );
}

const astryxReferenceBlock = createReactBlockSpec(
  {
    type: "astryxReference",
    propSchema: {
      referenceType: { default: "flow", values: ["flow"] as const },
      referenceId: { default: "" },
      source: { default: "project", values: ["project", "catalog"] as const },
      title: { default: "" },
      app: { default: "" },
      appIconUrl: { default: "" },
      appId: { default: "" },
      description: { default: "" },
      platform: { default: "" },
      previewSnapshot: { default: "" },
      stepCount: { default: 0 },
    },
    content: "none",
  } as const,
  {
    render: ({ block, editor }) => {
      const { flows, initialPlatform, onAttachCatalogFlow } = useContext(ProjectDocumentFlowContext);
      const [pickerOpen, setPickerOpen] = useState(!block.props.referenceId);
      const [query, setQuery] = useState("");
      const [platform, setPlatform] = useState<Platform>(
        block.props.platform === "ios" || block.props.platform === "android" || block.props.platform === "web"
          ? block.props.platform
          : initialPlatform,
      );
      const [catalogFlows, setCatalogFlows] = useState<ProjectDocumentFlowOption[]>([]);
      const [catalogTotal, setCatalogTotal] = useState(0);
      const [catalogLoading, setCatalogLoading] = useState(false);
      const [catalogError, setCatalogError] = useState("");
      const [attachError, setAttachError] = useState("");
      const [attachingId, setAttachingId] = useState("");
      const normalizedQuery = query.trim().toLocaleLowerCase();
      const projectFlows = flows.filter((flow) => !normalizedQuery
        || flow.title.toLocaleLowerCase().includes(normalizedQuery)
        || flow.app.toLocaleLowerCase().includes(normalizedQuery));
      const current = [...flows, ...catalogFlows]
        .find((flow) => flow.id === block.props.referenceId);
      const flow = current ?? (block.props.referenceId ? {
        app: block.props.app,
        appIconUrl: block.props.appIconUrl || undefined,
        appId: block.props.appId || undefined,
        description: block.props.description,
        id: block.props.referenceId,
        platform: block.props.platform === "ios" || block.props.platform === "android" || block.props.platform === "web"
          ? block.props.platform
          : undefined,
        previews: previewSnapshot(block.props.previewSnapshot),
        source: block.props.source,
        stepCount: block.props.stepCount,
        title: block.props.title,
      } : undefined);

      useEffect(() => {
        if (!pickerOpen) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
          setCatalogLoading(true);
          setCatalogError("");
          void loadFlowCatalogPage({
            platform,
            query: query.trim() || undefined,
            limit: 12,
          }, controller.signal)
            .then((page) => {
              setCatalogFlows(page.items.map((item) => catalogFlowOption(item, platform)));
              setCatalogTotal(page.totalCount);
            })
            .catch((cause) => {
              if (controller.signal.aborted) return;
              setCatalogFlows([]);
              setCatalogTotal(0);
              setCatalogError((cause as Error).message);
            })
            .finally(() => {
              if (!controller.signal.aborted) setCatalogLoading(false);
            });
        }, query.trim() ? 220 : 0);
        return () => {
          window.clearTimeout(timeout);
          controller.abort();
        };
      }, [pickerOpen, platform, query]);

      const applyFlow = (option: ProjectDocumentFlowOption) => {
        editor.updateBlock(block, {
          props: {
            referenceType: "flow",
            referenceId: option.id,
            source: option.source,
            title: option.title,
            app: option.app,
            appIconUrl: option.appIconUrl ?? "",
            appId: option.appId ?? "",
            description: option.description,
            platform: option.platform ?? "",
            previewSnapshot: JSON.stringify(option.previews),
            stepCount: option.stepCount,
          },
        });
        setPickerOpen(false);
      };

      const chooseFlow = async (option: ProjectDocumentFlowOption) => {
        if (option.source !== "catalog" || !onAttachCatalogFlow) {
          applyFlow(option);
          return;
        }
        setAttachingId(option.id);
        setAttachError("");
        try {
          applyFlow(await onAttachCatalogFlow(option));
        } catch (cause) {
          setAttachError((cause as Error).message);
        } finally {
          setAttachingId("");
        }
      };

      return (
        <div className="project-flow-block" contentEditable={false}>
          {flow ? (
            <article className="project-flow-block__card" aria-label={`Flow: ${flow.title}`}>
              <div className="project-flow-block__header">
                <span className="project-flow-block__type">
                  <Icon icon="viewColumns" size="sm" />
                  Flow
                </span>
                {editor.isEditable ? (
                  <Button
                    className="project-flow-block__change"
                    label="Change"
                    variant="ghost"
                    size="sm"
                    aria-expanded={pickerOpen}
                    onClick={() => setPickerOpen((open) => !open)}
                  />
                ) : null}
              </div>
              <div className="project-flow-block__body">
                <FlowCard
                  flow={projectDocumentFlowView(flow)}
                  platform={flow.platform ?? initialPlatform}
                  screenCount={flow.stepCount}
                  metaLabel={`${flow.app || "Unknown app"} · ${flow.stepCount} ${flow.stepCount === 1 ? "screen" : "screens"}`}
                  sourceAppName={flow.app || "Unknown app"}
                  sourceAppIconUrl={flow.appIconUrl}
                  onOpenSourceApp={flow.appId
                    ? () => window.location.assign(`/apps/${encodeURIComponent(flow.appId!)}`)
                    : undefined}
                  onOpen={() => undefined}
                  syncPreviewUrl={false}
                />
                {block.props.source === "project" && !current ? (
                  <p className="project-flow-block__stale">No longer in this project</p>
                ) : null}
              </div>
            </article>
          ) : (
            <button
              type="button"
              className="project-flow-block__empty"
              disabled={!editor.isEditable}
              onClick={() => setPickerOpen(true)}
            >
              <span><Icon icon="viewColumns" size="md" /></span>
              <strong>Select a flow</strong>
              <small>Search the Vitrines catalog or use a flow from this project.</small>
            </button>
          )}

          {pickerOpen && editor.isEditable ? (
            <div className="project-flow-block__picker" role="dialog" aria-label="Flow picker">
              <header>
                <strong>Choose a flow</strong>
                <span>{flows.length} project · {catalogTotal} catalog</span>
              </header>
              <div className="project-flow-block__search">
                <Icon icon="search" size="sm" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search flows and apps…"
                  aria-label="Search flow catalog"
                  autoFocus
                />
              </div>
              <div className="project-flow-block__platforms" aria-label="Flow platform">
                {(["web", "ios", "android"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={platform === value}
                    onClick={() => setPlatform(value)}
                  >
                    {value === "web" ? "Web" : value === "ios" ? "iOS" : "Android"}
                  </button>
                ))}
              </div>
              <div className="project-flow-block__results">
                {projectFlows.length ? (
                  <section>
                    <h4>In this project</h4>
                    <div role="listbox" aria-label="Project flows">
                      {projectFlows.map((option) => (
                        <FlowOptionButton
                          key={option.id}
                          option={option}
                          selected={option.id === block.props.referenceId}
                          busy={false}
                          onChoose={chooseFlow}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
                <section>
                  <h4>Vitrines catalog</h4>
                  {catalogLoading ? <p>Searching flows…</p> : null}
                  {catalogError ? <p role="alert">{catalogError}</p> : null}
                  {attachError ? <p role="alert">{attachError}</p> : null}
                  {!catalogLoading && !catalogError && catalogFlows.length ? (
                    <div role="listbox" aria-label="Catalog flows">
                      {catalogFlows.map((option) => (
                        <FlowOptionButton
                          key={option.id}
                          option={option}
                          selected={option.id === block.props.referenceId}
                          busy={attachingId === option.id}
                          disabled={Boolean(attachingId)}
                          onChoose={chooseFlow}
                        />
                      ))}
                    </div>
                  ) : null}
                  {!catalogLoading && !catalogError && !catalogFlows.length ? (
                    <p>No catalog flows found. Try another search or platform.</p>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}

        </div>
      );
    },
    toExternalHTML: ({ block }) => (
      <article data-astryx-reference="flow" data-reference-id={block.props.referenceId}>
        <strong>{block.props.title || "Flow"}</strong>
        <p>{block.props.app} · {block.props.stepCount} steps</p>
      </article>
    ),
  },
)();

function FlowOptionButton({
  option,
  selected,
  busy,
  disabled = false,
  onChoose,
}: {
  option: ProjectDocumentFlowOption;
  selected: boolean;
  busy: boolean;
  disabled?: boolean;
  onChoose: (option: ProjectDocumentFlowOption) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="project-flow-block__option"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={() => onChoose(option)}
    >
      {option.previews[0] ? (
        <img src={option.previews[0].url} alt="" />
      ) : (
        <span className="project-flow-block__picker-icon"><Icon icon="viewColumns" size="sm" /></span>
      )}
      <span>
        <strong>{option.title}</strong>
        <small>{busy ? "Adding all steps to project…" : `${option.app} · ${option.stepCount} ${option.stepCount === 1 ? "step" : "steps"}`}</small>
      </span>
      {selected ? <Icon icon="check" size="sm" /> : null}
    </button>
  );
}

type EvidencePickerFilter = "all" | "screen" | "flow" | "upload";

const vitrinesEvidenceBlock = createReactBlockSpec(
  {
    type: "vitrinesEvidence",
    propSchema: {
      referenceType: { default: "screen", values: ["screen", "flow", "upload"] as const },
      referenceId: { default: "" },
      title: { default: "" },
      app: { default: "" },
      appIconUrl: { default: "" },
      appId: { default: "" },
      description: { default: "" },
      platform: { default: "" },
      mediaUrl: { default: "" },
      sourcePath: { default: "" },
      capturedAt: { default: "" },
      lane: { default: "" },
      stepCount: { default: 0 },
      caption: { default: "" },
      layout: { default: "card", values: ["card", "wide"] as const },
    },
    content: "none",
  } as const,
  {
    render: ({ block, editor }) => {
      const { evidence, flows } = useContext(ProjectDocumentFlowContext);
      const [pickerOpen, setPickerOpen] = useState(!block.props.referenceId);
      const [query, setQuery] = useState("");
      const [filter, setFilter] = useState<EvidencePickerFilter>("all");
      const normalizedQuery = query.trim().toLocaleLowerCase();
      const matchesQuery = (values: string[]) => !normalizedQuery
        || values.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const visibleEvidence = evidence.filter((option) =>
        (filter === "all" || option.type === filter)
        && matchesQuery([
          option.title,
          option.app,
          option.description,
          option.lane,
          option.platform,
        ]));
      const visibleFlows = (filter === "all" || filter === "flow")
        ? flows.filter((option) => matchesQuery([
          option.title,
          option.app,
          option.description,
        ]))
        : [];
      const current = evidence.find((option) => option.id === block.props.referenceId);
      const currentFlow = flows.find((option) => option.id === block.props.referenceId);
      const selected: ProjectDocumentEvidenceOption | undefined = current ?? (
        currentFlow
          ? {
            app: currentFlow.app,
            appIconUrl: currentFlow.appIconUrl ?? "",
            appId: currentFlow.appId ?? "",
            capturedAt: "",
            description: currentFlow.description,
            id: currentFlow.id,
            lane: "Project flows",
            mediaUrl: currentFlow.previews[0]?.url ?? "",
            platform: currentFlow.platform ?? "",
            sourcePath: currentFlow.appId
              ? `/apps/${encodeURIComponent(currentFlow.appId)}`
              : "",
            stepCount: currentFlow.stepCount,
            title: currentFlow.title,
            type: "flow",
          }
          :
        block.props.referenceId
          ? {
            app: block.props.app,
            appIconUrl: block.props.appIconUrl,
            appId: block.props.appId,
            capturedAt: block.props.capturedAt,
            description: block.props.description,
            id: block.props.referenceId,
            lane: block.props.lane,
            mediaUrl: block.props.mediaUrl,
            platform: block.props.platform,
            sourcePath: block.props.sourcePath,
            stepCount: block.props.stepCount,
            title: block.props.title,
            type: block.props.referenceType,
          }
          : undefined
      );

      const chooseEvidence = (option: ProjectDocumentEvidenceOption) => {
        editor.updateBlock(block, {
          props: {
            referenceType: option.type,
            referenceId: option.id,
            title: option.title,
            app: option.app,
            appIconUrl: option.appIconUrl,
            appId: option.appId,
            description: option.description,
            platform: option.platform,
            mediaUrl: option.mediaUrl,
            sourcePath: option.sourcePath,
            capturedAt: option.capturedAt,
            lane: option.lane,
          },
        });
        setPickerOpen(false);
      };

      const chooseFlow = (option: ProjectDocumentFlowOption) => {
        editor.updateBlock(block, {
          props: {
            referenceType: "flow",
            referenceId: option.id,
            title: option.title,
            app: option.app,
            appIconUrl: option.appIconUrl ?? "",
            appId: option.appId ?? "",
            description: option.description,
            platform: option.platform ?? "",
            mediaUrl: option.previews[0]?.url ?? "",
            sourcePath: option.appId ? `/apps/${encodeURIComponent(option.appId)}` : "",
            lane: "Project flows",
            stepCount: option.stepCount,
          },
        });
        setPickerOpen(false);
      };

      const sourceHref = selected?.sourcePath
        || (selected?.appId ? `/apps/${encodeURIComponent(selected.appId)}` : "");

      return (
        <div
          className={`vitrines-evidence-block vitrines-evidence-block--${block.props.layout}`}
          contentEditable={false}
        >
          {selected ? (
            <figure className="vitrines-evidence-block__card">
              <header className="vitrines-evidence-block__header">
                <span className="vitrines-evidence-block__type">
                  {selected.type === "screen" ? "Screen" : selected.type === "flow" ? "Flow" : "Upload"}
                </span>
                {editor.isEditable ? (
                  <div className="vitrines-evidence-block__actions">
                    <button
                      type="button"
                      aria-pressed={block.props.layout === "card"}
                      onClick={() => editor.updateBlock(block, { props: { layout: "card" } })}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      aria-pressed={block.props.layout === "wide"}
                      onClick={() => editor.updateBlock(block, { props: { layout: "wide" } })}
                    >
                      Wide
                    </button>
                    <Button
                      className="vitrines-evidence-block__change"
                      label="Change"
                      variant="ghost"
                      size="sm"
                      aria-expanded={pickerOpen}
                      onClick={() => setPickerOpen((open) => !open)}
                    />
                  </div>
                ) : null}
              </header>
              <div className="vitrines-evidence-block__content">
                {selected.mediaUrl ? (
                  <div className="vitrines-evidence-block__media">
                    <img src={selected.mediaUrl} alt="" />
                  </div>
                ) : (
                  <div className="vitrines-evidence-block__media vitrines-evidence-block__media--empty">
                    <Icon icon="viewColumns" size="lg" />
                  </div>
                )}
                <div className="vitrines-evidence-block__details">
                  <strong>{selected.title || "Untitled evidence"}</strong>
                  <span>
                    {[
                      selected.app,
                      selected.platform,
                      selected.type === "flow" && selected.stepCount
                        ? `${selected.stepCount} ${selected.stepCount === 1 ? "step" : "steps"}`
                        : "",
                      selected.lane,
                    ].filter(Boolean).join(" · ")
                      || "Project evidence"}
                  </span>
                  {selected.description ? <p>{selected.description}</p> : null}
                  {sourceHref ? (
                    <a href={sourceHref}>
                      Open source <Icon icon="externalLink" size="xsm" />
                    </a>
                  ) : null}
                  {block.props.referenceId && !current && !currentFlow ? (
                    <small className="vitrines-evidence-block__stale">
                      The original is no longer in this Project. This saved snapshot remains available.
                    </small>
                  ) : null}
                </div>
              </div>
              <figcaption>
                <label>
                  <span>Why this matters</span>
                  <textarea
                    aria-label="Why this evidence matters"
                    value={block.props.caption}
                    placeholder="Add the observation, decision, or requirement supported by this evidence…"
                    rows={2}
                    maxLength={500}
                    readOnly={!editor.isEditable}
                    onChange={(event) => editor.updateBlock(block, {
                      props: { caption: event.currentTarget.value },
                    })}
                  />
                </label>
              </figcaption>
            </figure>
          ) : (
            <button
              type="button"
              className="vitrines-evidence-block__empty"
              disabled={!editor.isEditable}
              onClick={() => setPickerOpen(true)}
            >
              <span><Icon icon="viewColumns" size="md" /></span>
              <strong>Select Project evidence</strong>
              <small>Insert a screen, flow, or upload with its source attached.</small>
            </button>
          )}

          {pickerOpen && editor.isEditable ? (
            <div className="vitrines-evidence-picker" role="dialog" aria-label="Evidence Composer">
              <header>
                <div>
                  <strong>Insert from Vitrines</strong>
                  <span>{evidence.length + flows.length} references in this Project</span>
                </div>
                <IconButton
                  label="Close evidence picker"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon="close" size="sm" />}
                  onClick={() => setPickerOpen(false)}
                />
              </header>
              <div className="vitrines-evidence-picker__search">
                <Icon icon="search" size="sm" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search screens, flows, uploads, apps, or lanes…"
                  aria-label="Search Project evidence"
                  autoFocus
                />
              </div>
              <div className="vitrines-evidence-picker__filters" aria-label="Evidence type">
                {([
                  ["all", "All"],
                  ["screen", "Screens"],
                  ["flow", "Flows"],
                  ["upload", "Uploads"],
                ] as const).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="vitrines-evidence-picker__results" role="listbox" aria-label="Project evidence">
                {visibleEvidence.map((option) => (
                  <EvidenceOptionButton
                    key={option.id}
                    type={option.type === "screen" ? "Screen" : "Upload"}
                    title={option.title}
                    meta={[option.app, option.platform, option.lane].filter(Boolean).join(" · ")}
                    mediaUrl={option.mediaUrl}
                    onChoose={() => chooseEvidence(option)}
                  />
                ))}
                {visibleFlows.map((option) => (
                  <EvidenceOptionButton
                    key={option.id}
                    type="Flow"
                    title={option.title}
                    meta={`${option.app} · ${option.stepCount} ${option.stepCount === 1 ? "step" : "steps"}`}
                    mediaUrl={option.previews[0]?.url ?? ""}
                    onChoose={() => chooseFlow(option)}
                  />
                ))}
                {!visibleEvidence.length && !visibleFlows.length ? (
                  <div className="vitrines-evidence-picker__empty">
                    <strong>No matching evidence</strong>
                    <span>Try another search or add evidence to this Project first.</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      );
    },
    toExternalHTML: ({ block }) => (
      <figure data-vitrines-reference={block.props.referenceType} data-reference-id={block.props.referenceId}>
        {block.props.mediaUrl ? <img src={block.props.mediaUrl} alt="" /> : null}
        <strong>{block.props.title || "Project evidence"}</strong>
        {block.props.description ? <p>{block.props.description}</p> : null}
        {block.props.caption ? <figcaption>{block.props.caption}</figcaption> : null}
      </figure>
    ),
  },
)();

function EvidenceOptionButton({
  type,
  title,
  meta,
  mediaUrl,
  onChoose,
}: {
  type: "Screen" | "Flow" | "Upload";
  title: string;
  meta: string;
  mediaUrl: string;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className="vitrines-evidence-picker__option"
      role="option"
      aria-selected="false"
      onClick={onChoose}
    >
      {mediaUrl ? (
        <img src={mediaUrl} alt="" />
      ) : (
        <span className="vitrines-evidence-picker__option-placeholder">
          <Icon icon="viewColumns" size="sm" />
        </span>
      )}
      <span>
        <small>{type}</small>
        <strong>{title}</strong>
        <span>{meta || "Project evidence"}</span>
      </span>
      <Icon icon="chevronRight" size="sm" />
    </button>
  );
}

export const projectDocumentSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    astryxReference: astryxReferenceBlock,
    vitrinesEvidence: vitrinesEvidenceBlock,
  },
});

type ProjectDocumentEditor = BlockNoteEditor<
  typeof projectDocumentSchema.blockSchema,
  typeof projectDocumentSchema.inlineContentSchema,
  typeof projectDocumentSchema.styleSchema
>;

export function projectDocumentSlashMenuItems(
  editor: ProjectDocumentEditor,
  query: string,
): DefaultReactSuggestionItem[] {
  return filterSuggestionItems([
    {
      title: "Vitrines evidence",
      subtext: "Insert a live screen, flow, or upload from this Project",
      group: "Vitrines",
      aliases: ["reference", "screen", "upload", "project evidence"],
      icon: <Icon icon="viewColumns" size="sm" />,
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "vitrinesEvidence",
        });
      },
    },
    {
      title: "Flow",
      subtext: "Embed a flow collected in this project",
      group: "Vitrines",
      aliases: ["journey", "reference", "project flow"],
      icon: <Icon icon="viewColumns" size="sm" />,
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "astryxReference",
          props: { referenceType: "flow" },
        });
      },
    },
    ...getDefaultReactSlashMenuItems(editor),
  ], query);
}

export function insertProjectDocumentEvidenceBlock(
  editor: ProjectDocumentEditor,
): void {
  let target = editor.document.at(-1);
  try {
    target = editor.getTextCursorPosition().block;
  } catch {
    // A toolbar click can happen before the editor has an active text cursor.
  }
  if (!target) return;
  const isEmptyParagraph = target.type === "paragraph"
    && Array.isArray(target.content)
    && target.content.length === 0;
  if (isEmptyParagraph) {
    editor.updateBlock(target, { type: "vitrinesEvidence" });
    return;
  }
  editor.insertBlocks([{ type: "vitrinesEvidence" }], target, "after");
}

export function insertProjectDocumentFlowBlock(
  editor: ProjectDocumentEditor,
  flow: ProjectDocumentFlowInsertItem,
): void {
  const props = {
    referenceType: "flow" as const,
    referenceId: flow.id,
    source: flow.source,
    title: flow.title,
    app: flow.app,
    appIconUrl: flow.appIconUrl ?? "",
    appId: flow.appId ?? "",
    description: flow.description,
    platform: flow.platform ?? "",
    previewSnapshot: JSON.stringify(flow.previews),
    stepCount: flow.stepCount,
  };
  const target = editor.document.at(-1);
  if (!target) return;
  const isEmptyParagraph = target.type === "paragraph"
    && Array.isArray(target.content)
    && target.content.length === 0;
  if (isEmptyParagraph) {
    editor.updateBlock(target, { type: "astryxReference", props });
    return;
  }
  editor.insertBlocks([{ type: "astryxReference", props }], target, "after");
}
