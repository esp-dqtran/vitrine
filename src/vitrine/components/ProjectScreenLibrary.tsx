import { useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import {
  Card,
  Icon,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  TextInput,
} from "@astryxdesign/core";

import type { AppsDiscoveryScreenResult, AppsPlatform } from "../appsDiscovery.ts";
import type { App } from "../types.ts";
import {
  flowCatalogItemKey,
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from "../flowCatalogApi.ts";
import { filterAppsDiscoveryScreens } from "../appsDiscovery.ts";
import { fetchCatalogPage } from "../useApps.ts";
import { AppIcon } from "./AppIcon.tsx";
import { useSegmentedIndicator } from "./useSegmentedIndicator.ts";
import { PlaceholderImage } from "./PlaceholderImage.tsx";

type ScreenLibraryState = "loading" | "ready" | "error";

const platforms: Array<{ value: AppsPlatform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
];

const screenKey = ({ app, screen }: AppsDiscoveryScreenResult) => `${app.id}:${screen.id}`;
const appCardKey = (app: App) => `app:${app.id}`;

export type ScreenLibraryMode = "apps" | "screens" | "flows";

/*
 * What is being dragged. Handed to the page on dragstart rather than serialised
 * into dataTransfer: these are whole catalog records, and the drop handler wants
 * the object, not a JSON round-trip of it.
 */
/* Advertised on the drag itself, so a drop target can recognise a catalog drag
   from the event rather than from state it has to have been told about. */
export const catalogDragMimeType = "application/x-astryx-catalog";

export type CatalogDragPayload =
  | { kind: "app"; app: App; platform: AppsPlatform }
  | { kind: "flow"; item: FlowCatalogItem; platform: AppsPlatform }
  | { kind: "screen"; result: AppsDiscoveryScreenResult };

/* Apps first: browsing raw screens showed four cards from one app before you
   reached a second, which is the wrong grain for finding something. */
const modes: Array<{ value: ScreenLibraryMode; label: string }> = [
  { value: "apps", label: "Apps" },
  { value: "screens", label: "Screens" },
  { value: "flows", label: "Flows" },
];

export function ProjectScreenLibrary({
  message,
  onClose,
  onDragItem,
}: {
  message: string;
  onClose(): void;
  onDragItem(payload: CatalogDragPayload | undefined): void;
}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<AppsPlatform>("web");
  const platformSwitcherRef = useSegmentedIndicator(platform);
  const [state, setState] = useState<ScreenLibraryState>("loading");
  const [results, setResults] = useState<AppsDiscoveryScreenResult[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [flows, setFlows] = useState<FlowCatalogItem[]>([]);
  const [mode, setMode] = useState<ScreenLibraryMode>("apps");
  const modeSwitcherRef = useSegmentedIndicator(mode);
  /* The field searches whichever grain is showing, so it should say so. */
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

  const searchLabel = mode === "apps"
    ? "Search apps"
    : mode === "flows" ? "Search flows" : "Search screens";
  const searchPlaceholder = mode === "apps"
    ? "Search apps…"
    : mode === "flows" ? "Search flows…" : "Search apps or screen types…";

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
      /* Apps and screens come from one catalog response — screens are that
         response flattened — so only flows need a request of their own. */
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
          setApps(page.apps.slice(0, 24));
          setResults(filterAppsDiscoveryScreens(page.apps, {
            query,
            facets: [],
            platform,
            sort: "latest",
          }).slice(0, 24));
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

  return (
    <aside className="project-screen-library" aria-label="Astryx catalog">
      <header className="project-screen-library__header">
        <div>
          {/* The panel outgrew "Screens" — it browses three grains now, and the
              switcher below says which one you are in. */}
          <h2>Catalog</h2>
          <p>Search apps, screens and flows, then place them on this canvas.</p>
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
          label="Catalog type"
          size="sm"
          value={mode}
          onChange={(value) => setMode(value as ScreenLibraryMode)}
        >
          {modes.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
          ))}
        </SegmentedControl>
      </div>

      <div className="project-screen-library__platforms">
        <SegmentedControl
          ref={platformSwitcherRef}
          label="Screen platform"
          size="sm"
          value={platform}
          onChange={(value) => setPlatform(value as AppsPlatform)}
        >
          {platforms.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
          ))}
        </SegmentedControl>
      </div>

      {message && <p className="project-screen-library__message" role="status">{message}</p>}
      {state === "loading" && (
        <p className="project-screen-library__empty" role="status">
          Loading {mode === "apps" ? "apps" : mode === "flows" ? "flows" : "screens"}…
        </p>
      )}
      {state === "error" && (
        <p className="project-screen-library__empty" role="alert">
          {mode === "apps" ? "Apps" : mode === "flows" ? "Flows" : "Screens"} could not be loaded. Try again in a moment.
        </p>
      )}
      {state === "ready" && mode === "apps" && (
        <div className="project-screen-library__grid">
          {apps.map((app) => {
            const key = appCardKey(app);
            return (
              <Card
                key={key}
                padding={1}
                className="project-screen-library__card"
                {...dragProps({ kind: "app", app, platform }, app.app)}
              >
                <div className="project-screen-library__preview">
                  <PlaceholderImage
                    src={app.screens?.[0]?.url}
                    accent={app.accent}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className="project-screen-library__identity">
                  <AppIcon
                    name={app.app}
                    iconUrl={app.iconUrl}
                    accent={app.accent}
                    size={26}
                    className="project-screen-library__app-icon"
                  />
                  <span>
                    <strong>{app.app}</strong>
                    <small>
                      {app.totalScreens} {app.totalScreens === 1 ? "screen" : "screens"}
                    </small>
                  </span>
                </div>
              </Card>
            );
          })}
          {apps.length === 0 && (
            <p className="project-screen-library__empty" role="status">
              No apps match this search.
            </p>
          )}
        </div>
      )}
      {state === "ready" && mode === "flows" && (
        <div className="project-screen-library__grid">
          {flows.map((item) => {
            const key = `flow:${flowCatalogItemKey(item)}`;
            const evidence = item.preview.flow.steps.flatMap((step) => step.evidence)[0];
            return (
              <Card
                key={key}
                padding={1}
                className="project-screen-library__card"
                {...dragProps({ kind: "flow", item, platform }, item.title)}
              >
                <div className="project-screen-library__preview">
                  <PlaceholderImage
                    src={evidence?.thumbnailUrl ?? evidence?.imageUrl}
                    accent={item.preview.appIconUrl ? undefined : "#edf3ff"}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className="project-screen-library__identity">
                  <AppIcon
                    name={item.preview.appName}
                    iconUrl={item.preview.appIconUrl ?? undefined}
                    size={26}
                    className="project-screen-library__app-icon"
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.preview.appName} · {item.preview.screenCount}
                      {item.preview.screenCount === 1 ? " step" : " steps"}
                    </small>
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
        <div className="project-screen-library__grid">
          {results.map((result) => {
            const key = screenKey(result);
            const { app, screen } = result;
            return (
              <Card
                key={key}
                padding={1}
                className="project-screen-library__card"
                {...dragProps({ kind: "screen", result }, app.app)}
              >
                <div className="project-screen-library__preview">
                  <PlaceholderImage
                    src={screen.url}
                    accent={app.accent}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className="project-screen-library__identity">
                  <AppIcon
                    name={app.app}
                    iconUrl={app.iconUrl}
                    accent={app.accent}
                    size={26}
                    className="project-screen-library__app-icon"
                  />
                  <span>
                    <strong>{app.app}</strong>
                    <small>{screen.type || screen.productArea || "Screen"}</small>
                  </span>
                </div>
              </Card>
            );
          })}
          {!results.length && (
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
