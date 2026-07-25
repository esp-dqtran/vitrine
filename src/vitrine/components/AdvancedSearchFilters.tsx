import type { SearchFacets, SearchFilters } from "../../searchTypes.ts";

const labels: Record<keyof SearchFilters, string> = {
  platform: "Platform",
  app: "App",
  appCategory: "App category",
  pageType: "Screen / page type",
  productArea: "Product area",
  flow: "Flow",
  component: "Component",
  state: "State",
  theme: "Theme",
  layout: "Layout",
  siteSection: "Site section",
  siteStyle: "Site style",
};

export function AdvancedSearchFilters({
  filters,
  facets,
  onChange,
  keys = Object.keys(labels) as Array<keyof SearchFilters>,
}: {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange(filters: SearchFilters): void;
  keys?: Array<keyof SearchFilters>;
}) {
  return (
    <aside className="advanced-search-filters" aria-label="Search filters">
      {keys.map((key) => {
        const options = (facets[key] ?? []).filter(({ count }) => count > 0);
        if (!options.length) return null;
        return (
          <fieldset key={key}>
            <legend>{labels[key]}</legend>
            {options.map(({ value, count }) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={filters[key].includes(value)}
                  onChange={() => onChange({
                    ...filters,
                    [key]: filters[key].includes(value)
                      ? filters[key].filter((selected) => selected !== value)
                      : [...filters[key], value].sort(),
                  })}
                />
                <span>{value}</span><small>{count}</small>
              </label>
            ))}
          </fieldset>
        );
      })}
    </aside>
  );
}
