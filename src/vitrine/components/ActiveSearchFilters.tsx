import { Button } from "@astryxdesign/core";
import type { SearchFilters } from "../../searchTypes.ts";
import { emptySearchFilters } from "../searchState.ts";
import { DiscoveryActiveFilter } from "./AppsFilterBar.tsx";

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
    <div className="advanced-search-active-filters" aria-label="Active search filters">
      {active.map(({ key, value }) => (
        <DiscoveryActiveFilter
          key={`${key}:${value}`}
          label={value}
          onClear={() => onChange({
            ...filters,
            [key]: filters[key].filter((selected) => selected !== value),
          })}
        />
      ))}
      <Button
        label="Clear all"
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...emptySearchFilters })}
      />
    </div>
  );
}
