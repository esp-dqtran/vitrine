import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { getSiteVersion } from '../sitesApi.ts';
import type { SiteVersionDetail, SiteVersionPage as SitePage } from '../types.ts';
import { SiteImportDialog } from './SiteImportDialog.tsx';

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
  onBack: () => void;
  onImport: () => void;
}

export function SiteVersionView({ detail, isAdmin, onBack, onImport }: SiteVersionViewProps) {
  const pages = useMemo(() => [...detail.pages].sort((a, b) => a.position - b.position), [detail.pages]);
  const [selectedId, setSelectedId] = useState(pages[0]?.id);
  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];
  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 28px 72px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <Button variant="ghost" label="Back to Sites" clickAction={onBack} />
        {isAdmin && <div style={{ marginLeft: 'auto' }}><Button variant="primary" label="Import Site" clickAction={onImport} /></div>}
      </div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>{detail.site.name}</h1>
        <p style={{ margin: '7px 0 0', color: 'var(--color-text-secondary)' }}>{detail.version.label}{detail.version.isLatest ? ' · Latest' : ''} · {pages.length} {pages.length === 1 ? 'page' : 'pages'}</p>
      </header>
      {pages.length > 1 && (
        <nav aria-label="Site pages" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {pages.map((page) => <Button key={page.id} variant={page.id === selected?.id ? 'primary' : 'secondary'} label={page.title} clickAction={() => setSelectedId(page.id)} />)}
        </nav>
      )}
      {selected ? <SelectedPage page={selected} /> : <EmptyState title="No pages in this Site" description="The imported version did not contain a ready page." />}
    </main>
  );
}

function SelectedPage({ page }: { page: SitePage }) {
  const sections = [...page.sections].sort((a, b) => a.position - b.position);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 28, alignItems: 'start' }}>
      <aside style={{ position: 'sticky', top: 20 }}>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 650, color: 'var(--color-text-primary)' }}>Full-page reference</div>
        <img src={page.fullPageImageUrl} alt={`${page.title} full-page reference`} loading="lazy" style={{ display: 'block', width: '100%', border: '1px solid var(--color-border)', borderRadius: 12 }} />
      </aside>
      <section aria-label={`${page.title} sections`} style={{ display: 'grid', gap: 20 }}>
        {sections.map((section, index) => (
          <article key={section.id} style={{ border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--color-background-surface)' }}>
            {section.mediaKind === 'video' ? (
              <video src={section.mediaUrl} poster={section.posterUrl} controls preload="metadata" style={{ display: 'block', width: '100%', background: '#111' }} />
            ) : (
              <img src={section.mediaUrl} alt={`${page.title} section ${index + 1}`} loading="lazy" style={{ display: 'block', width: '100%' }} />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <span>Section {index + 1}</span>
              {section.cropTop !== undefined && section.cropBottom !== undefined && <span>Crop {section.cropTop}–{section.cropBottom} px</span>}
              {section.videoStartSeconds !== undefined && section.videoEndSeconds !== undefined && <span>{section.videoStartSeconds}–{section.videoEndSeconds} seconds</span>}
              <span>{section.ocrBoxes.length} OCR {section.ocrBoxes.length === 1 ? 'region' : 'regions'}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

interface SiteVersionPageProps {
  siteId: number;
  versionId: number;
  isAdmin: boolean;
  initialSection?: string;
  onSectionChange?: (section: string) => void;
}

export function SiteVersionPage(props: SiteVersionPageProps) {
  const { siteId, versionId, isAdmin } = props;
  const [detail, setDetail] = useState<SiteVersionDetail | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    let active = true;
    setDetail(null);
    getSiteVersion(siteId, versionId)
      .then((value) => { if (active) { setDetail(value); setError(''); } })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [siteId, versionId, revision]);

  if (error && !detail) {
    return <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}><div><EmptyState title="Could not load Site version" description={error} /><Button variant="secondary" label="Retry" clickAction={() => setRevision((value) => value + 1)} /></div></div>;
  }
  if (!detail) return <div role="status" aria-label="Loading Site version" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><Spinner size="lg" aria-hidden="true" /></div>;
  return (
    <>
      <SiteVersionView detail={detail} isAdmin={isAdmin} onBack={() => navigate({ name: 'sites' })} onImport={() => setImportOpen(true)} />
      {isAdmin && <SiteImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onExisting={(nextSiteId, nextVersionId) => navigate({ name: 'site-version', siteId: nextSiteId, versionId: nextVersionId })} />}
    </>
  );
}
