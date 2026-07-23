import { useEffect, useRef, useState } from "react";
import type { ResearchCollection } from "../../db.ts";
import type { SearchResultItem } from "../../searchTypes.ts";
import { loadRelatedSearchResults } from "../advancedSearchApi.ts";
import { PlaceholderImage } from "./PlaceholderImage.tsx";
import { SearchResearchActions } from "./SearchResearchActions.tsx";

export function AdvancedSearchPreview({
  item,
  onClose,
  collections,
  onCollectionsChange,
  plan,
  comparison,
  onComparisonChange,
}: {
  item: SearchResultItem;
  onClose(): void;
  collections: ResearchCollection[];
  onCollectionsChange(collections: ResearchCollection[]): void;
  plan: "free" | "pro";
  comparison: SearchResultItem[];
  onComparisonChange(items: SearchResultItem[]): void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const [related, setRelated] = useState<SearchResultItem[]>([]);
  const [relatedState, setRelatedState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const controller = new AbortController();
    void loadRelatedSearchResults(item.sourceId, controller.signal)
      .then((result) => { setRelated(result.items); setRelatedState("ready"); })
      .catch((error) => {
        if (error.name !== "AbortError") setRelatedState("error");
      });
    return () => { controller.abort(); origin?.focus(); };
  }, [item.sourceId]);
  return (
    <div className="advanced-search-preview" role="dialog" aria-modal="true" aria-label={`Preview ${item.title}`}>
      <div className="advanced-search-preview__panel">
        <button ref={close} type="button" onClick={onClose}>Close preview</button>
        <div className="advanced-search-preview__media"><PlaceholderImage src={item.imageUrl} /></div>
        <header><span>{item.appName} · {item.platform}</span><h2>{item.title}</h2><p>{item.description}</p></header>
        {item.flowName ? <p>Surrounding flow: {item.flowName}{item.flowStepIndex !== undefined ? ` · Step ${item.flowStepIndex + 1}` : ""}</p> : null}
        <SearchResearchActions
          item={item}
          collections={collections}
          onCollectionsChange={onCollectionsChange}
          plan={plan}
          comparison={comparison}
          onComparisonChange={onComparisonChange}
        />
        <section><h3>Related research</h3>
          {relatedState === "loading" ? <p>Loading related results…</p> : null}
          {relatedState === "error" ? <p>Related results are unavailable.</p> : null}
          {relatedState === "ready" && !related.length ? <p>No related results yet.</p> : null}
          {related.map((candidate) => <span key={candidate.documentId}>{candidate.title}</span>)}
        </section>
      </div>
    </div>
  );
}
