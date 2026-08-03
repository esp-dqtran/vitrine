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
import { Button, Icon } from "@astryxdesign/core";

import type { DesignFlow, EvidenceView } from "../../designSystem.ts";
import type { Platform } from "../../platformFromUrl.ts";
import type { ResearchProjectWorkspace } from "../../researchProject.ts";
import {
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from "../flowCatalogApi.ts";
import { FlowCard } from "./FlowCard.tsx";

export interface ProjectDocumentFlowOption {
  app: string;
  appIconUrl?: string | null;
  appId?: string;
  catalog?: {
    app: string;
    appId: string;
    versionId: number;
    flowId: string;
    platform: Platform;
    title: string;
    description: string;
  };
  description: string;
  id: string;
  platform?: Platform;
  previews: Array<{ label: string; url: string }>;
  source: "catalog" | "project";
  stepCount: number;
  title: string;
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
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  onAttachCatalogFlow?: (option: ProjectDocumentFlowOption) => Promise<ProjectDocumentFlowOption>;
}

const ProjectDocumentFlowContext = createContext<ProjectDocumentFlowContextValue>({
  flows: [],
  initialPlatform: "web",
});

export function ProjectDocumentFlowProvider({
  children,
  flows,
  initialPlatform,
  onAttachCatalogFlow,
}: {
  children: ReactNode;
  flows: ProjectDocumentFlowOption[];
  initialPlatform: Platform;
  onAttachCatalogFlow?: (option: ProjectDocumentFlowOption) => Promise<ProjectDocumentFlowOption>;
}) {
  const value = useMemo(
    () => ({ flows, initialPlatform, onAttachCatalogFlow }),
    [flows, initialPlatform, onAttachCatalogFlow],
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
              <small>Search the Astryx catalog or use a flow from this project.</small>
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
                  <h4>Astryx catalog</h4>
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

export const projectDocumentSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    astryxReference: astryxReferenceBlock,
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
      title: "Flow",
      subtext: "Embed a flow collected in this project",
      group: "Astryx",
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
