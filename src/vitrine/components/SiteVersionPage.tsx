import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Button, EmptyState, Icon } from '@astryxdesign/core';
import { navigate, routeToPath, updateLocation } from '../router.ts';
import { getSiteVersion, getSiteVersionBySlug, listSitesPage } from '../sitesApi.ts';
import type {
  SiteSectionView,
  SiteSummary,
  SiteVersionDetail,
  SiteVersionOption,
  SiteVersionPage as SitePage,
} from '../types.ts';
import { HeroButton } from './HeroButton.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { ReferenceDetailShell } from './ReferenceDetailShell.tsx';
import { ReferenceDetailLoading } from './ReferenceDetailLoading.tsx';
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = versions.find(({ id }) => id === selectedVersionId) ?? versions[0];

  useEffect(() => {
    setOpen(false);
  }, [selectedVersionId]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const moveMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  if (!selected) return null;

  return (
    <div ref={rootRef} className="site-version-picker" data-open={open || undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="site-version-picker__trigger"
        aria-label="Site version"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{formatSiteVersionDateTime(selected.updatedAt)}</span>
        <span className="site-version-picker__chevron" aria-hidden="true">
          <Icon icon="chevronDown" size="sm" />
        </span>
      </button>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label="Available Site versions"
        className="site-version-picker__menu"
        hidden={!open}
        onKeyDown={moveMenuFocus}
      >
        {versions.map((version) => {
          const isSelected = version.id === selectedVersionId;
          return (
            <button
              key={version.id}
              type="button"
              role="menuitemradio"
              aria-checked={isSelected}
              className="site-version-picker__option"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                if (!isSelected) onChange(version.id);
              }}
            >
              <span>{formatSiteVersionDateTime(version.updatedAt)}</span>
              {version.isLatest ? <span className="site-version-picker__latest">Latest</span> : null}
              {isSelected ? (
                <span className="site-version-picker__check" aria-hidden="true">
                  <Icon icon="check" size="md" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SiteVersionViewProps {
  detail: SiteVersionDetail;
  isAdmin: boolean;
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
    { label: 'Pages', value: String(pages.length) },
    { label: 'Sections', value: String(sectionCount) },
    ...(updatedAt ? [{ label: 'Last updated', value: formatUpdatedAt(updatedAt) }] : []),
  ];
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
        actions={<HeroButton onClick={() => window.open(detail.site.sourceUrl, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>}
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
  sections,
  onOpen,
}: {
  sections: SectionItem[];
  onOpen: (index: number) => void;
}) {
  return (
    <section className="site-sections">
      <header className="site-sections__header">
        <h2>{sections.length} sections</h2>
        <p>Open a capture to inspect the section, full-page context, and reconstruction details.</p>
      </header>
      {sections.length ? (
        <ol data-site-sections-grid="true" className="site-sections__grid">
          {sections.map(({ page, item, patterns }, visibleIndex) => {
            const heading = typeof item.sourceMetadata.heading === 'string'
              ? item.sourceMetadata.heading.trim()
              : '';
            const sectionName = patterns.find((pattern) => /\bsection$/i.test(pattern.trim()))
              ?? patterns[0];
            const label = `Open ${sectionName} from ${page.title}`;
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
                </div>
                <span className="site-section-tile__label">
                  <strong>{sectionName}</strong>
                  <small>{heading ? `${heading} · ` : ''}{page.title}</small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : <EmptyState title="No sections available" description="This Site capture does not contain any sections." isCompact />}
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
      listSitesPage(4, 0).then(({ sites }) => sites).catch(() => []),
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
  if (!detail) return <>{topNav}<SiteVersionLoading /></>;
  return (
    <>
      {topNav}
      <SiteVersionView
        detail={detail}
        relatedSites={relatedSites}
        isAdmin={isAdmin}
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
    </>
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

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
