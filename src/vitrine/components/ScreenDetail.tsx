import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Button, EmptyState, Selector, Spinner, ToggleButton } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db';
import type { Platform } from '../../platformFromUrl';
import { PLATFORM_LABEL } from '../../platformFromUrl';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { AppMetadata, Screen } from '../types';
import { resolveAppSectionTotals } from '../appSectionTotals';
import { useAppSectionData, type DetailSection } from '../useAppSectionData';
import { useDesignSystem } from '../useDesignSystem';
import { useDesignSystemGeneration } from '../useDesignSystemGeneration';
import { AppOverviewPanel } from './AppOverviewPanel';
import { AppsPlatformSwitcher } from './AppsPlatformSwitcher';
import { CuratorReviewPanel } from './CuratorReviewPanel';
import { ExportPanel } from './ExportPanel';
import { FlowsPanel } from './FlowsPanel';
import { FlowsWorkspaceLoading } from './FlowsWorkspace.tsx';
import { HeroButton } from './HeroButton';
import { Lightbox } from './Lightbox';
import { ScreenGridCard } from './ScreenGridCard';
import { ScrollToTopButton } from './ScrollToTopButton';
import { ReferenceDetailShell } from './ReferenceDetailShell';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav';
import { ReferenceGalleryGrid, ReferenceGallerySection } from './ReferenceGallerySection';
import { SearchTrigger } from './SearchTrigger';
import type { FlowRepresentation } from '../router.ts';

const DesignSystemPanel = lazy(() =>
  import('./DesignSystemPanel').then((module) => ({ default: module.DesignSystemPanel })),
);

type LightboxState = { index: number } | null;
const SECTIONS: DetailSection[] = ['overview', 'screens', 'elements', 'flows', 'design-system', 'export', 'review'];
const MEMBER_SECTIONS: DetailSection[] = ['screens', 'elements', 'flows'];

const resolveSection = (initialSection: string | undefined, role: 'admin' | 'user'): DetailSection => {
  const allowed = role === 'admin' ? SECTIONS : MEMBER_SECTIONS;
  return allowed.includes(initialSection as DetailSection)
    ? initialSection as DetailSection
    : role === 'admin' ? 'overview' : 'screens';
};

const formatCapturedAt = (value: string) => new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(value));

interface ScreenDetailProps {
  app: AppMetadata;
  onBack: () => void;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  role: 'admin' | 'user';
  initialSection?: string;
  initialPlatform?: Platform;
  initialVersion?: number;
  initialEvidence?: string;
  initialFlow?: string;
  initialStep?: number;
  initialFlowView?: FlowRepresentation;
  onSectionChange?: (section: DetailSection, platform: Platform, version?: number) => void;
  onFlowChange?: (
    flow: string | undefined,
    step: number | undefined,
    flowView: FlowRepresentation | undefined,
    platform: Platform,
    version?: number,
  ) => void;
  accountControls?: ReactNode;
  onOpenSearch?: () => void;
  onImport?: () => void;
}

export function ScreenDetail({
  app,
  onBack,
  role,
  initialSection,
  initialPlatform,
  initialVersion,
  initialEvidence,
  initialFlow,
  initialStep,
  initialFlowView,
  onSectionChange,
  onFlowChange,
  accountControls,
  onOpenSearch,
  onImport,
}: ScreenDetailProps) {
  const appPlatforms = (app.platforms ?? []).filter(
    (platform): platform is Platform => platform === 'ios' || platform === 'android' || platform === 'web',
  );
  const routedPlatform = initialPlatform && (appPlatforms.length === 0 || appPlatforms.includes(initialPlatform))
    ? initialPlatform
    : undefined;
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(routedPlatform ?? appPlatforms[0] ?? 'web');
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(initialVersion);
  const [section, setSectionState] = useState<DetailSection>(() => resolveSection(initialSection, role));
  useEffect(() => setSectionState(resolveSection(initialSection, role)), [initialSection, role]);
  useEffect(() => {
    if (routedPlatform) setSelectedPlatform(routedPlatform);
  }, [routedPlatform]);
  useEffect(() => setSelectedVersion(initialVersion), [initialVersion]);
  const setSection = (next: DetailSection) => {
    setSectionState(next);
    onSectionChange?.(next, selectedPlatform, sectionData.resolvedVersion);
  };

  const sectionData = useAppSectionData({
    appId: app.id,
    activeSection: section,
    platform: selectedPlatform,
    selectedVersion,
  });
  const needsDesignSystem = section === 'design-system' || section === 'export' || section === 'review';
  const {
    snapshot,
    status: designSystemStatus,
    error: designSystemError,
    retry: retryDesignSystem,
    reload: reloadDesignSystem,
    invalidate: invalidateDesignSystem,
  } = useDesignSystem(
    app.id,
    selectedPlatform,
    sectionData.resolvedVersion,
    needsDesignSystem && !sectionData.versionsLoading,
  );
  const designSystemGeneration = useDesignSystemGeneration({
    app: app.id,
    platform: selectedPlatform,
    version: sectionData.resolvedVersion,
    enabled: role === 'admin' && section === 'design-system' && !sectionData.versionsLoading,
    hasSnapshot: snapshot !== null,
    invalidateDesignSystem,
    reloadDesignSystem,
  });

  const evidence = sectionData.state.data && 'screens' in sectionData.state.data
    ? sectionData.state.data
    : null;
  const screens = evidence?.screens ?? [];
  const flows = sectionData.state.data && 'flows' in sectionData.state.data
    ? sectionData.state.data.flows
    : [] as DesignFlow<EvidenceView>[];
  const sectionTotals = resolveAppSectionTotals(
    app,
    sectionData.versions,
    sectionData.resolvedVersion,
  );
  const nextCursor = evidence?.nextCursor ?? null;
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [layoutFilter, setLayoutFilter] = useState('All');
  const [componentFilter, setComponentFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const types = [...new Set(screens.map(({ type }) => type))];
  const layouts = [...new Set(screens.flatMap(({ layoutPatterns }) => layoutPatterns ?? []))];
  const screenComponents = [...new Set(screens.flatMap(({ componentNames }) => componentNames ?? []))];
  const states = [...new Set(screens.flatMap(({ visibleStates }) => visibleStates))];
  const filtered = screens.filter((screen) =>
    (typeFilter === 'All' || screen.type === typeFilter)
    && (layoutFilter === 'All' || screen.layoutPatterns?.includes(layoutFilter))
    && (componentFilter === 'All' || screen.componentNames?.includes(componentFilter))
    && (stateFilter === 'All' || screen.visibleStates.includes(stateFilter)));

  const selectPlatform = (platform: Platform) => {
    setSelectedPlatform(platform);
    setSelectedVersion(undefined);
    setLightbox(null);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try { await sectionData.loadNext(); }
    finally { setLoadingMore(false); }
  };

  useEffect(() => {
    if ((section !== 'screens' && section !== 'elements') || !nextCursor) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [section, nextCursor, loadingMore, sectionData.resolvedVersion]);

  useEffect(() => {
    if (!initialEvidence || (section !== 'screens' && section !== 'elements')) return;
    const match = /^(?:SCREEN|UI-ELEMENT)-(\d+)$/.exec(initialEvidence);
    if (!match) return;
    const imageId = Number(match[1]);
    const index = screens.findIndex(({ id }) => id === imageId);
    if (index >= 0) {
      setLightbox({ index });
      return;
    }
    if (nextCursor && !loadingMore) void loadMore();
  }, [initialEvidence, section, screens, nextCursor, loadingMore]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;
    const tween = gsap.fromTo(contentRef.current, { opacity: 0, y: 6 }, {
      opacity: 1, y: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto',
    });
    return () => { tween.kill(); };
  }, [section, selectedPlatform]);

  const goLightbox = (index: number) => {
    if (!screens.length) return;
    setLightbox({ index: ((index % screens.length) + screens.length) % screens.length });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightbox) {
        if (event.key === 'Escape') setLightbox(null);
        else if (event.key === 'ArrowLeft') goLightbox(lightbox.index - 1);
        else if (event.key === 'ArrowRight') goLightbox(lightbox.index + 1);
      } else if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, screens.length, onBack]);

  const sectionLoading = sectionData.versionsLoading
    || sectionData.state.status === 'loading'
    || (needsDesignSystem && designSystemStatus === 'loading' && !snapshot);
  const sectionError = sectionData.state.status === 'error' ? sectionData.state.error : null;
  const hasScreenFilters = types.length > 1 || layouts.length > 0 || screenComponents.length > 0 || states.length > 0;
  const screenFilterControls = hasScreenFilters ? (
    <>
      {types.length > 1 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['All', ...types].map((type) => <ToggleButton key={type} label={type} isPressed={typeFilter === type} onPressedChange={() => setTypeFilter(type)} size="sm" />)}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{([
        ['Layout', layoutFilter, setLayoutFilter, layouts], ['Component', componentFilter, setComponentFilter, screenComponents], ['State', stateFilter, setStateFilter, states],
      ] as Array<[string, string, (value: string) => void, string[]]>).map(([label, value, change, options]) => options.length ? <Selector key={label} label={label} size="sm" value={value} onChange={change} options={['All', ...options]} /> : null)}</div>
    </>
  ) : undefined;
  const renderEvidence = (items: Screen[], emptyTitle: string) => (
    <ReferenceGallerySection
      toolbar={section === 'screens' ? screenFilterControls : undefined}
      sentinel={nextCursor ? <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>{loadingMore && <Spinner size="sm" />}</div> : undefined}
    >
      {items.length ? (
        <ReferenceGalleryGrid
          minCardWidth={360}
          columns={section === 'screens' || section === 'elements' ? 2 : undefined}
        >
          {(section === 'screens' ? filtered : items).map((screen, index) => (
            <ScreenGridCard
              key={screen.id}
              screen={screen}
              accent={app.accent}
              delay={Math.min(index * 0.04, 0.32)}
              onOpen={() => setLightbox({ index: screens.indexOf(screen) })}
            />
          ))}
        </ReferenceGalleryGrid>
      ) : <EmptyState title={emptyTitle} isCompact />}
    </ReferenceGallerySection>
  );

  const platformControls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Platform</span>
      <AppsPlatformSwitcher
        value={selectedPlatform}
        platforms={appPlatforms.length ? appPlatforms : [selectedPlatform]}
        onChange={selectPlatform}
      />
    </div>
  );
  const adminTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'screens' as const, label: 'Screens' },
    { id: 'elements' as const, label: 'UI Elements' },
    { id: 'flows' as const, label: 'Flows' },
    { id: 'design-system' as const, label: 'Design System' },
    { id: 'export' as const, label: 'Export' },
    ...(role === 'admin' ? [{ id: 'review' as const, label: 'Review' }] : []),
  ];
  const memberTabs = [
    { id: 'screens' as const, label: 'Screens' },
    { id: 'elements' as const, label: 'UI Elements' },
    { id: 'flows' as const, label: 'Flows' },
  ];
  const tabs = role === 'admin' ? adminTabs : memberTabs;
  const metadata = [
    { label: 'Category', value: app.categories.map(({ name }) => name).join(', ') },
    { label: 'Screens', value: String(app.totalScreens) },
    ...(app.lastCapturedAt ? [{ label: 'Last updated', value: formatCapturedAt(app.lastCapturedAt) }] : []),
  ];
  const actions = role === 'admin' || app.websiteUrl ? (
    <>
      {role === 'admin' ? <HeroButton primary onClick={() => setSection('export')}>Export to Figma</HeroButton> : null}
      {app.websiteUrl && <HeroButton onClick={() => window.open(app.websiteUrl!, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>}
    </>
  ) : undefined;
  return (
    <>
      <ReferenceDiscoveryTopNav
        active="apps"
        className="apps-top-nav"
        search={(
          <SearchTrigger
            label={`Search on ${PLATFORM_LABEL[selectedPlatform]}...`}
            activeCategory={null}
            onOpen={onOpenSearch ?? (() => undefined)}
            onClearCategory={() => undefined}
          />
        )}
        isAdmin={role === 'admin'}
        importLabel="Import App"
        onImport={onImport ?? (() => undefined)}
        accountControls={accountControls}
      />
      <ReferenceDetailShell
        dataDetailKind="app"
        className="app-detail"
        title={app.app}
        description={app.description}
        identityKey={`app-icon-${app.id}`}
        identityLabel={app.app[0]}
        identityImageUrl={app.iconUrl}
        accent={app.accent}
        onBack={onBack}
        heroControls={platformControls}
        metadata={metadata}
        actions={actions}
        tabs={tabs}
        activeTab={section}
        onTabChange={setSection}
        tabTrailing={<span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{section === 'screens' ? `${sectionTotals.screens} screens` : section === 'elements' ? `${sectionTotals.elements} UI elements` : section === 'flows' ? `${sectionTotals.flows} flows` : ''}</span>}
        bodyPadding={section === 'screens' || section === 'elements' || section === 'flows' ? '32px 40px 72px' : '8px 40px 80px'}
      >
        <div ref={contentRef}>
          {section === 'overview' ? <AppOverviewPanel app={app} />
            : sectionError || (needsDesignSystem && designSystemStatus === 'error') ? <div role="alert"><EmptyState title="Could not load this section" description={sectionError?.message ?? designSystemError?.message} actions={<Button label="Retry" clickAction={() => void (sectionError ? sectionData.retry() : retryDesignSystem())} />} /></div>
              : sectionLoading
                ? section === 'flows'
                  ? <FlowsWorkspaceLoading />
                  : <div role="status" aria-label="Loading section" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
                : section === 'review' ? <CuratorReviewPanel app={app.id} platform={selectedPlatform} version={sectionData.resolvedVersion} snapshot={snapshot} />
                  : section === 'design-system' ? <Suspense fallback={<Spinner size="lg" />}><DesignSystemPanel snapshot={snapshot} status={designSystemStatus} generation={designSystemGeneration} /></Suspense>
                    : section === 'export' ? <ExportPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} screens={screens} />
                      : section === 'flows' ? <FlowsPanel
                          flows={flows}
                          app={app.id}
                          platform={selectedPlatform}
                          version={sectionData.resolvedVersion}
                          userRole={role}
                          selectedFlowId={initialFlow}
                          selectedStep={initialStep}
                          selectedFlowView={initialFlowView}
                          onSelectionChange={(flow, step, flowView) => onFlowChange?.(
                            flow,
                            step,
                            flowView,
                            selectedPlatform,
                            sectionData.resolvedVersion,
                          )}
                        />
                        : renderEvidence(screens, section === 'elements' ? 'No UI elements captured' : 'No screens captured')}
        </div>
      </ReferenceDetailShell>
      {lightbox && screens[lightbox.index] && (() => {
        const item = screens[lightbox.index];
        return <Lightbox item={{ url: item.url, type: item.type, caption: item.description ?? item.type, platform: item.platform }} index={lightbox.index} total={screens.length} onClose={() => setLightbox(null)} onNavigate={goLightbox} />;
      })()}
      <ScrollToTopButton />
    </>
  );
}
