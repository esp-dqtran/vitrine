import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { listSites } from '../sitesApi.ts';
import type { SiteSummary } from '../types.ts';
import { ReferenceGalleryShell } from './ReferenceGalleryShell.tsx';
import { SiteImportDialog } from './SiteImportDialog.tsx';
import { SearchInput } from './SearchInput.tsx';
import { SiteCard } from './SiteCard.tsx';

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

export function SitesPageView({ sites, isAdmin, error, query, onQueryChange, onRefresh, onImport, onOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }), memberControls }: SitesPageViewProps) {
  const needle = query.trim().toLowerCase();
  const visibleSites = sites.filter((site) => !needle || [
    site.name,
    site.label,
    ...site.previews.map((page) => page.title),
  ].join(' ').toLowerCase().includes(needle));

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: '1 1 auto', maxWidth: 420 }}>
        <SearchInput value={query} onChange={onQueryChange} placeholder="Search sites, versions, and sections…" />
      </div>
      <Button variant="ghost" label={error ? 'Retry' : 'Refresh'} clickAction={onRefresh} />
    </div>
  );

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
            ? 'Import a Mobbin Sites preview URL to create the first website reference.'
            : 'No ready website references are available yet.',
        }
      : visibleSites.length === 0
        ? {
            title: 'No Sites match this search',
            description: 'Try a Site name, version, or section keyword.',
          }
        : undefined;

  return (
    <ReferenceGalleryShell
      active="sites"
      isAdmin={isAdmin}
      headerAction={isAdmin ? <Button variant="primary" label="Import Site" clickAction={onImport} /> : undefined}
      toolbar={toolbar}
      memberControls={memberControls}
      countLabel={`Showing ${visibleSites.length} of ${sites.length} sites`}
      state={state}
    >
      {visibleSites.map((site) => <SiteCard key={`${site.id}:${site.versionId}`} site={site} onOpen={() => onOpen(site)} />)}
    </ReferenceGalleryShell>
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
      <ReferenceGalleryShell
        active="sites"
        isAdmin={isAdmin}
        toolbar={<SearchInput value="" onChange={() => undefined} placeholder="Search sites, versions, and sections…" />}
        memberControls={memberControls}
        loading
      />
    );
  }
  return (
    <>
      <SitesPageView sites={sites} isAdmin={isAdmin} error={error || undefined} query={query} onQueryChange={onQueryChange} onRefresh={() => setRevision((value) => value + 1)} onImport={() => setImportOpen(true)} memberControls={memberControls} />
      {isAdmin && <SiteImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onExisting={(siteId, versionId) => navigate({ name: 'site-version', siteId, versionId })} />}
    </>
  );
}
