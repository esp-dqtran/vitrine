import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { listSites } from '../sitesApi.ts';
import type { SiteSummary } from '../types.ts';
import { PageHeader } from './PageHeader.tsx';
import { SiteImportDialog } from './SiteImportDialog.tsx';

interface SitesPageViewProps {
  sites: SiteSummary[];
  isAdmin: boolean;
  error?: string;
  onRefresh: () => void;
  onImport: () => void;
  onOpen?: (site: SiteSummary) => void;
}

export function SitesPageView({ sites, isAdmin, error, onRefresh, onImport, onOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }) }: SitesPageViewProps) {
  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 72px' }}>
      <PageHeader
        title="Sites"
        description="Inspect complete website references page by page, with their original section order and media states."
        action={isAdmin ? <Button variant="primary" label="Import Site" clickAction={onImport} /> : undefined}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 20px' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{sites.length} ready {sites.length === 1 ? 'site' : 'sites'}</span>
        <Button variant="ghost" label={error ? 'Retry' : 'Refresh'} clickAction={onRefresh} />
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', marginBottom: 18 }}>Could not load Sites: {error}</div>}
      {sites.length === 0 && !error ? (
        <EmptyState title="No Sites imported yet" description={isAdmin ? 'Import a Mobbin Sites preview URL to create the first website reference.' : 'No ready website references are available yet.'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 22 }}>
          {sites.map((site) => (
            <article key={`${site.id}:${site.versionId}`} style={{ overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-surface)' }}>
              <video src={site.previewUrl} aria-label={`${site.name} preview`} controls muted playsInline preload="metadata" style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', background: 'var(--color-background-subtle)' }} />
              <div style={{ display: 'grid', gap: 10, padding: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 650, color: 'var(--color-text-primary)' }}>{site.name}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-secondary)' }}>{site.label}{site.isLatest ? ' · Latest' : ''}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{site.pageCount} pages · {site.sectionCount} sections</div>
                <Button variant="secondary" label={`Open ${site.name}`} clickAction={() => onOpen(site)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export function SitesPage({ isAdmin }: { isAdmin: boolean }) {
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
    return <div role="status" aria-label="Loading Sites" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><Spinner size="lg" aria-hidden="true" /></div>;
  }
  return (
    <>
      <SitesPageView sites={sites} isAdmin={isAdmin} error={error || undefined} onRefresh={() => setRevision((value) => value + 1)} onImport={() => setImportOpen(true)} />
      {isAdmin && <SiteImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onExisting={(siteId, versionId) => navigate({ name: 'site-version', siteId, versionId })} />}
    </>
  );
}
