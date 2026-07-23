import type { SearchFilters } from "../../searchTypes.ts";
import { emptySearchFilters } from "../searchState.ts";

export function ActiveSearchFilters({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange(filters: SearchFilters): void;
}) {
  const active = (Object.keys(filters) as Array<keyof SearchFilters>)
    .flatMap((key) => filters[key].map((value) => ({ key, value })));
  if (!active.length) return null;
  return (
    <div className="advanced-search-active-filters" aria-label="Active filters">
      {active.map(({ key, value }) => (
        <button
          type="button"
          key={`${key}:${value}`}
          onClick={() => onChange({
            ...filters,
            [key]: filters[key].filter((selected) => selected !== value),
          })}
        >
          {value} ×
        </button>
      ))}
      <button type="button" onClick={() => onChange({ ...emptySearchFilters })}>Clear all</button>
    </div>
  );
}
