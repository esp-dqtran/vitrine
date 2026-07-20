import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Selector, Skeleton } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { getSiteVersion } from '../sitesApi.ts';
import type { SiteSectionView, SiteVersionDetail, SiteVersionPage as SitePage } from '../types.ts';
import { HeroButton } from './HeroButton.tsx';
import { Lightbox } from './Lightbox.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { ReferenceDetailShell } from './ReferenceDetailShell.tsx';
import { SiteImportDialog } from './SiteImportDialog.tsx';

export type SiteDetailSection = 'overview' | 'pages' | 'sections';

function resolveSiteSection(value?: string): SiteDetailSection {
  return value === 'pages' || value === 'sections' ? value : 'overview';
}

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
  section?: string;
  onSectionChange: (section: SiteDetailSection) => void;
  onBack: () => void;
  onImport: () => void;
}

interface SiteLightboxItem {
  kind: 'image' | 'video';
  url: string;
  posterUrl?: string;
  type: string;
  caption: string;
}

type SiteLightbox = { items: SiteLightboxItem[]; index: number } | null;

export function SiteVersionView({ detail, isAdmin, section, onSectionChange, onBack, onImport }: SiteVersionViewProps) {
  const pages = useMemo(() => [...detail.pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => ({ ...page, sections: [...page.sections].sort((a, b) => a.position - b.position) })), [detail.pages]);
  const activeSection = resolveSiteSection(section);
  const sectionCount = pages.reduce((total, page) => total + page.sections.length, 0);
  const [pageFilter, setPageFilter] = useState('All pages');
  const [mediaFilter, setMediaFilter] = useState('All media');
  const [lightbox, setLightbox] = useState<SiteLightbox>(null);

  const pageLightboxItems: SiteLightboxItem[] = pages.map((page) => ({
    kind: 'image',
    url: page.fullPageImageUrl,
    type: 'Page',
    caption: page.title,
  }));
  const sectionItems = pages.flatMap((page) => page.sections.map((item, index) => ({ page, item, index })));
  const visibleSections = sectionItems.filter(({ page, item }) =>
    (pageFilter === 'All pages' || page.title === pageFilter)
    && (mediaFilter === 'All media' || (mediaFilter === 'Images' ? item.mediaKind === 'image' : item.mediaKind === 'video')));
  const sectionLightboxItems: SiteLightboxItem[] = visibleSections.map(({ page, item, index }) => ({
    kind: item.mediaKind,
    url: item.mediaUrl,
    posterUrl: item.posterUrl,
    type: item.mediaKind === 'image' ? 'Image section' : 'Video section',
    caption: `${page.title} · Section ${index + 1}`,
  }));

  const goLightbox = (index: number) => {
    setLightbox((current) => current && current.items.length
      ? { ...current, index: ((index % current.items.length) + current.items.length) % current.items.length }
      : current);
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
      else if (event.key === 'ArrowLeft') goLightbox(lightbox.index - 1);
      else if (event.key === 'ArrowRight') goLightbox(lightbox.index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const body = activeSection === 'overview'
    ? <SiteOverview detail={detail} pageCount={pages.length} sectionCount={sectionCount} />
    : activeSection === 'pages'
      ? <PagesPanel pages={pages} onOpen={(index) => setLightbox({ items: pageLightboxItems, index })} />
      : (
        <SectionsPanel
          pages={pages}
          visibleSections={visibleSections}
          pageFilter={pageFilter}
          mediaFilter={mediaFilter}
          onPageFilterChange={setPageFilter}
          onMediaFilterChange={setMediaFilter}
          onOpen={(index) => setLightbox({ items: sectionLightboxItems, index })}
        />
      );

  return (
    <>
      <ReferenceDetailShell
        title={detail.site.name}
        identityKey={`site-icon-${detail.site.id}`}
        identityLabel={detail.site.name[0] ?? 'S'}
        backLabel="Back to all sites"
        onBack={onBack}
        metadata={[
          { label: 'Version', value: `${detail.version.label}${detail.version.isLatest ? ' · Latest' : ''}` },
          { label: 'Pages', value: String(pages.length) },
          { label: 'Sections', value: String(sectionCount) },
        ]}
        actions={(
          <>
            <HeroButton onClick={() => window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>
            {isAdmin && <HeroButton primary onClick={onImport}>Import Site</HeroButton>}
          </>
        )}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'pages', label: 'Pages', count: pages.length },
          { id: 'sections', label: 'Sections', count: sectionCount },
        ]}
        activeTab={activeSection}
        onTabChange={onSectionChange}
        tabTrailing={<span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{activeSection === 'pages' ? `${pages.length} pages` : activeSection === 'sections' ? `${visibleSections.length} sections` : ''}</span>}
        bodyBackground={activeSection === 'overview' ? 'var(--color-background-surface)' : 'var(--color-background-body)'}
        bodyPadding={activeSection === 'overview' ? '24px 40px 80px' : '32px 40px 72px'}
      >
        {body}
      </ReferenceDetailShell>
      {lightbox && lightbox.items[lightbox.index] && (
        <Lightbox
          item={lightbox.items[lightbox.index]}
          index={lightbox.index}
          total={lightbox.items.length}
          onClose={() => setLightbox(null)}
          onNavigate={goLightbox}
        />
      )}
    </>
  );
}

function SiteOverview({ detail, pageCount, sectionCount }: { detail: SiteVersionDetail; pageCount: number; sectionCount: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(240px,.5fr)', gap: 28, alignItems: 'start' }}>
      <video src={detail.version.previewUrl} controls muted playsInline preload="metadata" style={{ display: 'block', width: '100%', borderRadius: 16, background: '#111', boxShadow: 'var(--shadow-low)' }} />
      <div style={{ display: 'grid', gap: 16, padding: 20, border: '1px solid var(--color-border)', borderRadius: 16, background: 'var(--color-background-surface)' }}>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Website</div><div style={{ marginTop: 4, fontWeight: 650, overflowWrap: 'anywhere' }}>{detail.site.sourceUrl}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Version</div><div style={{ marginTop: 4, fontWeight: 650 }}>{detail.version.label}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Captured reference</div><div style={{ marginTop: 4, fontWeight: 650 }}>{pageCount} pages · {sectionCount} sections</div></div>
      </div>
    </div>
  );
}

function PagesPanel({ pages, onOpen }: { pages: SitePage[]; onOpen: (index: number) => void }) {
  if (!pages.length) return <EmptyState title="No pages in this Site" description="The imported version did not contain a ready page." isCompact />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
      {pages.map((page, index) => (
        <MediaGridCard
          key={page.id}
          label={`Open ${page.title} page`}
          kind="image"
          url={page.fullPageImageUrl}
          aspectRatio="4 / 5"
          badges={[page.title, 'Full-page capture']}
          delay={Math.min(index * 0.04, 0.32)}
          onOpen={() => onOpen(index)}
        />
      ))}
    </div>
  );
}

interface SectionItem {
  page: SitePage;
  item: SiteSectionView;
  index: number;
}

function SectionsPanel({
  pages,
  visibleSections,
  pageFilter,
  mediaFilter,
  onPageFilterChange,
  onMediaFilterChange,
  onOpen,
}: {
  pages: SitePage[];
  visibleSections: SectionItem[];
  pageFilter: string;
  mediaFilter: string;
  onPageFilterChange: (value: string) => void;
  onMediaFilterChange: (value: string) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, paddingBottom: 20, flexWrap: 'wrap' }}>
        <Selector label="Page" size="sm" value={pageFilter} onChange={onPageFilterChange} options={['All pages', ...pages.map((page) => page.title)]} />
        <Selector label="Media" size="sm" value={mediaFilter} onChange={onMediaFilterChange} options={['All media', 'Images', 'Videos']} />
      </div>
      {visibleSections.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {visibleSections.map(({ page, item, index }, visibleIndex) => (
            <MediaGridCard
              key={item.id}
              label={`Open ${page.title} section ${index + 1}`}
              kind={item.mediaKind}
              url={item.mediaUrl}
              posterUrl={item.posterUrl}
              badges={sectionBadges(page, item, index)}
              delay={Math.min(visibleIndex * 0.04, 0.32)}
              onOpen={() => onOpen(visibleIndex)}
            />
          ))}
        </div>
      ) : <EmptyState title="No sections match these filters" description="Choose another page or media type." isCompact />}
    </>
  );
}

function sectionBadges(page: SitePage, section: SiteSectionView, index: number): string[] {
  const labels = [page.title, `Section ${index + 1}`];
  if (section.cropTop !== undefined && section.cropBottom !== undefined) labels.push(`Crop ${section.cropTop}–${section.cropBottom} px`);
  if (section.videoStartSeconds !== undefined && section.videoEndSeconds !== undefined) labels.push(`${section.videoStartSeconds}–${section.videoEndSeconds} seconds`);
  return labels;
}

interface SiteVersionPageProps {
  siteId: number;
  versionId: number;
  isAdmin: boolean;
  initialSection?: string;
  onSectionChange?: (section: SiteDetailSection) => void;
}

export function SiteVersionPage({ siteId, versionId, isAdmin, initialSection, onSectionChange }: SiteVersionPageProps) {
  const [detail, setDetail] = useState<SiteVersionDetail | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError('');
    getSiteVersion(siteId, versionId)
      .then((value) => { if (active) setDetail(value); })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [siteId, versionId, revision]);

  const onBack = () => navigate({ name: 'sites' });
  if (error && !detail) return <SiteVersionFailure message={error} onBack={onBack} onRetry={() => setRevision((value) => value + 1)} />;
  if (!detail) return <SiteVersionLoading onBack={onBack} />;
  return (
    <>
      <SiteVersionView
        detail={detail}
        isAdmin={isAdmin}
        section={initialSection}
        onSectionChange={onSectionChange ?? (() => undefined)}
        onBack={onBack}
        onImport={() => setImportOpen(true)}
      />
      {isAdmin && <SiteImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onExisting={(nextSiteId, nextVersionId) => navigate({ name: 'site-version', siteId: nextSiteId, versionId: nextVersionId })} />}
    </>
  );
}

function SiteVersionLoading({ onBack }: { onBack: () => void }) {
  return (
    <main role="status" aria-label="Loading Site version" style={{ maxWidth: 1360, margin: '0 auto', padding: '22px 40px 72px' }}>
      <Button variant="ghost" label="Back to all sites" clickAction={onBack} />
      <div style={{ display: 'grid', gap: 20, paddingTop: 28 }}>
        <Skeleton width={88} height={88} radius="rounded" />
        <Skeleton width={260} height={44} radius="none" />
        <div style={{ display: 'flex', gap: 18 }}><Skeleton width={120} height={42} radius="rounded" /><Skeleton width={120} height={42} radius="rounded" /></div>
        <Skeleton width="100%" height={2} radius="none" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} width="100%" height={220} radius="rounded" index={index} />)}
        </div>
      </div>
    </main>
  );
}

function SiteVersionFailure({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return (
    <main style={{ maxWidth: 1360, minHeight: '60vh', margin: '0 auto', padding: '22px 40px 72px' }}>
      <Button variant="ghost" label="Back to all sites" clickAction={onBack} />
      <div role="alert" style={{ paddingTop: 48 }}>
        <EmptyState title="Could not load Site version" description={message} actions={<Button variant="secondary" label="Retry" clickAction={onRetry} />} />
      </div>
    </main>
  );
}
