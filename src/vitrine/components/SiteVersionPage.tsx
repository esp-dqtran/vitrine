import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, DropdownMenu, EmptyState, Selector, Skeleton } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { getSiteVersion, listSitesPage } from '../sitesApi.ts';
import type {
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionPage as SitePage,
} from '../types.ts';
import { HeroButton } from './HeroButton.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { ReferenceDetailShell } from './ReferenceDetailShell.tsx';
import { SearchInput } from './SearchInput.tsx';
import { SiteAnalysisPanel } from './SiteAnalysisPanel.tsx';
import { SiteCard } from './SiteCard.tsx';
import { SiteSectionVideoCard } from './SiteSectionVideoCard.tsx';
import { SitesTopNav } from './SitesTopNav.tsx';
import {
  SiteSectionInspector,
  type SiteInspectorItem,
  type SiteInspectorView,
} from './SiteSectionInspector.tsx';

export type SiteDetailSection = 'preview' | 'sections' | 'technology';

function resolveSiteSection(value: string | undefined, isAdmin: boolean): SiteDetailSection {
  if (value === 'sections') return 'sections';
  if ((value === 'technology' || value === 'analysis') && isAdmin) return 'technology';
  return 'preview';
}

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
  section?: string;
  initialSectionQuery?: string;
  relatedSites?: SiteSummary[];
  onSectionChange: (section: SiteDetailSection) => void;
  onVersionChange: (versionId: number) => void;
  onBack: () => void;
  onRelatedOpen?: (site: SiteSummary) => void;
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

export function restoreInspectorFocus(
  trigger: { focus: () => void } | null,
  schedule: (callback: () => void) => void = (callback) => requestAnimationFrame(callback),
) {
  schedule(() => trigger?.focus());
}

export function SiteVersionView({
  detail,
  isAdmin,
  section,
  initialSectionQuery,
  relatedSites = [],
  onSectionChange,
  onVersionChange,
  onBack,
  onRelatedOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }),
}: SiteVersionViewProps) {
  const pages = useMemo(() => [...detail.pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => ({ ...page, sections: [...page.sections].sort((a, b) => a.position - b.position) })), [detail.pages]);
  const activeSection = resolveSiteSection(section, isAdmin);
  const sectionCount = pages.reduce((total, page) => total + page.sections.length, 0);
  const [sectionQuery, setSectionQuery] = useState(initialSectionQuery ?? '');
  const [patternFilter, setPatternFilter] = useState('All patterns');
  const [mediaFilter, setMediaFilter] = useState('All media');
  const [inspector, setInspector] = useState<SiteInspectorState>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<number>>(() => new Set());
  const [savedSectionIds, setSavedSectionIds] = useState<Set<number>>(() => new Set());

  const sectionItems: SectionItem[] = pages.flatMap((page) => page.sections.map((item, index) => ({
    page,
    item,
    index,
    patterns: item.patterns.length ? item.patterns : [page.title],
  })));
  const patternOptions = ['All patterns', ...new Set(sectionItems.flatMap((entry) => entry.patterns).sort())];
  const needle = sectionQuery.trim().toLowerCase();
  const visibleSections = sectionItems.filter(({ page, item, patterns }) => {
    const searchable = [
      page.title,
      page.url,
      ...patterns,
      item.searchText ?? item.ocrBoxes.map((box) => box.text).join(' '),
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
  const openInspector = (index: number) => {
    inspectorTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setInspector({ items: inspectorItems, index, view: 'section' });
  };
  const closeInspector = () => {
    setInspector(null);
    restoreInspectorFocus(inspectorTriggerRef.current);
    inspectorTriggerRef.current = null;
  };

  useEffect(() => {
    if (!inspector) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeInspector();
      else if (event.key === 'ArrowLeft') goInspector(inspector.index - 1);
      else if (event.key === 'ArrowRight') goInspector(inspector.index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspector]);

  const toggleSection = (id: number) => {
    setSelectedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const saveSelected = () => {
    setSavedSectionIds((current) => new Set([...current, ...selectedSectionIds]));
    setSelectedSectionIds(new Set());
  };
  const categories = detail.site.categories ?? [];
  const styles = detail.site.styles ?? [];
  const description = detail.site.description || `A captured website reference from ${safeHostname(detail.site.sourceUrl)}.`;
  const updatedAt = detail.versionOptions.find(({ id }) => id === detail.version.id)?.updatedAt;
  const formatUpdatedAt = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

  const body = activeSection === 'preview'
    ? <SitePreview detail={detail} sectionCount={sectionCount} />
    : activeSection === 'technology'
    ? <SiteAnalysisPanel detail={detail} />
    : (
      <SectionsPanel
        visibleSections={visibleSections}
        sectionQuery={sectionQuery}
        patternOptions={patternOptions}
        patternFilter={patternFilter}
        mediaFilter={mediaFilter}
        selectedSectionIds={selectedSectionIds}
        savedSectionIds={savedSectionIds}
        onSectionQueryChange={setSectionQuery}
        onPatternFilterChange={setPatternFilter}
        onMediaFilterChange={setMediaFilter}
        onToggleSelect={toggleSection}
        onClearSelection={() => setSelectedSectionIds(new Set())}
        onSaveSelected={saveSelected}
        onOpen={openInspector}
      />
    );
  const tabs = [
    { id: 'preview' as const, label: 'Preview' },
    { id: 'sections' as const, label: 'Sections' },
    ...(isAdmin ? [{ id: 'technology' as const, label: 'Technology' }] : []),
  ];
  const metadata = [
    ...(categories.length ? [{
      label: 'Category',
      value: categories.join(', '),
      content: (
        <div className="site-detail__meta-links">
          {categories.map((category, index) => (
            <a key={`category:${category}`} href="/sites" onClick={(event) => { event.preventDefault(); navigate({ name: 'sites' }); }}>
              {category}{index < categories.length - 1 ? ',' : ''}
            </a>
          ))}
        </div>
      ),
    }] : []),
    ...(styles.length ? [{
      label: 'Style',
      value: styles.join(', '),
      content: (
        <div className="site-detail__meta-links">
          {styles.map((style, index) => (
            <a key={`style:${style}`} href="/sites" onClick={(event) => { event.preventDefault(); navigate({ name: 'sites' }); }}>
              {style}{index < styles.length - 1 ? ',' : ''}
            </a>
          ))}
        </div>
      ),
    }] : []),
    { label: 'Pages', value: String(pages.length) },
    { label: 'Sections', value: String(sectionCount) },
    ...(updatedAt ? [{ label: 'Last updated', value: formatUpdatedAt(updatedAt) }] : []),
  ];
  const versionMenu = (
    <DropdownMenu
      button={{ label: detail.version.isLatest ? 'Latest' : detail.version.label, size: 'sm', variant: 'ghost' }}
      hasChevron
      items={detail.versionOptions.map((version) => ({
        label: version.isLatest ? 'Latest' : version.label,
        onClick: () => onVersionChange(version.id),
      }))}
    />
  );

  return (
    <>
      <ReferenceDetailShell
        dataDetailKind="site"
        className="site-detail"
        title={detail.site.name}
        description={description}
        identityKey={`site-icon-${detail.site.id}`}
        identityLabel={detail.site.name.slice(0, 1).toUpperCase()}
        identityImageUrl={detail.site.logoUrl}
        onBack={onBack}
        metadata={metadata}
        actions={(
          <>
            <HeroButton primary onClick={() => setSaved((value) => !value)}>{saved ? 'Saved' : 'Save'}</HeroButton>
            <HeroButton onClick={() => window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>
          </>
        )}
        tabLeading={versionMenu}
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={onSectionChange}
        bodyPadding={activeSection === 'sections' ? '32px 32px 120px' : '0 32px 120px'}
      >
        <div className={`site-detail__content site-detail__content--${activeSection}`}>
          {body}
          {relatedSites.length ? (
            <section className="site-detail__related" aria-labelledby="related-sites-title">
              <div>
                <p>Continue exploring</p>
                <h2 id="related-sites-title">More website references</h2>
              </div>
              <div className="site-detail__related-grid">
                {relatedSites.slice(0, 3).map((site) => (
                  <SiteCard
                    key={`${site.id}:${site.versionId}`}
                    site={site}
                    onOpen={() => onRelatedOpen(site)}
                    deferMediaUntilIntent
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ReferenceDetailShell>
      {inspector && inspector.items[inspector.index] && (
        <SiteSectionInspector
          item={inspector.items[inspector.index]}
          index={inspector.index}
          total={inspector.items.length}
          view={inspector.view}
          onViewChange={(view) => setInspector((current) => current ? { ...current, view } : current)}
          onClose={closeInspector}
          onNavigate={goInspector}
        />
      )}
    </>
  );
}

function SitePreview({ detail, sectionCount }: { detail: SiteVersionDetail; sectionCount: number }) {
  void sectionCount;
  return (
    <section className="site-preview">
      <div data-site-preview-stage="true" className="site-preview__stage">
        {detail.version.previewMediaKind === 'image'
          ? <img src={detail.version.previewUrl} alt={`${detail.site.name} website preview`} />
          : (
              <video
                src={detail.version.previewUrl}
                controls
                muted
                playsInline
                preload="metadata"
              />
            )}
      </div>
    </section>
  );
}

function SectionsPanel({
  visibleSections,
  sectionQuery,
  patternOptions,
  patternFilter,
  mediaFilter,
  selectedSectionIds,
  savedSectionIds,
  onSectionQueryChange,
  onPatternFilterChange,
  onMediaFilterChange,
  onToggleSelect,
  onClearSelection,
  onSaveSelected,
  onOpen,
}: {
  visibleSections: SectionItem[];
  sectionQuery: string;
  patternOptions: string[];
  patternFilter: string;
  mediaFilter: string;
  selectedSectionIds: Set<number>;
  savedSectionIds: Set<number>;
  onSectionQueryChange: (value: string) => void;
  onPatternFilterChange: (value: string) => void;
  onMediaFilterChange: (value: string) => void;
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onSaveSelected: () => void;
  onOpen: (index: number) => void;
}) {
  return (
    <section className="site-sections">
      <div className="site-sections__toolbar">
        <div className="site-sections__search">
          <SearchInput value={sectionQuery} onChange={onSectionQueryChange} placeholder="Search sections…" />
        </div>
        <Selector label="Pattern" size="sm" value={patternFilter} onChange={onPatternFilterChange} options={patternOptions} />
        <Selector label="Media" size="sm" value={mediaFilter} onChange={onMediaFilterChange} options={['All media', 'Images', 'Videos']} />
        <span>{visibleSections.length} sections</span>
      </div>
      {visibleSections.length ? (
        <div data-site-sections-grid="true" className="site-sections__grid">
          {visibleSections.map(({ page, item, patterns }, visibleIndex) => {
            const label = `Open ${patterns[0]} from ${page.title}`;
            const selected = selectedSectionIds.has(item.id);
            const saved = savedSectionIds.has(item.id);
            const delay = Math.min(visibleIndex * 0.04, 0.32);
            return (
              <article key={item.id} className="site-section-tile">
                <div className="site-section-tile__media">
                  {item.mediaKind === 'video' ? (
                    <SiteSectionVideoCard
                      label={label}
                      url={item.mediaUrl}
                      posterUrl={item.posterUrl}
                      delay={delay}
                      deferMedia
                      onOpen={() => onOpen(visibleIndex)}
                    />
                  ) : (
                    <MediaGridCard
                      label={label}
                      kind="image"
                      url={item.mediaUrl}
                      imageFit="contain"
                      delay={delay}
                      deferMedia
                      onOpen={() => onOpen(visibleIndex)}
                    />
                  )}
                  <Button
                    label={selected ? 'Selected' : 'Select'}
                    variant="ghost"
                    size="sm"
                    className="site-section-tile__select"
                    aria-label={`${selected ? 'Deselect' : 'Select'} ${patterns[0]} from ${page.title}`}
                    aria-pressed={selected}
                    onClick={() => onToggleSelect(item.id)}
                  />
                </div>
                <div className="site-section-tile__caption">
                  <strong>{patterns[0]}</strong>
                  <span>{page.title} · {item.mediaKind === 'image' ? 'Image' : 'Video'}{saved ? ' · Saved' : ''}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState title="No sections match these filters" description="Try another keyword, pattern, or media type." isCompact />}
      <div className="site-sections__selection" aria-live="polite">
        <strong>{selectedSectionIds.size} selected</strong>
        <div>
          {selectedSectionIds.size ? <Button label="Clear" variant="ghost" size="sm" onClick={onClearSelection} /> : null}
          <Button label="Save selected" size="sm" isDisabled={!selectedSectionIds.size} onClick={onSaveSelected} />
        </div>
      </div>
    </section>
  );
}

interface SiteVersionPageProps {
  siteId: number;
  versionId: number;
  isAdmin: boolean;
  initialSection?: string;
  onSectionChange?: (section: SiteDetailSection) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  accountControls?: ReactNode;
}

export function SiteVersionPage({
  siteId,
  versionId,
  isAdmin,
  initialSection,
  onSectionChange,
  query = '',
  onQueryChange = () => undefined,
  accountControls,
}: SiteVersionPageProps) {
  const [detail, setDetail] = useState<SiteVersionDetail | null>(null);
  const [relatedSites, setRelatedSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError('');
    void Promise.all([
      getSiteVersion(siteId, versionId),
      listSitesPage(4, 0).then(({ sites }) => sites).catch(() => []),
    ])
      .then(([value, sites]) => {
        if (!active) return;
        setDetail(value);
        setRelatedSites(sites.filter((site) => site.id !== siteId));
      })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [siteId, versionId, revision]);

  const onBack = () => navigate({ name: 'sites' });
  const topNav = (
    <SitesTopNav
      searchLabel={query || 'Search on Web...'}
      activeCategory={null}
      onClearCategory={() => undefined}
      onOpenSearch={() => undefined}
      searchMode="legacy"
      accountControls={accountControls}
    />
  );
  if (error && !detail) return <>{topNav}<SiteVersionFailure message={error} onBack={onBack} onRetry={() => setRevision((value) => value + 1)} /></>;
  if (!detail) return <>{topNav}<SiteVersionLoading onBack={onBack} /></>;
  return (
    <>
      {topNav}
      <SiteVersionView
        detail={detail}
        relatedSites={relatedSites}
        isAdmin={isAdmin}
        section={initialSection}
        onSectionChange={onSectionChange ?? (() => undefined)}
        onVersionChange={(nextVersionId) => navigate({ name: 'site-version', siteId, versionId: nextVersionId })}
        onBack={onBack}
      />
    </>
  );
}

function SiteVersionLoading({ onBack }: { onBack: () => void }) {
  return (
    <main role="status" aria-label="Loading Site version" className="vitrine-page site-detail site-detail--loading">
      <Button variant="ghost" label="Back to Sites" clickAction={onBack} />
      <div>
        <Skeleton width={88} height={88} radius="rounded" />
        <Skeleton width={260} height={44} radius="none" />
        <Skeleton width="100%" height={540} radius="rounded" />
      </div>
    </main>
  );
}

function SiteVersionFailure({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return (
    <main className="vitrine-page site-detail site-detail--failure">
      <Button variant="ghost" label="Back to Sites" clickAction={onBack} />
      <div role="alert">
        <EmptyState title="Could not load Site version" description={message} actions={<Button variant="secondary" label="Retry" clickAction={onRetry} />} />
      </div>
    </main>
  );
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
