import type { SearchFacets, SearchFilters } from "../../searchTypes.ts";
import { AdvancedSearchFilters } from "./AdvancedSearchFilters.tsx";

export function AdvancedSearchFilterDrawer({
  open,
  filters,
  facets,
  keys,
  onChange,
  onClose,
}: {
  open: boolean;
  filters: SearchFilters;
  facets: SearchFacets;
  keys?: Array<keyof SearchFilters>;
  onChange(filters: SearchFilters): void;
  onClose(): void;
}) {
  if (!open) return null;
  return (
    <div className="advanced-search-drawer" role="dialog" aria-modal="true" aria-label="Search filters">
      <header><h2>Filters</h2><button type="button" onClick={onClose}>Close</button></header>
      <AdvancedSearchFilters filters={filters} facets={facets} keys={keys} onChange={onChange} />
      <footer>
        <button type="button" onClick={onClose}>Done</button>
      </footer>
    </div>
  );
}
