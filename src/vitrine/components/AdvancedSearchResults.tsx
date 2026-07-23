import type { SearchResultItem } from "../../searchTypes.ts";
import { SearchResultCard } from "./SearchResultCard.tsx";

export function AdvancedSearchResults({
  items,
  onPreview,
  comparisonAppIds = [],
  onToggleCompare,
}: {
  items: SearchResultItem[];
  onPreview(item: SearchResultItem): void;
  comparisonAppIds?: number[];
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
          selected={comparisonAppIds.includes(item.appId)}
          onToggleCompare={onToggleCompare}
        />
      ))}
    </div>
  );
}
