import { useEffect, useMemo, useState } from "react";
import { Button, Card, TextInput } from "@astryxdesign/core";

import type { Platform } from "../../platformFromUrl.ts";
import { flowCatalogItemKey, loadFlowCatalogPage, type FlowCatalogItem } from "../flowCatalogApi.ts";
import type { App } from "../types.ts";
import { fetchCatalogPage } from "../useApps.ts";
import { AppIcon } from "./AppIcon.tsx";
import { PlaceholderImage } from "./PlaceholderImage.tsx";

export type ProjectCanvasDataMode = "apps" | "flows";

type LibraryState = "loading" | "ready" | "error";

const platforms: Array<{ value: Platform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
];

const modes: Array<{ value: ProjectCanvasDataMode; label: string }> = [
  { value: "apps", label: "Apps" },
  { value: "flows", label: "Flows" },
];

const appKey = (app: App) => `app:${app.id}`;

export function projectCanvasDataKey(item: App | FlowCatalogItem): string {
  return "preview" in item ? `flow:${flowCatalogItemKey(item)}` : appKey(item);
}

export function ProjectCanvasDataLibrary({
  initialMode = "apps",
  insertingKey,
  message,
  onClose,
  onInsertApp,
  onInsertFlow,
}: {
  initialMode?: ProjectCanvasDataMode;
  insertingKey?: string;
  message: string;
  onClose(): void;
  onInsertApp(app: App, platform: Platform): void;
  onInsertFlow(item: FlowCatalogItem, platform: Platform): void;
}) {
  const [mode, setMode] = useState<ProjectCanvasDataMode>(initialMode);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform>("web");
  const [state, setState] = useState<LibraryState>("loading");
  const [apps, setApps] = useState<App[]>([]);
  const [flows, setFlows] = useState<FlowCatalogItem[]>([]);

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
      const request = mode === "apps"
        ? fetchCatalogPage(endpoint, controller.signal).then((page) => {
          setApps(page.apps);
          setFlows([]);
        })
        : loadFlowCatalogPage({
          platform,
          query,
          limit: 24,
          order: "browse",
        }, controller.signal).then((page) => {
          setFlows(page.items);
          setApps([]);
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
    <aside className="project-canvas-data-library" role="dialog" aria-label="Astryx data tools">
      <header className="project-canvas-data-library__header">
        <div>
          <span>Tools, media and data</span>
          <h2>Astryx data</h2>
          <p>Place live catalog objects on the canvas, then open their source details at any time.</p>
        </div>
        <Button label="Close" variant="ghost" size="sm" onClick={onClose} />
      </header>

      <div className="project-canvas-data-library__tabs" role="tablist" aria-label="Data type">
        {modes.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={mode === option.value}
            onClick={() => setMode(option.value)}
          />
        ))}
      </div>

      <TextInput
        label={mode === "apps" ? "Search apps" : "Search flows"}
        isLabelHidden
        value={query}
        onChange={setQuery}
        placeholder={mode === "apps" ? "Search apps…" : "Search flows…"}
        width="100%"
      />

      <div className="project-canvas-data-library__platforms" role="tablist" aria-label="Data platform">
        {platforms.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={platform === option.value}
            onClick={() => setPlatform(option.value)}
          />
        ))}
      </div>

      {message && <p className="project-canvas-data-library__message" role="status">{message}</p>}
      {state === "loading" && (
        <p className="project-canvas-data-library__empty" role="status">
          Loading {mode}…
        </p>
      )}
      {state === "error" && (
        <p className="project-canvas-data-library__empty" role="alert">
          {mode === "apps" ? "Apps" : "Flows"} could not be loaded. Try again in a moment.
        </p>
      )}

      {state === "ready" && mode === "apps" && (
        <div className="project-canvas-data-library__grid">
          {apps.map((app) => {
            const key = projectCanvasDataKey(app);
            const preview = app.screens.find((screen) => screen.platform === platform) ?? app.screens[0];
            return (
              <Card key={key} padding={1} className="project-canvas-data-library__card">
                <div className="project-canvas-data-library__preview">
                  <PlaceholderImage
                    src={preview?.thumbnailUrl ?? preview?.url}
                    accent={app.accent}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className="project-canvas-data-library__identity">
                  <AppIcon
                    name={app.app}
                    iconUrl={app.iconUrl}
                    accent={app.accent}
                    size={28}
                    className="project-canvas-data-library__app-icon"
                  />
                  <span>
                    <strong>{app.app}</strong>
                    <small>{app.totalScreens} screens · {app.categories[0]?.name ?? platform}</small>
                  </span>
                </div>
                <Button
                  label={insertingKey === key ? "Adding…" : "Add app to canvas"}
                  variant="secondary"
                  size="sm"
                  isDisabled={insertingKey !== undefined}
                  clickAction={() => onInsertApp(app, platform)}
                />
              </Card>
            );
          })}
          {!apps.length && (
            <p className="project-canvas-data-library__empty">No apps match this search yet.</p>
          )}
        </div>
      )}

      {state === "ready" && mode === "flows" && (
        <div className="project-canvas-data-library__grid">
          {flows.map((item) => {
            const key = projectCanvasDataKey(item);
            const evidence = item.preview.flow.steps.flatMap((step) => step.evidence)[0];
            return (
              <Card key={key} padding={1} className="project-canvas-data-library__card">
                <div className="project-canvas-data-library__preview project-canvas-data-library__preview--flow">
                  <PlaceholderImage
                    src={evidence?.thumbnailUrl ?? evidence?.imageUrl}
                    accent="#edf3ff"
                    style={{ objectFit: "contain" }}
                  />
                  <span>{item.preview.screenCount} steps</span>
                </div>
                <div className="project-canvas-data-library__identity">
                  <span className="project-canvas-data-library__app-icon" aria-hidden="true">
                    {item.preview.appIconUrl
                      ? <img src={item.preview.appIconUrl} alt="" loading="lazy" />
                      : item.preview.appName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.preview.appName} · {item.category}</small>
                  </span>
                </div>
                <Button
                  label={insertingKey === key ? "Adding…" : "Add flow to canvas"}
                  variant="secondary"
                  size="sm"
                  isDisabled={insertingKey !== undefined}
                  clickAction={() => onInsertFlow(item, platform)}
                />
              </Card>
            );
          })}
          {!flows.length && (
            <p className="project-canvas-data-library__empty">No flows match this search yet.</p>
          )}
        </div>
      )}
    </aside>
  );
}
