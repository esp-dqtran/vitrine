import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AdvancedSearchResult, SearchEntityType, SearchResultItem } from "../../searchTypes.ts";
import { searchAdvancedCatalog } from "../advancedSearchApi.ts";
import { defaultSearchState } from "../searchState.ts";
import type { Route } from "../router.ts";

const labels: Record<SearchEntityType, string> = {
  app: "Apps",
  screen: "Screens",
  flow: "Flows",
  component: "UI Elements",
  pattern: "Patterns",
};

export function quickSearchHandoff(query: string): { route: Route; search: string } {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  return { route: { name: "search" }, search: params.toString() };
}

export function quickSearchKeyAction(
  key: string,
  index: number,
  length: number,
): number | string {
  if (key === "Tab" || key === "Shift+Tab") return "native-tab";
  if (key === "Escape") return "close";
  if (key === "Enter") return `open:${index}`;
  if (!length) return 0;
  if (key === "ArrowDown") return (index + 1) % length;
  if (key === "ArrowUp") return (index - 1 + length) % length;
  return index;
}

export function QuickSearch({
  initialQuery = "",
  recent = [],
  initialResult = null,
  onClose,
  onPreview,
  onViewAll,
}: {
  initialQuery?: string;
  recent?: string[];
  initialResult?: AdvancedSearchResult | null;
  onClose(): void;
  onPreview(item: SearchResultItem): void;
  onViewAll(query: string): void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchAdvancedCatalog({
        ...defaultSearchState,
        query: query.trim(),
      }, undefined, controller.signal)
        .then((next) => { setResult(next); setError(""); })
        .catch((cause: Error) => {
          if (cause.name !== "AbortError") setError(cause.message);
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  const groups = useMemo(() => {
    const grouped = new Map<SearchEntityType, SearchResultItem[]>();
    for (const item of result?.items ?? []) {
      const items = grouped.get(item.entityType) ?? [];
      if (items.length < 5) grouped.set(item.entityType, [...items, item]);
    }
    return [...grouped.entries()];
  }, [result]);
  const visible = groups.flatMap(([, items]) => items);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.shiftKey && event.key === "Tab" ? "Shift+Tab" : event.key;
    const action = quickSearchKeyAction(key, active, visible.length);
    if (action === "native-tab") return;
    if (action === "close") { event.preventDefault(); onClose(); return; }
    if (typeof action === "string" && action.startsWith("open:")) {
      const selected = visible[active];
      if (selected) { event.preventDefault(); onPreview(selected); }
      return;
    }
    if (typeof action === "number" && action !== active) {
      event.preventDefault();
      setActive(action);
    }
  };
  return (
    <div className="quick-search" role="dialog" aria-modal="true" aria-label="Quick Search" onKeyDown={onKeyDown}>
      <div className="quick-search__panel">
        <header>
          <input
            role="combobox"
            aria-expanded={groups.length > 0}
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search screens, flows, UI elements…"
            aria-label="Quick Search query"
          />
          <button type="button" onClick={onClose}>Close</button>
        </header>
        {!query ? (
          <section>
            <h2>{recent.length ? "Recent searches" : "Try a research prompt"}</h2>
            {(recent.length ? recent : [
              "dark mobile checkout",
              "onboarding with progressive disclosure",
              "empty states for project tools",
            ]).map((value) => (
              <button type="button" key={value} onClick={() => setQuery(value)}>{value}</button>
            ))}
          </section>
        ) : null}
        {loading ? <p>Searching…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {groups.map(([type, items]) => (
          <section key={type}>
            <h2>{labels[type]}</h2>
            {items.map((item) => {
              const index = visible.indexOf(item);
              return (
                <button
                  type="button"
                  key={item.documentId}
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onPreview(item)}
                >
                  <strong>{item.title}</strong><span>{item.appName} · {item.platform}</span>
                </button>
              );
            })}
          </section>
        ))}
        {query.trim() ? (
          <footer><button type="button" onClick={() => onViewAll(query)}>View all results for “{query.trim()}”</button></footer>
        ) : null}
      </div>
    </div>
  );
}
