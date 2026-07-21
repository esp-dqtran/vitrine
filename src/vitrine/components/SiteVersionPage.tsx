import { useEffect, useMemo, useState } from 'react';
import { Button, DropdownMenu, EmptyState, Selector, Skeleton } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { getSiteVersion } from '../sitesApi.ts';
import type { SiteSectionView, SiteVersionDetail, SiteVersionPage as SitePage } from '../types.ts';
import { HeroButton } from './HeroButton.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { ReferenceDetailShell } from './ReferenceDetailShell.tsx';
import { SearchInput } from './SearchInput.tsx';
import { SiteImportDialog } from './SiteImportDialog.tsx';
import {
  SiteSectionInspector,
  type SiteInspectorItem,
  type SiteInspectorView,
} from './SiteSectionInspector.tsx';

export type SiteDetailSection = 'preview' | 'sections';

function resolveSiteSection(value?: string): SiteDetailSection {
  return value === 'sections' ? 'sections' : 'preview';
}

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
  section?: string;
  initialSectionQuery?: string;
  onSectionChange: (section: SiteDetailSection) => void;
  onVersionChange: (versionId: number) => void;
  onBack: () => void;
  onImport: () => void;
}

interface SectionItem {
  page: SitePage;
  item: SiteSectionView;
  index: number;
  patterns: string[];
}

type SiteInspectorState = {
  items: SiteInspectorItem[];
  index: number;
  view: SiteInspectorView;
} | null;

export function SiteVersionView({
  detail,
  isAdmin,
  section,
  initialSectionQuery,
  onSectionChange,
  onVersionChange,
  onBack,
  onImport,
}: SiteVersionViewProps) {
  const pages = useMemo(() => [...detail.pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => ({ ...page, sections: [...page.sections].sort((a, b) => a.position - b.position) })), [detail.pages]);
  const activeSection = resolveSiteSection(section);
  const sectionCount = pages.reduce((total, page) => total + page.sections.length, 0);
  const [sectionQuery, setSectionQuery] = useState(initialSectionQuery ?? '');
  const [patternFilter, setPatternFilter] = useState('All patterns');
  const [mediaFilter, setMediaFilter] = useState('All media');
  const [inspector, setInspector] = useState<SiteInspectorState>(null);

  const sectionItems: SectionItem[] = pages.flatMap((page) => page.sections.map((item, index) => ({
    page,
    item,
    index,
    patterns: item.patterns.length ? item.patterns : ['Unclassified'],
  })));
  const patternOptions = ['All patterns', ...new Set(sectionItems.flatMap((entry) => entry.patterns).sort())];
  const needle = sectionQuery.trim().toLowerCase();
  const visibleSections = sectionItems.filter(({ page, item, patterns }) => {
    const searchable = [
      page.title,
      page.url,
      ...patterns,
      ...item.ocrBoxes.map((box) => box.text),
    ].join(' ').toLowerCase();
    return (!needle || searchable.includes(needle))
      && (patternFilter === 'All patterns' || patterns.includes(patternFilter))
      && (mediaFilter === 'All media'
        || (mediaFilter === 'Images' ? item.mediaKind === 'image' : item.mediaKind === 'video'));
  });
  const inspectorItems: SiteInspectorItem[] = visibleSections.map(({ page, item, index, patterns }) => ({
    id: item.id,
    kind: item.mediaKind,
    sectionUrl: item.mediaUrl,
    posterUrl: item.posterUrl,
    fullPageUrl: page.fullPageImageUrl,
    pageTitle: page.title,
    pageUrl: page.url,
    patterns,
    caption: `${page.title} · Section ${index + 1}`,
  }));

  const goInspector = (index: number) => {
    setInspector((current) => current && current.items.length
      ? { ...current, index: ((index % current.items.length) + current.items.length) % current.items.length }
      : current);
  };

  useEffect(() => {
    if (!inspector) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspector(null);
      else if (event.key === 'ArrowLeft') goInspector(inspector.index - 1);
      else if (event.key === 'ArrowRight') goInspector(inspector.index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspector]);

  const body = activeSection === 'preview'
    ? <SitePreview detail={detail} sectionCount={sectionCount} />
    : (
      <SectionsPanel
        visibleSections={visibleSections}
        sectionQuery={sectionQuery}
        patternOptions={patternOptions}
        patternFilter={patternFilter}
        mediaFilter={mediaFilter}
        onSectionQueryChange={setSectionQuery}
        onPatternFilterChange={setPatternFilter}
        onMediaFilterChange={setMediaFilter}
        onOpen={(index) => setInspector({ items: inspectorItems, index, view: 'section' })}
      />
    );

  return (
    <>
      <ReferenceDetailShell
        title={detail.site.name}
        identityKey={`site-icon-${detail.site.id}`}
        identityLabel={detail.site.name[0] ?? 'S'}
        backLabel="Back to Sites"
        onBack={onBack}
        heroControls={(
          <DropdownMenu
            button={{ label: `${detail.version.label}${detail.version.isLatest ? ' · Latest' : ''}`, size: 'sm', variant: 'ghost' }}
            hasChevron
            items={detail.versionOptions.map((version) => ({
              label: `${version.label}${version.isLatest ? ' · Latest' : ''}`,
              onClick: () => onVersionChange(version.id),
            }))}
          />
        )}
        metadata={[{ label: 'Sections', value: String(sectionCount) }]}
        actions={(
          <>
            <HeroButton onClick={() => window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>
            {isAdmin && <HeroButton primary onClick={onImport}>Import Site</HeroButton>}
          </>
        )}
        tabs={[
          { id: 'preview', label: 'Preview' },
          { id: 'sections', label: 'Sections', count: sectionCount },
        ]}
        activeTab={activeSection}
        onTabChange={onSectionChange}
        tabTrailing={activeSection === 'sections'
          ? <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{visibleSections.length} sections</span>
          : undefined}
        bodyBackground={activeSection === 'preview' ? 'var(--color-background-surface)' : 'var(--color-background-body)'}
        bodyPadding={activeSection === 'preview' ? '24px 40px 80px' : '32px 40px 72px'}
      >
        {body}
      </ReferenceDetailShell>
      {inspector && inspector.items[inspector.index] && (
        <SiteSectionInspector
          item={inspector.items[inspector.index]}
          index={inspector.index}
          total={inspector.items.length}
          view={inspector.view}
          onViewChange={(view) => setInspector((current) => current ? { ...current, view } : current)}
          onClose={() => setInspector(null)}
          onNavigate={goInspector}
        />
      )}
    </>
  );
}

function SitePreview({ detail, sectionCount }: { detail: SiteVersionDetail; sectionCount: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(240px,.5fr)', gap: 28, alignItems: 'start' }}>
      <video src={detail.version.previewUrl} controls muted playsInline preload="metadata" style={{ display: 'block', width: '100%', borderRadius: 16, background: '#111', boxShadow: 'var(--shadow-low)' }} />
      <div style={{ display: 'grid', gap: 16, padding: 20, border: '1px solid var(--color-border)', borderRadius: 16, background: 'var(--color-background-surface)' }}>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Website</div><div style={{ marginTop: 4, fontWeight: 650, overflowWrap: 'anywhere' }}>{detail.site.sourceUrl}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Version</div><div style={{ marginTop: 4, fontWeight: 650 }}>{detail.version.label}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Captured reference</div><div style={{ marginTop: 4, fontWeight: 650 }}>{sectionCount} reusable sections</div></div>
      </div>
    </div>
  );
}

function SectionsPanel({
  visibleSections,
  sectionQuery,
  patternOptions,
  patternFilter,
  mediaFilter,
  onSectionQueryChange,
  onPatternFilterChange,
  onMediaFilterChange,
  onOpen,
}: {
  visibleSections: SectionItem[];
  sectionQuery: string;
  patternOptions: string[];
  patternFilter: string;
  mediaFilter: string;
  onSectionQueryChange: (value: string) => void;
  onPatternFilterChange: (value: string) => void;
  onMediaFilterChange: (value: string) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'end', gap: 8, paddingBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
          <SearchInput value={sectionQuery} onChange={onSectionQueryChange} placeholder="Search sections…" />
        </div>
        <Selector label="Pattern" size="sm" value={patternFilter} onChange={onPatternFilterChange} options={patternOptions} />
        <Selector label="Media" size="sm" value={mediaFilter} onChange={onMediaFilterChange} options={['All media', 'Images', 'Videos']} />
      </div>
      {visibleSections.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {visibleSections.map(({ page, item, index, patterns }, visibleIndex) => (
            <MediaGridCard
              key={item.id}
              label={`Open ${patterns[0]} from ${page.title}`}
              kind={item.mediaKind}
              url={item.mediaUrl}
              posterUrl={item.posterUrl}
              badges={[...patterns.slice(0, 2), item.mediaKind === 'image' ? 'Image' : 'Video']}
              delay={Math.min(visibleIndex * 0.04, 0.32)}
              onOpen={() => onOpen(visibleIndex)}
            />
          ))}
        </div>
      ) : <EmptyState title="No sections match these filters" description="Try another keyword, pattern, or media type." isCompact />}
    </>
  );
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
        onVersionChange={(nextVersionId) => navigate({ name: 'site-version', siteId, versionId: nextVersionId })}
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
      <Button variant="ghost" label="Back to Sites" clickAction={onBack} />
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
      <Button variant="ghost" label="Back to Sites" clickAction={onBack} />
      <div role="alert" style={{ paddingTop: 48 }}>
        <EmptyState title="Could not load Site version" description={message} actions={<Button variant="secondary" label="Retry" clickAction={onRetry} />} />
      </div>
    </main>
  );
}
