import type { SearchResultItem } from "../../searchTypes.ts";
import { SearchResultCard } from "./SearchResultCard.tsx";

export function AdvancedSearchResults({
  items,
  onPreview,
  comparisonAppIds = [],
  comparisonAppNames = [],
  onToggleCompare,
}: {
  items: SearchResultItem[];
  onPreview(item: SearchResultItem): void;
  comparisonAppIds?: number[];
  comparisonAppNames?: string[];
  onToggleCompare?(item: SearchResultItem): void;
}) {
  if (!items.length) {
    return <div className="advanced-search-empty"><h2>No matching research yet</h2><p>Try a broader phrase or remove a filter.</p></div>;
  }
  return (
    <div className="advanced-search-results" aria-label="Ranked search results">
      {items.map((item) => (
        <SearchResultCard
          key={item.documentId}
          item={item}
          onPreview={onPreview}
          selected={Boolean(
            (item.appId !== undefined && comparisonAppIds.includes(item.appId))
            || (item.appName && comparisonAppNames.includes(item.appName)),
          )}
          onToggleCompare={
            item.catalogScope === "apps" && item.appId !== undefined
              ? onToggleCompare
              : undefined
          }
        />
      ))}
    </div>
  );
}
