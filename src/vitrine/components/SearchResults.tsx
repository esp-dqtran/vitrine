import { Selector } from '@astryxdesign/core';
import type { CatalogEntityKind, CatalogSearchResult } from '../../catalogResearch';
import type { ResearchCollection } from '../../db';
import type { SearchFilters } from '../researchApi';

const GROUPS: Array<[CatalogEntityKind, string]> = [
  ['screen', 'Screens'], ['flow', 'Flows'], ['component', 'Components'], ['token', 'Foundations'],
  ['pattern', 'Layout and responsive patterns'], ['app', 'Apps'],
];

interface SearchResultsProps {
  result: CatalogSearchResult;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onOpen: (app: string, resultId: string) => void;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
}

export function SearchResults({ result, filters, onFiltersChange, onOpen }: SearchResultsProps) {
  const select = (label: string, key: keyof SearchFilters, values: string[]) => (
    <Selector
      label={label}
      size="sm"
      hasClear
      value={filters[key] ?? null}
      onChange={(value) => onFiltersChange({ ...filters, [key]: value ?? undefined })}
      placeholder={`All ${label.toLowerCase()}`}
      options={values}
    />
  );
  return (
    <section aria-label="Catalog search results" style={{ margin: '2px 0 28px', padding: 18, border: '1px solid var(--color-border)', borderRadius: 16, background: 'var(--color-background-surface)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <Selector
          label="Type"
          size="sm"
          value={filters.kind}
          onChange={(value) => onFiltersChange({ ...filters, kind: value as SearchFilters['kind'] })}
          options={[
            { value: 'all', label: 'All types' },
            ...GROUPS.map(([kind, label]) => ({ value: kind, label: `${label} (${result.facets.kinds[kind]})` })),
          ]}
        />
        {select('Theme', 'theme', result.facets.themes)}
        {select('Page type', 'pageType', result.facets.pageTypes)}
        {select('Product area', 'productArea', result.facets.productAreas)}
        {select('State', 'state', result.facets.states)}
        {select('Layout', 'layout', result.facets.layouts)}
        {select('Component', 'component', result.facets.components)}
        {select('App category', 'appCategory', result.facets.appCategories)}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{result.items.length} matches</span>
      </div>
      {result.items.length === 0 ? <div style={{ padding: 20, color: 'var(--color-text-secondary)' }}>No observed evidence matches these filters.</div> : GROUPS.map(([kind, label]) => {
        const items = result.items.filter((item) => item.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 8px' }}>{label}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {items.map((item) => (
                <article key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, border: '1px solid var(--color-border)', borderRadius: 11 }}>
                  <button type="button" onClick={() => onOpen(item.app, item.id)} style={{ flex: 1, border: 0, padding: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{item.title} <span style={{ fontSize: 12, color: 'var(--color-text-disabled)', fontWeight: 500 }}>· {item.app}</span></div>
                    <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{item.description}</div>
                    <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--color-text-disabled)' }}>{item.evidenceIds.length} source{item.evidenceIds.length === 1 ? '' : 's'} · observed evidence</div>
                  </button>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
