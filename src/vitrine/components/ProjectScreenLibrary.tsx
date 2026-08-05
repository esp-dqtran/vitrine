import { useEffect, useMemo, useState } from "react";
import { Button, Card, TextInput } from "@astryxdesign/core";

import type { AppsDiscoveryScreenResult, AppsPlatform } from "../appsDiscovery.ts";
import { filterAppsDiscoveryScreens } from "../appsDiscovery.ts";
import { fetchCatalogPage } from "../useApps.ts";
import { AppIcon } from "./AppIcon.tsx";
import { PlaceholderImage } from "./PlaceholderImage.tsx";

type ScreenLibraryState = "loading" | "ready" | "error";

const platforms: Array<{ value: AppsPlatform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
];

const screenKey = ({ app, screen }: AppsDiscoveryScreenResult) => `${app.id}:${screen.id}`;

export function ProjectScreenLibrary({
  insertingKey,
  message,
  onClose,
  onInsert,
}: {
  insertingKey?: string;
  message: string;
  onClose(): void;
  onInsert(result: AppsDiscoveryScreenResult): void;
}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<AppsPlatform>("web");
  const [state, setState] = useState<ScreenLibraryState>("loading");
  const [results, setResults] = useState<AppsDiscoveryScreenResult[]>([]);

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
      void fetchCatalogPage(endpoint, controller.signal)
        .then((page) => {
          setResults(filterAppsDiscoveryScreens(page.apps, {
            query,
            facets: [],
            platform,
            sort: "latest",
          }).slice(0, 24));
          setState("ready");
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") setState("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, platform, query]);

  return (
    <aside className="project-screen-library" aria-label="Screens library">
      <header className="project-screen-library__header">
        <div>
          <span>Astryx data</span>
          <h2>Screens</h2>
          <p>Search captured product screens and place them on this canvas.</p>
        </div>
        <Button label="Close" variant="ghost" size="sm" onClick={onClose} />
      </header>

      <TextInput
        label="Search screens"
        isLabelHidden
        value={query}
        onChange={setQuery}
        placeholder="Search apps or screen types…"
        width="100%"
      />

      <div className="project-screen-library__platforms" role="tablist" aria-label="Screen platform">
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

      {message && <p className="project-screen-library__message" role="status">{message}</p>}
      {state === "loading" && (
        <p className="project-screen-library__empty" role="status">Loading screens…</p>
      )}
      {state === "error" && (
        <p className="project-screen-library__empty" role="alert">
          Screens could not be loaded. Try again in a moment.
        </p>
      )}
      {state === "ready" && (
        <div className="project-screen-library__grid">
          {results.map((result) => {
            const key = screenKey(result);
            const { app, screen } = result;
            return (
              <Card key={key} padding={1} className="project-screen-library__card">
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
                <Button
                  label={insertingKey === key ? "Adding…" : "Add to canvas"}
                  variant="secondary"
                  size="sm"
                  isDisabled={insertingKey !== undefined}
                  clickAction={() => onInsert(result)}
                />
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
