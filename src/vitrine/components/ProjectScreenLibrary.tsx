import {
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Card,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  TextInput,
} from "@astryxdesign/core";

import type { AppsDiscoveryScreenResult, AppsPlatform } from "../appsDiscovery.ts";
import {
  flowCatalogItemKey,
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from "../flowCatalogApi.ts";
import { filterAppsDiscoveryScreens } from "../appsDiscovery.ts";
import { fetchCatalogPage } from "../useApps.ts";
import { AppIcon } from "./AppIcon.tsx";
import { AppsPlatformSwitcher } from "./AppsPlatformSwitcher.tsx";
import { useSegmentedIndicator } from "./useSegmentedIndicator.ts";
import { PlaceholderImage } from "./PlaceholderImage.tsx";

type ScreenLibraryState = "loading" | "ready" | "error";

const screenKey = ({ app, screen }: AppsDiscoveryScreenResult) => `${app.id}:${screen.id}`;

export type ScreenLibraryMode = "screens" | "flows";

/*
 * What is being dragged. Handed to the page on dragstart rather than serialised
 * into dataTransfer: these are whole catalog records, and the drop handler wants
 * the object, not a JSON round-trip of it.
 */
/* Advertised on the drag itself, so a drop target can recognise a catalog drag
   from the event rather than from state it has to have been told about. */
export const catalogDragMimeType = "application/x-astryx-catalog";

export type CatalogDragPayload =
  | { kind: "flow"; item: FlowCatalogItem; platform: AppsPlatform }
  | { kind: "screen"; result: AppsDiscoveryScreenResult };

type ProjectScreenFacetGroup = "area" | "state" | "pattern" | "component";

export type ProjectScreenFacet = {
  key: string;
  group: ProjectScreenFacetGroup;
  value: string;
  label: string;
  count: number;
};

/* These values describe the ingestion source, not a visual reference a
   designer can use to narrow inspiration. Keep them out of the filter chips
   while preserving meaningful states such as onboarding or empty state. */
const unhelpfulScreenLabels = new Set([
  "",
  "unclassified",
  "unknown",
  "other",
  "app-store-listing",
]);

const usefulScreenLabel = (value: string | null | undefined) => {
  const label = value?.trim();
  return label && !unhelpfulScreenLabels.has(label.toLowerCase()) ? label : undefined;
};

const firstUsefulScreenLabel = (values: string[] | null | undefined) =>
  values?.map(usefulScreenLabel).find((value): value is string => Boolean(value));

export function projectScreenTitle({ screen }: AppsDiscoveryScreenResult) {
  return usefulScreenLabel(screen.type)
    ?? usefulScreenLabel(screen.productArea)
    ?? firstUsefulScreenLabel(screen.visibleText)
    ?? "Screen";
}

function hasSpecificScreenTitle({ screen }: AppsDiscoveryScreenResult) {
  return Boolean(
    usefulScreenLabel(screen.type)
    ?? usefulScreenLabel(screen.productArea)
    ?? firstUsefulScreenLabel(screen.visibleText),
  );
}

function projectScreenCardTitle(result: AppsDiscoveryScreenResult) {
  return hasSpecificScreenTitle(result) ? projectScreenTitle(result) : result.app.app;
}

const screenFacetValues = (result: AppsDiscoveryScreenResult, group: ProjectScreenFacetGroup) => {
  const { screen } = result;
  switch (group) {
    case "area": return [screen.productArea];
    case "state": return [screen.stateContext, ...(screen.visibleStates ?? [])];
    case "pattern": return screen.layoutPatterns ?? [];
    case "component": return screen.componentNames ?? [];
  }
};

export function projectScreenFacetOptions(results: AppsDiscoveryScreenResult[]): ProjectScreenFacet[] {
  const labels: Record<ProjectScreenFacetGroup, string> = {
    area: "Area",
    state: "State",
    pattern: "Pattern",
    component: "UI",
  };
  const counts = new Map<string, ProjectScreenFacet>();
  results.forEach((result) => {
    (Object.keys(labels) as ProjectScreenFacetGroup[]).forEach((group) => {
      new Set(screenFacetValues(result, group).map(usefulScreenLabel).filter(Boolean)).forEach((value) => {
        const key = `${group}:${value!.toLowerCase()}`;
        const current = counts.get(key);
        counts.set(key, current
          ? { ...current, count: current.count + 1 }
          : { key, group, value: value!, label: `${labels[group]}: ${value}`, count: 1 });
      });
    });
  });
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);
}

export function projectScreenMatchesFacet(result: AppsDiscoveryScreenResult, facet: ProjectScreenFacet) {
  return screenFacetValues(result, facet.group)
    .some((value) => usefulScreenLabel(value)?.toLowerCase() === facet.value.toLowerCase());
}

const searchScore = (result: AppsDiscoveryScreenResult, query: string) => {
  if (!query) return 0;
  const score = (value: string | null | undefined, weight: number) => {
    const text = value?.toLowerCase() ?? "";
    return text === query ? weight * 2 : text.startsWith(query) ? weight : text.includes(query) ? weight / 2 : 0;
  };
  const valuesScore = (values: string[] | null | undefined, weight: number) =>
    Math.max(0, ...(values ?? []).map((value) => score(value, weight)));
  const { app, screen } = result;
  return Math.max(
    score(screen.type, 80),
    score(screen.productArea, 70),
    score(screen.stateContext, 65),
    valuesScore(screen.visibleStates, 60),
    valuesScore(screen.visibleText, 55),
    score(screen.description, 45),
    valuesScore(screen.layoutPatterns, 40),
    valuesScore(screen.componentNames, 35),
    score(app.app, 20),
  );
};

export function rankProjectScreenResults(results: AppsDiscoveryScreenResult[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return results;
  return results
    .map((result, index) => ({ result, index, score: searchScore(result, normalizedQuery) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ result }) => result);
}

const modes: Array<{ value: ScreenLibraryMode; label: string }> = [
  { value: "screens", label: "Screens" },
  { value: "flows", label: "Flows" },
];

/* These are the jobs designers tend to look for when gathering references.
   They deliberately avoid the ingestion metadata shown by the old facet bar
   (for example, "State: app-store-listing"). */
const inspirationPrompts: Record<ScreenLibraryMode, readonly string[]> = {
  screens: ["Onboarding", "Sign in", "Checkout", "Dashboard", "Profile", "Empty state"],
  flows: ["Onboarding", "Sign up", "Checkout", "Invite teammates", "Settings"],
};

export function ProjectScreenLibrary({
  message,
  onClose,
  onDragItem,
  onAddItem,
}: {
  message: string;
  onClose(): void;
  onDragItem(payload: CatalogDragPayload | undefined): void;
  /* Returning the placement work keeps a chosen reference visibly busy until
     its image and canvas card have both been created. */
  onAddItem(payload: CatalogDragPayload): Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<AppsPlatform>("web");
  const [state, setState] = useState<ScreenLibraryState>("loading");
  const [results, setResults] = useState<AppsDiscoveryScreenResult[]>([]);
  const [flows, setFlows] = useState<FlowCatalogItem[]>([]);
  const [mode, setMode] = useState<ScreenLibraryMode>("screens");
  const [addingKey, setAddingKey] = useState<string>();
  const modeSwitcherRef = useSegmentedIndicator(mode);
  const addToCanvas = (key: string, payload: CatalogDragPayload) => {
    if (addingKey) return;
    setAddingKey(key);
    /* Keep the card busy until its placement work finishes, so rapid clicks
       cannot create duplicate references. */
    void onAddItem(payload).finally(() => setAddingKey(undefined));
  };
  const addScreenFromKeyboard = (
    event: ReactKeyboardEvent<HTMLElement>,
    key: string,
    result: AppsDiscoveryScreenResult,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    addToCanvas(key, { kind: "screen", result });
  };
  const addFlowFromKeyboard = (
    event: ReactKeyboardEvent<HTMLElement>,
    key: string,
    item: FlowCatalogItem,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    addToCanvas(key, { kind: "flow", item, platform });
  };
  /* The field searches whichever grain is showing, so its accessible name should say so. */
  /* Same handlers on every card: mark the drag copy-only, give the OS a label,
     and hand the record to the page for the drop. */
  const dragProps = (payload: CatalogDragPayload, label: string) => ({
    draggable: true,
    onDragStart: (event: ReactDragEvent) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", label);
      /*
       * The record travels in dataTransfer, not only in a ref: dragover can read
       * `types` to recognise the drag, and drop can read the record back even if
       * the ref never got set — which happens when something other than this
       * card ends up owning the gesture.
       */
      event.dataTransfer.setData(catalogDragMimeType, JSON.stringify(payload));
      /*
       * Drag the card itself, held where it was grabbed. Left to the browser the
       * ghost is whatever sub-element the pointer happened to be over — often
       * just the preview image or a line of text.
       */
      const card = event.currentTarget as HTMLElement;
      const rect = card.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        card,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      card.dataset.dragging = "true";
      onDragItem(payload);
    },
    onDragEnd: (event: ReactDragEvent) => {
      delete (event.currentTarget as HTMLElement).dataset.dragging;
      onDragItem(undefined);
    },
  });

  const searchLabel = mode === "flows" ? "Search flows" : "Search visual references";
  const searchPlaceholder = mode === "flows" ? "Search flows…" : "Search screens, features, or UI text…";

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      limit: "24",
      platform,
      sort: "latest",
      facets: "summary",
    });
    if (query.trim()) params.set("query", query.trim());
    return `/api/catalog?${params.toString()}`;
  }, [platform, query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState("loading");
      /* Screens come from the catalog response; flows have their own endpoint. */
      const request = mode === "flows"
        ? loadFlowCatalogPage({
          platform,
          query,
          limit: 24,
          order: "browse",
        }, controller.signal).then((page) => {
          setFlows(page.items);
        })
        : fetchCatalogPage(endpoint, controller.signal).then((page) => {
          setResults(rankProjectScreenResults(filterAppsDiscoveryScreens(page.apps, {
            query,
            facets: [],
            platform,
            sort: "latest",
          }), query).slice(0, 24));
        });
      void request
        .then(() => setState("ready"))
        .catch((error: Error) => {
          if (error.name !== "AbortError") setState("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, mode, platform, query]);

  const visibleScreenResults = results;
  const referenceCount = mode === "flows" ? flows.length : visibleScreenResults.length;
  const resultSummary = query.trim()
    ? `${referenceCount} ${referenceCount === 1 ? "reference" : "references"} matching “${query.trim()}”`
    : `${referenceCount} visual ${referenceCount === 1 ? "reference" : "references"}`;

  return (
    <aside className="project-screen-library" aria-label="Inspiration">
      <header className="project-screen-library__header">
        <div>
          <p className="project-screen-library__eyebrow">Reference library</p>
          <h2>Inspiration</h2>
          <p>Browse visual references, then drag the ones worth exploring onto your canvas.</p>
        </div>
        {/* Icon, like every other canvas panel — a word here rendered as a
            stray uppercase "CLOSE" beside the heading. */}
        <IconButton
          label="Close screens library"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          clickAction={onClose}
        />
      </header>

      <TextInput
        label={searchLabel}
        isLabelHidden
        value={query}
        onChange={setQuery}
        placeholder={searchPlaceholder}
        width="100%"
      />

      <div className="project-screen-library__platforms">
        <SegmentedControl
          ref={modeSwitcherRef}
          label="Reference type"
          size="sm"
          value={mode}
          onChange={(value) => setMode(value as ScreenLibraryMode)}
        >
          {modes.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
          ))}
        </SegmentedControl>
      </div>

      {state === "ready" && (
        <>
          <div className="project-screen-library__browse-heading">
            <span>{query.trim() ? "Search results" : "Explore by task"}</span>
            <p className="project-screen-library__result-summary" role="status" aria-live="polite">
              {resultSummary}
            </p>
          </div>
          {!query.trim() && (
            <div className="project-screen-library__prompts" role="group" aria-label={`Explore ${mode} by task`}>
              {inspirationPrompts[mode].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="project-screen-library__prompt"
                  onClick={() => setQuery(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="project-screen-library__platforms">
        <AppsPlatformSwitcher
          value={platform}
          onChange={setPlatform}
          ariaLabel="Screen platform"
        />
      </div>

      {message && <p className="project-screen-library__message" role="status">{message}</p>}
      {state === "loading" && (
        <p className="project-screen-library__empty" role="status">
          Loading {mode === "flows" ? "flows" : "screens"}…
        </p>
      )}
      {state === "error" && (
        <p className="project-screen-library__empty" role="alert">
          {mode === "flows" ? "Flows" : "Screens"} could not be loaded. Try again in a moment.
        </p>
      )}
      {state === "ready" && mode === "flows" && (
        <div className="project-screen-library__grid">
          {flows.map((item) => {
            const key = `flow:${flowCatalogItemKey(item)}`;
            const previewEvidence = item.preview.flow.steps
              .flatMap((step) => step.evidence)
              .slice(0, 3);
            const flowSteps = previewEvidence.length ? previewEvidence : [undefined];
            return (
              <Card
                key={key}
                padding={1}
                className="project-screen-library__card project-screen-library__card--flow"
                role="button"
                tabIndex={0}
                aria-label={`Place ${item.title} from ${item.preview.appName} on the canvas`}
                aria-busy={addingKey === key || undefined}
                onClick={() => addToCanvas(key, { kind: "flow", item, platform })}
                onKeyDown={(event) => addFlowFromKeyboard(event, key, item)}
                {...dragProps({ kind: "flow", item, platform }, item.title)}
              >
                <div className="project-screen-library__preview project-screen-library__preview--flow">
                  <div className="project-screen-library__flow-steps" aria-hidden="true">
                    {flowSteps.map((evidence, index) => (
                      <div className="project-screen-library__flow-step" key={evidence?.imageUrl ?? index}>
                        <PlaceholderImage
                          src={evidence?.thumbnailUrl ?? evidence?.imageUrl}
                          accent={item.preview.appIconUrl ? undefined : "#edf3ff"}
                          style={{ objectFit: "contain" }}
                        />
                      </div>
                    ))}
                  </div>
                  <AppIcon
                    name={item.preview.appName}
                    iconUrl={item.preview.appIconUrl ?? undefined}
                    size={28}
                    className="project-screen-library__app-icon project-screen-library__app-icon--overlay"
                  />
                  <span className="project-screen-library__flow-title" aria-hidden="true">
                    <strong>{item.title}</strong>
                    <small>{item.preview.screenCount} {item.preview.screenCount === 1 ? "step" : "steps"}</small>
                  </span>
                  <span className="project-screen-library__place-hint" aria-hidden="true">
                    Drag to canvas
                  </span>
                </div>
              </Card>
            );
          })}
          {flows.length === 0 && (
            <p className="project-screen-library__empty" role="status">
              No flows match this search.
            </p>
          )}
        </div>
      )}
      {state === "ready" && mode === "screens" && (
        <div className="project-screen-library__grid project-screen-library__grid--inspiration">
          {visibleScreenResults.map((result) => {
            const key = screenKey(result);
            const { app, screen } = result;
            return (
              <Card
                key={key}
                padding={1}
                className="project-screen-library__card project-screen-library__card--screen"
                role="button"
                tabIndex={0}
                aria-label={`Place ${projectScreenCardTitle(result)} from ${app.app} on the canvas`}
                aria-busy={addingKey === key || undefined}
                onClick={() => addToCanvas(key, { kind: "screen", result })}
                onKeyDown={(event) => addScreenFromKeyboard(event, key, result)}
                {...dragProps({ kind: "screen", result }, projectScreenCardTitle(result))}
              >
                <div className="project-screen-library__preview project-screen-library__preview--screen">
                  <PlaceholderImage
                    src={screen.thumbnailUrl ?? screen.url}
                    accent={app.accent}
                    style={{ objectFit: "contain" }}
                  />
                  <AppIcon
                    name={app.app}
                    iconUrl={app.iconUrl}
                    accent={app.accent}
                    size={28}
                    className="project-screen-library__app-icon project-screen-library__app-icon--overlay"
                  />
                  <span className="project-screen-library__place-hint" aria-hidden="true">
                    Drag to canvas
                  </span>
                </div>
              </Card>
            );
          })}
          {!visibleScreenResults.length && (
            <p className="project-screen-library__empty">
              No screens match this search yet.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

export const projectScreenKey = screenKey;
