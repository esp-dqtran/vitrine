import { useEffect, useState, type ReactNode } from 'react';
import type { ResearchCollection } from '../../db.ts';
import type { ResearchProjectSummary } from '../../researchProject.ts';
import { listResearchProjects } from '../researchProjectsApi.ts';
import { listCollections } from '../researchApi.ts';
import { useCatalogCategories } from '../categoryFacets.ts';
import { navigate, updateLocation } from '../router.ts';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';

export type CatalogLibraryKind = 'collections' | 'projects';

export interface CatalogLibraryPageProps {
  kind: CatalogLibraryKind;
  isAdmin: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  onOpenCollection?: (id: number) => void;
  onOpenProject?: (id: string) => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function when(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed);
}

/*
 * Collections and Projects on the rebuilt surface. Both are "things you made",
 * both are a list of rows with a count and a date, so they share a page rather
 * than duplicating a layout that would drift apart.
 */
export function CatalogLibraryPage(props: CatalogLibraryPageProps) {
  const [collections, setCollections] = useState<ResearchCollection[] | null>(null);
  const [projects, setProjects] = useState<ResearchProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { kind } = props;
  useEffect(() => {
    let live = true;
    setError(null);
    const load = kind === 'collections'
      ? listCollections().then((items: ResearchCollection[]) => { if (live) setCollections(items); })
      : listResearchProjects().then((items: ResearchProjectSummary[]) => { if (live) setProjects(items); });
    load.catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [kind]);

  const rows: CatalogLibraryRow[] | null = kind === 'collections'
    ? collections?.map((collection) => ({
        key: String(collection.id),
        title: collection.name,
        detail: collection.description || null,
        /* A summary payload may omit `items`; a missing count must not take the
           whole page down with it. */
        meta: `${collection.items?.length ?? 0} ${collection.items?.length === 1 ? 'item' : 'items'}`,
        stamp: when(collection.updated_at),
        onOpen: () => props.onOpenCollection?.(collection.id),
      })) ?? null
    : projects?.map((project) => ({
        key: project.id,
        title: project.title,
        detail: project.question || null,
        meta: `${project.evidenceCount ?? 0} ${project.evidenceCount === 1 ? 'item' : 'items'} of evidence`,
        stamp: when(project.updatedAt),
        /* A synthesis that no longer matches its evidence is the one state
           worth surfacing in a list — it means the write-up is out of date. */
        flag: project.synthesisState === 'stale' ? 'Synthesis stale' : null,
        onOpen: () => props.onOpenProject?.(project.id),
      })) ?? null;

  return (
    <CatalogLibraryView
      {...props}
      rows={rows}
      error={error}
      loading={rows === null && error === null}
    />
  );
}

export interface CatalogLibraryRow {
  key: string;
  title: string;
  detail: string | null;
  meta: string;
  stamp: string | null;
  flag?: string | null;
  onOpen: () => void;
}

/* Split so the populated list renders in a test — both endpoints need auth. */
export function CatalogLibraryView({
  kind,
  isAdmin,
  accountControls,
  onSignIn,
  entitlement,
  onUpgrade,
  rows,
  loading,
  error,
}: CatalogLibraryPageProps & {
  rows: CatalogLibraryRow[] | null;
  loading: boolean;
  error: string | null;
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const categories = useCatalogCategories(
    { platform: 'web', contentType: 'apps', sort: 'latest', query: '', filters: [] },
    isAdmin,
  );
  const label = kind === 'collections' ? 'Collections' : 'Projects';

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active={kind}
          categories={categories}
          selectedCategories={[]}
          showAllCategories={showAllCategories}
          onToggleShowAll={() => setShowAllCategories((open) => !open)}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === kind) return;
            if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-library" data-catalog-library={kind}>
        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">{label}</h1>
          {rows ? (
            <p className="catalog-browse__count" aria-live="polite">
              {rows.length} {rows.length === 1
                ? label.toLowerCase().replace(/s$/, '')
                : label.toLowerCase()}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="catalog-browse__state" role="alert">{error}</p>
        ) : loading ? (
          <p className="catalog-browse__state" role="status">Loading {label.toLowerCase()}…</p>
        ) : rows && rows.length === 0 ? (
          <p className="catalog-browse__state" role="status">
            {kind === 'collections'
              ? 'No collections yet. Save a screen from the catalog to start one.'
              : 'No projects yet. Start one from a research question.'}
          </p>
        ) : (
          <ul className="catalog-library__list">
            {rows?.map((row) => (
              <li key={row.key}>
                <button type="button" className="catalog-library__row" onClick={row.onOpen}>
                  <span className="catalog-library__title">
                    {row.title}
                    {row.flag ? (
                      <em className="catalog-library__flag">{row.flag}</em>
                    ) : null}
                  </span>
                  {row.detail ? (
                    <span className="catalog-library__detail">{row.detail}</span>
                  ) : null}
                  <span className="catalog-library__meta">
                    {row.meta}
                    {row.stamp ? <span aria-hidden="true"> · </span> : null}
                    {row.stamp}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CatalogShell>
  );
}
