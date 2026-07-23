import { useEffect, useState } from "react";
import type { SearchFacets, SearchFilters } from "../../searchTypes.ts";
import { AdvancedSearchFilters } from "./AdvancedSearchFilters.tsx";

export function AdvancedSearchFilterDrawer({
  open,
  filters,
  facets,
  onApply,
  onClose,
}: {
  open: boolean;
  filters: SearchFilters;
  facets: SearchFacets;
  onApply(filters: SearchFilters): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);
  if (!open) return null;
  return (
    <div className="advanced-search-drawer" role="dialog" aria-modal="true" aria-label="Search filters">
      <header><h2>Filters</h2><button type="button" onClick={onClose}>Close</button></header>
      <AdvancedSearchFilters filters={draft} facets={facets} onChange={setDraft} />
      <footer>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={() => { onApply(draft); onClose(); }}>Show results</button>
      </footer>
    </div>
  );
}
