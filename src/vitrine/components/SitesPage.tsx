import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { listSites } from '../sitesApi.ts';
import type { SiteSummary } from '../types.ts';
import { SiteImportDialog } from './SiteImportDialog.tsx';
import { SiteCard } from './SiteCard.tsx';
import { SitesTopNav } from './SitesTopNav.tsx';

export type SiteSort = 'latest' | 'popular';
export type SiteFacet = { group: 'categories' | 'sections' | 'styles'; value: string };

const DISCOVERY_FACETS: Array<{
  group: SiteFacet['group'];
  label: string;
  defaults: string[];
}> = [
  { group: 'categories', label: 'Categories', defaults: ['Portfolio', 'Lifestyle', 'Finance', 'Business', 'Shopping'] },
  { group: 'sections', label: 'Sections', defaults: ['Pricing', 'How It Works', 'About', 'Social Proof', 'FAQ', '404', 'Blog', 'Hero', 'Showcase', 'Footer'] },
  { group: 'styles', label: 'Styles', defaults: ['Minimal', 'Dark', 'Photography', 'Motion', 'Colorful'] },
];

export function filterAndSortSites(
  sites: SiteSummary[],
  query: string,
  facet: SiteFacet | null,
  sort: SiteSort,
): SiteSummary[] {
  const needle = query.trim().toLowerCase();
  const normalizedFacet = facet?.value.toLowerCase();
  return sites
    .filter((site) => {
      const searchable = [
        site.name,
        site.label,
        site.sourceUrl,
        site.description ?? '',
        ...(site.categories ?? []),
        ...(site.styles ?? []),
        ...site.previews.map((page) => page.title),
      ].join(' ').toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (!facet || !normalizedFacet) return true;
      if (facet.group === 'categories') {
        return (site.categories ?? []).some((value) => value.toLowerCase() === normalizedFacet);
      }
      if (facet.group === 'styles') {
        return (site.styles ?? []).some((value) => value.toLowerCase() === normalizedFacet);
      }
      return site.previews.some((page) => page.title.toLowerCase().includes(normalizedFacet));
    })
    .sort((a, b) => {
      if (sort === 'popular') {
        return (b.popularity ?? b.sectionCount) - (a.popularity ?? a.sectionCount)
          || b.sectionCount - a.sectionCount
          || a.name.localeCompare(b.name);
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name);
    });
}

interface SitesPageViewProps {
  sites: SiteSummary[];
  isAdmin: boolean;
  error?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onOpen?: (site: SiteSummary) => void;
  memberControls?: ReactNode;
}

export function SitesPageView({
  sites,
  isAdmin,
  error,
  query,
  onQueryChange,
  onRefresh,
  onImport,
  onOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }),
  memberControls,
}: SitesPageViewProps) {
  const [sort, setSort] = useState<SiteSort>('latest');
  const [facet, setFacet] = useState<SiteFacet | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const visibleSites = useMemo(
    () => filterAndSortSites(sites, query, facet, sort),
    [sites, query, facet, sort],
  );
  const facetGroups = DISCOVERY_FACETS.map((entry) => ({ ...entry, values: entry.defaults }));

  const state = error
    ? {
        title: 'Could not load Sites',
        description: error,
        actions: <Button variant="primary" label="Retry" clickAction={onRefresh} />,
        role: 'alert' as const,
      }
    : sites.length === 0
      ? {
          title: 'No Sites imported yet',
          description: isAdmin
            ? 'Analyze one public page to create the first website reference.'
            : 'No ready website references are available yet.',
          role: 'status' as const,
        }
      : visibleSites.length === 0
        ? {
            title: facet ? 'No Sites match these filters' : 'No Sites match this search',
            description: facet
              ? 'Try another search, category, section, or style.'
              : 'Try a Site name, version, or section keyword.',
            role: 'status' as const,
          }
        : null;

  return (
    <main data-sites-discovery="true" data-reference-gallery-shell="sites" className="sites-discovery">
      <SitesTopNav
        query={query}
        onQueryChange={onQueryChange}
        isAdmin={isAdmin}
        onImport={onImport}
        accountControls={memberControls}
      />
      <div className="sites-discovery__content">
        {filtersOpen ? <div className="sites-discovery__taxonomy" aria-label="Site discovery filters">
          {facetGroups.map((group) => (
            <section key={group.group} className={`sites-discovery__facet sites-discovery__facet--${group.group}`}>
              <h2>{group.label}</h2>
              <div>
                {group.values.map((value) => {
                  const selected = facet?.group === group.group && facet.value === value;
                  return (
                    <Button
                      key={value}
                      label={value}
                      variant="ghost"
                      size="sm"
                      aria-pressed={selected}
                      onClick={() => setFacet(selected ? null : { group: group.group, value })}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div> : null}

        <div className="sites-discovery__toolbar">
          <div role="tablist" aria-label="Site ordering" className="sites-discovery__sort">
            <Button label="Latest" variant="ghost" size="sm" role="tab" aria-selected={sort === 'latest'} onClick={() => setSort('latest')} />
            <Button label="Most popular" variant="ghost" size="sm" role="tab" aria-selected={sort === 'popular'} onClick={() => setSort('popular')} />
          </div>
          <div className="sites-discovery__toolbar-actions">
            {facet ? (
              <Button
                label={`Clear ${facet.value}`}
                variant="ghost"
                size="sm"
                className="sites-discovery__clear"
                onClick={() => setFacet(null)}
              />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              label="Filter"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            />
          </div>
        </div>

        {state ? (
          <div className="sites-discovery__state" role={state.role}>
            <EmptyState title={state.title} description={state.description} actions={state.actions} />
          </div>
        ) : (
          <div data-reference-gallery-grid="true" className="sites-discovery__grid">
            {visibleSites.map((site) => (
              <SiteCard key={`${site.id}:${site.versionId}`} site={site} onOpen={() => onOpen(site)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

interface SitesPageProps {
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  memberControls?: ReactNode;
}

export function SitesPage({ isAdmin, query, onQueryChange, memberControls }: SitesPageProps) {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listSites()
      .then((items) => { if (active) { setSites(items); setError(''); } })
      .catch((cause: Error) => { if (active) { setSites([]); setError(cause.message); } });
    return () => { active = false; };
  }, [revision]);

  if (sites === null) {
    return (
      <main className="sites-discovery" role="status" aria-label="Loading Sites">
        <div className="sites-discovery__loading">
          {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
        </div>
      </main>
    );
  }
  return (
    <>
      <SitesPageView
        sites={sites}
        isAdmin={isAdmin}
        error={error || undefined}
        query={query}
        onQueryChange={onQueryChange}
        onRefresh={() => setRevision((value) => value + 1)}
        onImport={() => setImportOpen(true)}
        memberControls={memberControls}
      />
      {isAdmin && (
        <SiteImportDialog
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onExisting={(siteId, versionId) => navigate({ name: 'site-version', siteId, versionId })}
        />
      )}
    </>
  );
}
