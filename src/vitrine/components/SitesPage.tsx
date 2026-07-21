import { useEffect, useState } from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { listSites } from '../sitesApi.ts';
import type { SiteSummary } from '../types.ts';
import { PageHeader } from './PageHeader.tsx';
import { SiteImportDialog } from './SiteImportDialog.tsx';
import { GalleryCardSkeleton, GalleryToolbar } from './GalleryToolbar.tsx';
import { SearchInput } from './SearchInput.tsx';
import { SiteCard } from './SiteCard.tsx';
import { ReferenceTypeTabs } from './ReferenceTypeTabs.tsx';

interface SitesPageViewProps {
  sites: SiteSummary[];
  isAdmin: boolean;
  error?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onOpen?: (site: SiteSummary) => void;
}

export function SitesPageView({ sites, isAdmin, error, query, onQueryChange, onRefresh, onImport, onOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }) }: SitesPageViewProps) {
  const needle = query.trim().toLowerCase();
  const visibleSites = sites.filter((site) => !needle || [
    site.name,
    site.label,
    ...site.previews.map((page) => page.title),
  ].join(' ').toLowerCase().includes(needle));
  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 72px' }}>
      <PageHeader
        title="References"
        description="Browse captured websites and reusable interface sections."
        action={isAdmin ? <Button variant="primary" label="Import Site" clickAction={onImport} /> : undefined}
      />
      <ReferenceTypeTabs active="sites" />
      <GalleryToolbar>
        <div style={{ maxWidth: 420 }}>
          <SearchInput value={query} onChange={onQueryChange} placeholder="Search sites, versions, and sections…" />
        </div>
      </GalleryToolbar>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 20px' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Showing {visibleSites.length} of {sites.length} sites</span>
        <Button variant="ghost" label={error ? 'Retry' : 'Refresh'} clickAction={onRefresh} />
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', marginBottom: 18 }}>Could not load Sites: {error}</div>}
      {sites.length === 0 && !error ? (
        <EmptyState title="No Sites imported yet" description={isAdmin ? 'Import a Mobbin Sites preview URL to create the first website reference.' : 'No ready website references are available yet.'} />
      ) : visibleSites.length === 0 && !error ? (
        <EmptyState title="No Sites match this search" description="Try a Site name, version, or section keyword." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
          {visibleSites.map((site) => <SiteCard key={`${site.id}:${site.versionId}`} site={site} onOpen={() => onOpen(site)} />)}
        </div>
      )}
    </main>
  );
}

interface SitesPageProps {
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}

export function SitesPage({ isAdmin, query, onQueryChange }: SitesPageProps) {
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
      <main role="status" aria-label="Loading Sites" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 72px' }}>
        <PageHeader title="References" description="Browse captured websites and reusable interface sections." />
        <ReferenceTypeTabs active="sites" />
        <GalleryToolbar><div style={{ maxWidth: 420 }}><SearchInput value="" onChange={() => undefined} placeholder="Search sites, versions, and sections…" /></div></GalleryToolbar>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, padding: '22px 0 72px' }}>
          {Array.from({ length: 9 }, (_, index) => <GalleryCardSkeleton key={index} index={index} />)}
        </div>
      </main>
    );
  }
  return (
    <>
      <SitesPageView sites={sites} isAdmin={isAdmin} error={error || undefined} query={query} onQueryChange={onQueryChange} onRefresh={() => setRevision((value) => value + 1)} onImport={() => setImportOpen(true)} />
      {isAdmin && <SiteImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onExisting={(siteId, versionId) => navigate({ name: 'site-version', siteId, versionId })} />}
    </>
  );
}
