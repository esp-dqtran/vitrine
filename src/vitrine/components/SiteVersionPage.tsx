import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, EmptyState, Icon, IconButton, Selector } from '@astryxdesign/core';
import { navigate, routeToPath, updateLocation } from '../router.ts';
import { getSiteVersion, getSiteVersionBySlug, listSitesPage } from '../sitesApi.ts';
import { useSlidingIndicator } from '../useSlidingIndicator.ts';
import type {
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionOption,
  SiteVersionPage as SitePage,
} from '../types.ts';
import { HeroButton } from './HeroButton.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { AstryxDropdown, AstryxDropdownItem } from './AstryxDropdown.tsx';
import {
  ReferenceDetailNavigation,
  ReferenceDetailPage,
} from './ReferenceDetailPage.tsx';
import { ReferenceDetailLoading } from './ReferenceDetailLoading.tsx';
import { SearchInput } from './SearchInput.tsx';
import { SiteAnalysisPanel } from './SiteAnalysisPanel.tsx';
import { SiteCard } from './SiteCard.tsx';
import { SiteSectionVideoCard } from './SiteSectionVideoCard.tsx';
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

export function formatSiteVersionDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('month')} ${part('day')}, ${part('year')} · ${part('hour')}:${part('minute')} ${part('dayPeriod')}`;
}

export function SiteVersionPicker({
  versions,
  selectedVersionId,
  onChange,
}: {
  versions: SiteVersionOption[];
  selectedVersionId: number;
  onChange: (versionId: number) => void;
}) {
  return (
    <Selector
      label="Site version"
      isLabelHidden
      size="sm"
      placement="below"
      className="reference-detail__version-selector"
      value={String(selectedVersionId)}
      options={versions.map((version) => ({
        value: String(version.id),
        label: version.isLatest
          ? 'Latest'
          : formatSiteVersionDateTime(version.updatedAt),
      }))}
      onChange={(value) => {
        const versionId = Number(value);
        if (Number.isSafeInteger(versionId) && versionId !== selectedVersionId) {
          onChange(versionId);
        }
      }}
    />
  );
}

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
  searchLabel?: string;
  accountControls?: ReactNode;
  onOpenSearch?: () => void;
  section?: string;
  initialSectionId?: number;
  relatedSites?: SiteSummary[];
  onSectionChange: (section: SiteDetailSection) => void;
  onInspectorChange?: (sectionId: number | null) => void;
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

function sectionType({ page, patterns }: SectionItem) {
  return patterns.find((pattern) => /\bsection$/i.test(pattern.trim()))
    ?? patterns[0]
    ?? page.title;
}

function sectionTypeLabel(value: string) {
  return value.replace(/\s+section$/i, '').trim() || value;
}

function sectionDisplayPriority(section: SectionItem) {
  const type = sectionTypeLabel(sectionType(section)).toLocaleLowerCase();
  if (type === 'hero') return 0;
  if (type === 'navigation') return 2;
  if (type === 'footer') return 3;
  return 1;
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
  searchLabel = 'Search on Web...',
  accountControls,
  onOpenSearch,
  section,
  initialSectionId,
  relatedSites = [],
  onSectionChange,
  onInspectorChange = () => undefined,
  onVersionChange,
  onBack,
  onRelatedOpen = (site) => navigate({ name: 'site-version', siteSlug: site.routeSlug }),
}: SiteVersionViewProps) {
  const pages = useMemo(() => [...detail.pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => ({ ...page, sections: [...page.sections].sort((a, b) => a.position - b.position) })), [detail.pages]);
  const activeSection = resolveSiteSection(section, isAdmin);
  const sectionCount = pages.reduce((total, page) => total + page.sections.length, 0);
  const [inspector, setInspector] = useState<SiteInspectorState>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  const sectionItems: SectionItem[] = useMemo(
    () => pages.flatMap((page) => page.sections.map((item, index) => ({
      page,
      item,
      index,
      patterns: item.patterns.length ? item.patterns : [page.title],
    }))),
    [pages],
  );
  const inspectorItems: SiteInspectorItem[] = useMemo(
    () => sectionItems.map(({ page, item, index, patterns }) => ({
      id: item.id,
      kind: item.mediaKind,
      sectionUrl: item.mediaUrl,
      posterUrl: item.posterUrl,
      fullPageUrl: page.fullPageImageUrl,
      pageTitle: page.title,
      pageUrl: page.url,
      siteName: detail.site.name,
      siteLogoUrl: detail.site.logoUrl,
      patterns,
      caption: `${page.title} · Section ${index + 1}`,
      metadata: item.sourceMetadata,
    })),
    [detail.site.logoUrl, detail.site.name, sectionItems],
  );

  const goInspector = (index: number) => {
    setInspector((current) => {
      if (!current?.items.length) return current;
      const nextIndex = ((index % current.items.length) + current.items.length) % current.items.length;
      onInspectorChange(current.items[nextIndex]?.id ?? null);
      return { ...current, index: nextIndex };
    });
  };
  const openInspector = (index: number) => {
    inspectorTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setInspector({ items: inspectorItems, index, view: 'section' });
    onInspectorChange(inspectorItems[index]?.id ?? null);
  };
  const closeInspector = () => {
    setInspector(null);
    onInspectorChange(null);
    restoreInspectorFocus(inspectorTriggerRef.current);
    inspectorTriggerRef.current = null;
  };

  useEffect(() => {
    if (!initialSectionId || !inspectorItems.length) return;
    const index = inspectorItems.findIndex(({ id }) => id === initialSectionId);
    if (index < 0) return;
    setInspector((current) => current?.items[current.index]?.id === initialSectionId
      ? current
      : { items: inspectorItems, index, view: current?.view ?? 'section' });
  }, [initialSectionId, inspectorItems]);

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

  const categories = detail.site.categories ?? [];
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
        sections={sectionItems}
        onOpen={openInspector}
      />
    );
  const tabs = [
    { id: 'preview' as const, label: 'Preview' },
    { id: 'sections' as const, label: 'Sections' },
    ...(isAdmin ? [{ id: 'technology' as const, label: 'Technology' }] : []),
  ];
  const metadata = [
    { label: 'Platform', value: 'Web' },
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
    { label: 'Sections', value: String(sectionCount) },
    ...(updatedAt ? [{ label: 'Last updated', value: formatUpdatedAt(updatedAt) }] : []),
  ];
  const sectionTotal = activeSection === 'preview'
    ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`
    : activeSection === 'sections'
      ? `${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'}`
      : `${detail.analysis?.technology?.length ?? 0} technologies`;
  return (
    <>
      <ReferenceDetailPage
        kind="site"
        searchLabel={searchLabel}
        accountControls={accountControls}
        onOpenSearch={onOpenSearch}
        className="site-detail"
        title={detail.site.name}
        identityKey={`site-icon-${detail.site.id}`}
        identityLabel={detail.site.name.slice(0, 1).toUpperCase()}
        identityImageUrl={detail.site.logoUrl}
        onBack={onBack}
        metadata={metadata}
        actions={<HeroButton primary onClick={() => window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')}>Visit Site</HeroButton>}
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={onSectionChange}
        tabLeading={detail.versionOptions.length > 1 ? (
          <SiteVersionPicker
            versions={detail.versionOptions}
            selectedVersionId={detail.version.id}
            onChange={onVersionChange}
          />
        ) : undefined}
        tabTrailing={activeSection === 'sections' ? undefined : (
          <span className="reference-detail__section-total">
            <span>Showing</span>
            <strong>{sectionTotal}</strong>
          </span>
        )}
        bodyPadding={activeSection === 'sections' ? '32px 32px 120px' : '0 32px 120px'}
      >
        <div className={`site-detail__content site-detail__content--${activeSection}`}>
          {body}
          {relatedSites.length ? (
            <section className="site-detail__related" aria-labelledby="related-sites-title">
              <div>
                <h2 id="related-sites-title">More like {detail.site.name}</h2>
              </div>
              <div className="site-detail__related-grid">
                {relatedSites.slice(0, 6).map((site) => (
                  <SiteCard
                    key={`${site.id}:${site.versionId}`}
                    site={site}
                    onOpen={() => onRelatedOpen(site)}
                    showMetadata={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ReferenceDetailPage>
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = detail.version.previewMediaKind !== 'image';
  const fullPageImageUrl = detail.pages[0]?.fullPageImageUrl;
  const [activeMode, setActiveMode] = useState<'video' | 'full-screen'>(
    isVideo ? 'video' : 'full-screen',
  );
  const {
    indicatorRef: modeIndicatorRef,
    registerItem: registerMode,
  } = useSlidingIndicator(activeMode);
  const playPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  };
  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <section className="site-preview">
      <div
        data-site-preview-stage="true"
        className="site-preview__stage"
      >
        <article className="site-preview-player">
          <header className="flow-preview-dialog__header site-preview-player__header">
            <div className="flow-preview-dialog__identity">
              <h2>{detail.site.name}</h2>
            </div>

            <div
              className="flow-preview-dialog__modes"
              role="tablist"
              aria-label="Site preview mode"
              data-active-mode={activeMode}
            >
              <span
                ref={modeIndicatorRef}
                className="flow-preview-dialog__mode-indicator"
                aria-hidden="true"
              />
              <Button
                ref={registerMode('video')}
                label="Video"
                variant="ghost"
                role="tab"
                aria-label="Video"
                aria-selected={activeMode === 'video'}
                disabled={!isVideo}
                onClick={() => setActiveMode('video')}
              />
              <Button
                ref={registerMode('full-screen')}
                label="Full screen"
                variant="ghost"
                role="tab"
                aria-label="Full screen"
                aria-selected={activeMode === 'full-screen'}
                disabled={!fullPageImageUrl}
                onClick={() => {
                  stopPreview();
                  setActiveMode('full-screen');
                }}
              />
            </div>

            <span
              className="flow-preview-dialog__header-actions site-preview-player__header-spacer"
              aria-hidden="true"
            />
          </header>

          <div
            className={`site-preview-player__body site-preview-player__body--${activeMode}`}
            role="tabpanel"
            aria-label={activeMode === 'video' ? 'Site preview video' : 'Full page preview'}
          >
            {activeMode === 'video' && isVideo ? (
              <div
                className="site-preview-player__video"
                tabIndex={0}
                aria-label={`${detail.site.name} website video; plays on hover or focus`}
                onMouseEnter={playPreview}
                onMouseLeave={stopPreview}
                onFocus={playPreview}
                onBlur={stopPreview}
              >
                <video
                  ref={videoRef}
                  data-site-preview-video="true"
                  src={detail.version.previewUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : fullPageImageUrl ? (
              <img
                src={fullPageImageUrl}
                alt={`${detail.site.name} full page preview`}
              />
            ) : (
              <img
                src={detail.version.previewUrl}
                alt={`${detail.site.name} website preview`}
              />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function SectionsPanel({
  sections,
  onOpen,
}: {
  sections: SectionItem[];
  onOpen: (index: number) => void;
}) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sectionTypes = useMemo(
    () => [...new Set(sections.map(sectionType))],
    [sections],
  );
  const indexedSections = useMemo(
    () => sections
      .map((section, inspectorIndex) => ({ section, inspectorIndex }))
      .sort((left, right) => (
        sectionDisplayPriority(left.section) - sectionDisplayPriority(right.section)
        || left.inspectorIndex - right.inspectorIndex
      )),
    [sections],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSections = indexedSections.filter(({ section }) => {
    if (selectedType !== 'all' && sectionType(section) !== selectedType) return false;
    if (!normalizedQuery) return true;
    const heading = typeof section.item.sourceMetadata.heading === 'string'
      ? section.item.sourceMetadata.heading
      : '';
    return [
      section.page.title,
      heading,
      ...section.patterns,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const countLabel = selectedType === 'all' && !normalizedQuery
    ? `${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`
    : `${visibleSections.length} of ${sections.length} sections`;

  return (
    <section className="site-sections">
      <header className="site-sections__toolbar">
        <div className="site-sections__controls">
          <AstryxDropdown
            label={selectedType === 'all' ? 'Sections' : sectionTypeLabel(selectedType)}
            ariaLabel="Filter sections by type"
            open={typeMenuOpen}
            triggerClassName="site-sections__type-trigger"
            menuWidth={220}
            onOpenChange={setTypeMenuOpen}
          >
            <AstryxDropdownItem
              label="All sections"
              selected={selectedType === 'all'}
              onSelect={() => {
                setSelectedType('all');
                setTypeMenuOpen(false);
              }}
            />
            {sectionTypes.map((type) => (
              <AstryxDropdownItem
                key={type}
                label={sectionTypeLabel(type)}
                selected={selectedType === type}
                onSelect={() => {
                  setSelectedType(type);
                  setTypeMenuOpen(false);
                }}
              />
            ))}
          </AstryxDropdown>
          <IconButton
            label="Search sections"
            icon={<Icon icon="search" size="sm" />}
            variant="ghost"
            size="sm"
            className="site-sections__search-toggle"
            aria-pressed={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open);
              if (searchOpen) setQuery('');
            }}
          />
        </div>
        <span className="site-sections__count" aria-live="polite">{countLabel}</span>
      </header>
      {searchOpen ? (
        <div className="site-sections__search">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search sections..."
          />
        </div>
      ) : null}
      {visibleSections.length ? (
        <ol data-site-sections-grid="true" className="site-sections__grid">
          {visibleSections.map(({ section: { page, item, patterns }, inspectorIndex }, visibleIndex) => {
            const heading = typeof item.sourceMetadata.heading === 'string'
              ? item.sourceMetadata.heading.trim()
              : '';
            const sectionName = sectionType({ page, item, patterns, index: visibleIndex });
            const sectionLabel = sectionTypeLabel(sectionName);
            const cardTitle = heading || sectionLabel || page.title;
            const label = `Open ${cardTitle} from ${page.title}`;
            const delay = Math.min(visibleIndex * 0.04, 0.32);
            return (
              <li key={item.id} className="site-section-tile">
                <div className="site-section-tile__media">
                  {item.mediaKind === 'video' ? (
                    <SiteSectionVideoCard
                      label={label}
                      url={item.mediaUrl}
                      posterUrl={item.posterUrl}
                      delay={delay}
                      deferMedia
                      onOpen={() => onOpen(inspectorIndex)}
                    />
                  ) : (
                    <MediaGridCard
                      label={label}
                      kind="image"
                      url={item.mediaUrl}
                      imageFit="contain"
                      preserveNaturalAspectRatio
                      delay={delay}
                      deferMedia
                      onOpen={() => onOpen(inspectorIndex)}
                    />
                  )}
                </div>
                <span className="site-section-tile__label">
                  <strong>{cardTitle}</strong>
                  <small>{heading ? `${sectionLabel} · ` : ''}{page.title}</small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title={sections.length ? 'No matching sections' : 'No sections available'}
          description={sections.length
            ? 'Try another section type or search.'
            : 'This Site capture does not contain any sections.'}
          isCompact
        />
      )}
    </section>
  );
}

type SiteVersionReference =
  | { siteSlug: string; selectedVersionId?: number; siteId?: never; versionId?: never }
  | { siteSlug?: never; siteId: number; versionId: number };

type SiteVersionPageProps = SiteVersionReference & {
  isAdmin: boolean;
  initialSection?: string;
  initialSectionId?: number;
  onSectionChange?: (section: SiteDetailSection) => void;
  onInspectorChange?: (sectionId: number | null) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  accountControls?: ReactNode;
};

export function SiteVersionPage(props: SiteVersionPageProps) {
  const {
    isAdmin,
    initialSection,
    initialSectionId,
    onSectionChange,
    onInspectorChange,
    query = '',
    onQueryChange = () => undefined,
    accountControls,
  } = props;
  const siteSlug = 'siteSlug' in props ? props.siteSlug : undefined;
  const siteId = 'siteId' in props ? props.siteId : undefined;
  const versionId = 'versionId' in props ? props.versionId : undefined;
  const selectedVersionId = 'siteSlug' in props ? props.selectedVersionId : undefined;
  const [detail, setDetail] = useState<SiteVersionDetail | null>(null);
  const [relatedSites, setRelatedSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError('');
    void Promise.all([
      siteSlug
        ? getSiteVersionBySlug(siteSlug, selectedVersionId)
        : getSiteVersion(siteId as number, versionId as number),
      listSitesPage(7, 0).then(({ sites }) => sites).catch(() => []),
    ])
      .then(([value, sites]) => {
        if (!active) return;
        setDetail(value);
        setRelatedSites(sites.filter((site) => site.id !== value.site.id));
      })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [selectedVersionId, siteId, siteSlug, versionId, revision]);
  useEffect(() => {
    if (!detail || siteSlug === detail.routeSlug) return;
    updateLocation(routeToPath({
      name: 'site-version',
      siteSlug: detail.routeSlug,
      ...('siteSlug' in props && selectedVersionId ? { version: selectedVersionId } : {}),
      ...(initialSection ? { section: initialSection } : {}),
      ...(initialSectionId ? { sectionId: initialSectionId } : {}),
    }), { replace: true });
  }, [detail, initialSection, initialSectionId, selectedVersionId, siteSlug]);

  const onBack = () => navigate({ name: 'sites' });
  const navigation = (
    <ReferenceDetailNavigation
      kind="site"
      searchLabel={query || 'Search on Web...'}
      accountControls={accountControls}
    />
  );
  if (error && !detail) return <>{navigation}<SiteVersionFailure message={error} onBack={onBack} onRetry={() => setRevision((value) => value + 1)} /></>;
  if (!detail) return <>{navigation}<SiteVersionLoading /></>;
  return (
    <SiteVersionView
      detail={detail}
      relatedSites={relatedSites}
      isAdmin={isAdmin}
      searchLabel={query || 'Search on Web...'}
      accountControls={accountControls}
      section={initialSection}
      initialSectionId={initialSectionId}
      onSectionChange={onSectionChange ?? (() => undefined)}
      onInspectorChange={onInspectorChange}
      onVersionChange={(nextVersionId) => navigate({
        name: 'site-version',
        siteSlug: detail.routeSlug,
        version: nextVersionId,
        ...(initialSection ? { section: initialSection } : {}),
      })}
      onBack={onBack}
    />
  );
}

function SiteVersionLoading() {
  return <ReferenceDetailLoading kind="site" label="Loading Site details" />;
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
