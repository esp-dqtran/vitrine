import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db';
import type { Platform } from '../../platformFromUrl';
import { PLATFORM_LABEL } from '../../platformFromUrl';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { AppMetadata, Screen } from '../types';
import type { AppsFilterOption } from '../appsDiscovery.ts';
import { hasDesignSystemContent } from '../designSystemAvailability.ts';
import {
  fetchAppFlows,
  fetchAppUiElementSummary,
  type UiElementSummaryResult,
} from '../appsApi.ts';
import { resolveAppSectionTotals } from '../appSectionTotals';
import {
  EMPTY_FLOW_FILTERS,
  EMPTY_SCREEN_FILTERS,
  flowFilterValues,
  flowMatchesFilters,
  screenMatchesFilters,
  type FlowFilterSelections,
  type ScreenFilterSelections,
} from '../detailFilters.ts';
import {
  buildScreenFlowMembership,
} from '../screenFlowContext.ts';
import {
  copyScreenImagesAsPng,
  type ImageBatchProgress,
} from '../screenActions.ts';
import type { SaveReference } from '../researchApi.ts';
import { useAppSectionData, type DetailSection } from '../useAppSectionData';
import { useDesignSystem } from '../useDesignSystem';
import { useDesignSystemGeneration } from '../useDesignSystemGeneration';
import { AppsPlatformSwitcher } from './AppsPlatformSwitcher';
import { AstryxSingleSelectDropdown } from './AstryxDropdown.tsx';
import { useApplicationToast } from './ApplicationToast.tsx';
import { CopyButton } from './CopyButton.tsx';
import { CollectionPicker } from './CollectionPicker.tsx';
import {
  DiscoveryFilterMenu,
  isOutsideAppsFilterMenu,
  type DiscoveryFilterGroup,
} from './AppsFilterBar.tsx';
import { ExportPanel } from './ExportPanel';
import { FlowsPanel } from './FlowsPanel';
import { FlowsWorkspaceLoading } from './FlowsWorkspace.tsx';
import { HeroButton } from './HeroButton';
import { ScreenGridCard } from './ScreenGridCard';
import { ScreenPreviewDialog } from './ScreenPreviewDialog.tsx';
import { ScrollToTopButton } from './ScrollToTopButton';
import { ReferenceDetailPage } from './ReferenceDetailPage';
import { ReferenceGalleryGrid, ReferenceGallerySection } from './ReferenceGallerySection';
import type { FlowRepresentation } from '../router.ts';

const DesignSystemPanel = lazy(() =>
  import('./DesignSystemPanel').then((module) => ({ default: module.DesignSystemPanel })),
);

type LightboxState = { index: number } | null;
type ScreenFilterGroup = 'types' | 'layouts' | 'components' | 'states';
type FlowFilterGroup = 'categories' | 'tags' | 'interactions' | 'states';

interface MetadataFilterGroup {
  id: string;
  label: string;
  options: string[];
  selected: string[];
}

interface MetadataFilterControlProps {
  label: string;
  groups: MetadataFilterGroup[];
  onToggle: (group: string, value: string, checked: boolean) => void;
  onClear: () => void;
}

function MetadataFilterControl({
  label,
  onToggle,
  onClear,
  groups: sourceGroups,
}: MetadataFilterControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<AppsFilterOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const group: DiscoveryFilterGroup = {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    selected: sourceGroups.flatMap(({ selected }) => selected),
    options: sourceGroups.flatMap(({ label: section, options }) =>
      options.map((value) => ({ value, section }))),
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isOutsideAppsFilterMenu(containerRef.current, event.target)) {
        setOpen(false);
      }
    };
    // capture: true so this fires before ScreenDetail's page-level Escape
    // listener regardless of mount order, and stopPropagation keeps that
    // listener from also firing onBack().
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <DiscoveryFilterMenu
      group={group}
      open={open}
      query={query}
      preview={preview}
      containerRef={containerRef}
      onToggleOpen={() => {
        setQuery('');
        setPreview(null);
        setOpen((current) => !current);
      }}
      onQueryChange={setQuery}
      onPreview={setPreview}
      onToggleOption={(option) => {
        const sourceGroup = sourceGroups.find(({ label: section }) => section === option.section);
        if (!sourceGroup) return;
        onToggle(
          sourceGroup.id,
          option.value,
          !sourceGroup.selected.includes(option.value),
        );
      }}
      onClear={onClear}
    />
  );
}

const SECTIONS: DetailSection[] = ['screens', 'elements', 'flows', 'design-system', 'export'];
const MEMBER_SECTIONS: DetailSection[] = ['screens', 'elements', 'flows', 'design-system'];

export function appDetailTabs(hasDesignSystem: boolean) {
  return [
    { id: 'screens' as const, label: 'Screens' },
    { id: 'flows' as const, label: 'Flows' },
    ...(hasDesignSystem
      ? [{ id: 'design-system' as const, label: 'Design System' }]
      : []),
  ];
}

const resolveSection = (initialSection: string | undefined, role: 'admin' | 'user'): DetailSection => {
  const allowed = role === 'admin' ? SECTIONS : MEMBER_SECTIONS;
  return allowed.includes(initialSection as DetailSection)
    ? initialSection as DetailSection
    : 'screens';
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
  onEvidenceChange?: (
    evidence: string | undefined,
    section: 'screens' | 'elements',
    platform: Platform,
    version?: number,
  ) => void;
  onFlowChange?: (
    flow: string | undefined,
    step: number | undefined,
    flowView: FlowRepresentation | undefined,
    platform: Platform,
    version?: number,
  ) => void;
  accountControls?: ReactNode;
  onOpenSearch?: () => void;
}

export function ScreenDetail({
  app,
  onBack,
  collections,
  onCollectionsChange,
  role,
  initialSection,
  initialPlatform,
  initialVersion,
  initialEvidence,
  initialFlow,
  initialStep,
  initialFlowView,
  onSectionChange,
  onEvidenceChange,
  onFlowChange,
  accountControls,
  onOpenSearch,
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
  const needsDesignSystem = section === 'design-system' || section === 'export';
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
    !sectionData.versionsLoading,
  );
  const designSystemAvailable = hasDesignSystemContent(snapshot);
  const designSystemMissing = designSystemStatus === 'missing'
    || (designSystemStatus === 'ready' && !designSystemAvailable);
  useEffect(() => {
    if (section !== 'design-system' || !designSystemMissing) return;
    setSectionState('screens');
    onSectionChange?.('screens', selectedPlatform, sectionData.resolvedVersion);
  }, [
    designSystemMissing,
    onSectionChange,
    section,
    sectionData.resolvedVersion,
    selectedPlatform,
  ]);
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
  const [screenFilters, setScreenFilters] = useState<ScreenFilterSelections>(EMPTY_SCREEN_FILTERS);
  const [screenFlowFilters, setScreenFlowFilters] = useState<string[]>([]);
  const [elementFilters, setElementFilters] = useState<ScreenFilterSelections>(EMPTY_SCREEN_FILTERS);
  const [flowFilters, setFlowFilters] = useState<FlowFilterSelections>(EMPTY_FLOW_FILTERS);
  const [screenContextFlows, setScreenContextFlows] = useState<DesignFlow<EvidenceView>[]>([]);
  const [componentCropSummary, setComponentCropSummary] = useState<UiElementSummaryResult | null>(null);
  const [componentCropSummaryLoading, setComponentCropSummaryLoading] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<number>>(() => new Set());
  const [copyProgress, setCopyProgress] = useState<ImageBatchProgress | null>(null);
  const showApplicationToast = useApplicationToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const types = [...new Set(screens.map(({ type }) => type))];
  const layouts = [...new Set(screens.flatMap(({ layoutPatterns }) => layoutPatterns ?? []))];
  const screenComponents = [...new Set(screens.flatMap(({ componentNames }) => componentNames ?? []))];
  const states = [...new Set(screens.flatMap(({ visibleStates }) => visibleStates))];
  const screenFilterOptions: ScreenFilterSelections = {
    types,
    layouts,
    components: screenComponents,
    states,
  };
  const screenFlowMembership = useMemo(
    () => buildScreenFlowMembership(screenContextFlows),
    [screenContextFlows],
  );
  const filteredScreens = screens.filter((screen) =>
    screenMatchesFilters(screen, screenFilters)
    && (!screenFlowFilters.length || screenFlowFilters.some((title) =>
      screenFlowMembership.get(screen.id)?.some((flow) => flow.title === title))));
  const filteredElements = screens.filter((screen) => screenMatchesFilters(screen, elementFilters));
  const flowValues = flows.map(flowFilterValues);
  const flowFilterOptions: FlowFilterSelections = {
    categories: [...new Set(flowValues.flatMap(({ categories }) => categories))],
    tags: [...new Set(flowValues.flatMap(({ tags }) => tags))],
    interactions: [...new Set(flowValues.flatMap(({ interactions }) => interactions))],
    states: [...new Set(flowValues.flatMap(({ states: flowStates }) => flowStates))],
  };
  const filteredFlows = flows.filter((flow) => flowMatchesFilters(flow, flowFilters));
  const selectedScreens = screens.filter((screen) => selectedScreenIds.has(screen.id));
  const selectedScreenReferences = selectedScreens.map((screen): SaveReference => ({
    kind: 'screen',
    app: app.id,
    referenceId: String(screen.id),
    title: screenFlowMembership.get(screen.id)?.[0]?.title
      ?? (screen.type !== 'Unclassified'
        ? screen.type
        : screen.productArea !== 'Unclassified'
          ? screen.productArea
          : `Screen ${screen.id}`),
  }));

  useEffect(() => {
    if (section !== 'screens' || sectionData.versionsLoading) return;
    const controller = new AbortController();
    void fetchAppFlows(app.id, {
      platform: selectedPlatform,
      version: sectionData.resolvedVersion,
      signal: controller.signal,
    }).then(({ flows: contextFlows }) => {
      setScreenContextFlows(contextFlows);
    }).catch((error: Error) => {
      if (error.name !== 'AbortError') setScreenContextFlows([]);
    });
    return () => controller.abort();
  }, [
    app.id,
    section,
    sectionData.resolvedVersion,
    sectionData.versionsLoading,
    selectedPlatform,
  ]);

  useEffect(() => {
    if (section !== 'design-system' || sectionData.versionsLoading) return;
    const controller = new AbortController();
    setComponentCropSummary(null);
    setComponentCropSummaryLoading(true);
    void fetchAppUiElementSummary(app.id, {
      platform: selectedPlatform,
      version: sectionData.resolvedVersion,
      limit: 100,
      signal: controller.signal,
    }).then(setComponentCropSummary).catch((error: Error) => {
      if (error.name !== 'AbortError') {
        setComponentCropSummary({
          items: [],
          totalOccurrences: 0,
          totalTypes: 0,
          platform: selectedPlatform,
          version: null,
        });
      }
    }).finally(() => {
      if (!controller.signal.aborted) setComponentCropSummaryLoading(false);
    });
    return () => controller.abort();
  }, [
    app.id,
    section,
    sectionData.resolvedVersion,
    sectionData.versionsLoading,
    selectedPlatform,
  ]);

  useEffect(() => {
    if (section !== 'screens') setSelectedScreenIds(new Set());
  }, [section]);

  const selectPlatform = (platform: Platform) => {
    setSelectedPlatform(platform);
    setSelectedVersion(undefined);
    setScreenFilters(EMPTY_SCREEN_FILTERS);
    setScreenFlowFilters([]);
    setElementFilters(EMPTY_SCREEN_FILTERS);
    setFlowFilters(EMPTY_FLOW_FILTERS);
    setLightbox(null);
    setSelectedScreenIds(new Set());
    onSectionChange?.(section, platform);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return null;
    setLoadingMore(true);
    try { return await sectionData.loadNext(); }
    catch { return null; }
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

  const showLightboxScreen = (index: number, availableScreens: Screen[]) => {
    const nextScreen = availableScreens[index];
    if (!nextScreen) return false;
    setLightbox({ index });
    if (nextScreen && (section === 'screens' || section === 'elements')) {
      onEvidenceChange?.(
        `${section === 'elements' ? 'UI-ELEMENT' : 'SCREEN'}-${nextScreen.id}`,
        section,
        selectedPlatform,
        sectionData.resolvedVersion,
      );
    }
    return true;
  };

  const goLightbox = async (index: number) => {
    if (index < 0) return;
    if (showLightboxScreen(index, screens)) return;
    if (index !== screens.length || !nextCursor || loadingMore) return;
    const nextPage = await loadMore();
    if (nextPage && 'screens' in nextPage) showLightboxScreen(index, nextPage.screens);
  };

  const openLightbox = (screen: Screen) => {
    const index = screens.indexOf(screen);
    if (index < 0) return;
    setLightbox({ index });
    if (section === 'screens' || section === 'elements') {
      onEvidenceChange?.(
        `${section === 'elements' ? 'UI-ELEMENT' : 'SCREEN'}-${screen.id}`,
        section,
        selectedPlatform,
        sectionData.resolvedVersion,
      );
    }
  };

  const closeLightbox = () => {
    setLightbox(null);
    if (section === 'screens' || section === 'elements') {
      onEvidenceChange?.(
        undefined,
        section,
        selectedPlatform,
        sectionData.resolvedVersion,
      );
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightbox) {
        if (event.key === 'Escape') setLightbox(null);
        else if (event.key === 'ArrowLeft') void goLightbox(lightbox.index - 1);
        else if (event.key === 'ArrowRight') void goLightbox(lightbox.index + 1);
      } else if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, screens.length, nextCursor, loadingMore, onBack]);

  const setScreenSelected = (screenId: number, selected: boolean) => {
    setSelectedScreenIds((current) => {
      const next = new Set(current);
      if (selected) next.add(screenId);
      else next.delete(screenId);
      return next;
    });
  };

  const copySelectedScreens = async () => {
    if (!selectedScreens.length) return;
    setCopyProgress({
      completed: 0,
      total: selectedScreens.length,
      succeeded: 0,
      failed: 0,
    });
    try {
      const result = await copyScreenImagesAsPng(
        selectedScreens.map(({ url }) => url),
        setCopyProgress,
      );
      if (result.failures.length) {
        throw new Error(
          `Board copied with ${result.succeeded} of ${selectedScreens.length} images; ${result.failures.length} failed`,
        );
      }
      setSelectedScreenIds(new Set());
    } finally {
      setCopyProgress(null);
    }
  };

  const sectionLoading = sectionData.versionsLoading
    || sectionData.state.status === 'loading'
    || (needsDesignSystem && designSystemStatus === 'loading' && !snapshot)
    || (section === 'design-system' && componentCropSummaryLoading);
  const sectionError = sectionData.state.status === 'error' ? sectionData.state.error : null;
  const screenCard = (
    screen: Screen,
    index: number,
  ) => (
    <ScreenGridCard
      key={screen.id}
      screen={screen}
      accent={app.accent}
      delay={Math.min(index * 0.04, 0.32)}
      onOpen={() => openLightbox(screen)}
      appName={app.app}
      appId={app.id}
      collections={collections}
      onCollectionsChange={onCollectionsChange}
      plan={role === 'admin' ? 'pro' : 'free'}
      flowNames={(screenFlowMembership.get(screen.id) ?? []).map(({ title }) => title)}
      selected={selectedScreenIds.has(screen.id)}
      onSelectedChange={(selected) => setScreenSelected(screen.id, selected)}
      onActionStatus={showApplicationToast}
    />
  );
  const renderEvidence = (items: Screen[], emptyTitle: string) => {
    const visibleItems = section === 'screens'
      ? filteredScreens
      : section === 'elements'
        ? filteredElements
        : items;
    return (
      <ReferenceGallerySection
        sentinel={nextCursor ? <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>{loadingMore && <Spinner size="sm" />}</div> : undefined}
      >
        {visibleItems.length ? (
          <ReferenceGalleryGrid
            minCardWidth={section === 'screens' ? 240 : 360}
            columns={section === 'elements' ? 2 : undefined}
            layout={section === 'screens'
              ? selectedPlatform === 'web'
                ? 'web-screens'
                : 'mobile-screens'
              : undefined}
          >
            {visibleItems.map((screen, index) => screenCard(screen, index))}
          </ReferenceGalleryGrid>
        ) : <EmptyState title={items.length ? `No ${section === 'elements' ? 'UI elements' : 'screens'} match these filters` : emptyTitle} isCompact />}
      </ReferenceGallerySection>
    );
  };
  const renderScreens = () => renderEvidence(screens, 'No screens captured');

  const screenActionOverlay = (
    <>
      {selectedScreens.length ? (
        <div
          className="screen-batch-toolbar"
          role="toolbar"
          aria-label={`${selectedScreens.length} selected ${selectedScreens.length === 1 ? 'screen' : 'screens'}`}
        >
          <strong aria-live="polite">
            {copyProgress
              ? `Preparing ${copyProgress.completed} of ${copyProgress.total}`
              : `${selectedScreens.length} selected`}
          </strong>
          <Button
            label="Clear"
            variant="ghost"
            size="sm"
            isDisabled={Boolean(copyProgress)}
            onClick={() => setSelectedScreenIds(new Set())}
          />
          <CopyButton
            label={selectedScreens.length === 1 ? 'Copy image' : 'Copy as board'}
            successMessage={selectedScreens.length === 1
              ? 'Image copied as PNG'
              : `${selectedScreens.length}-image board copied as PNG`}
            copyingLabel={copyProgress
              ? `Preparing ${copyProgress.completed} of ${copyProgress.total}`
              : 'Preparing board…'}
            action={copySelectedScreens}
            variant="secondary"
            size="sm"
          />
          <CollectionPicker
            references={selectedScreenReferences}
            collections={collections}
            onCollectionsChange={onCollectionsChange}
            plan={role === 'admin' ? 'pro' : 'free'}
            dark
            buttonLabel="Save"
            buttonClassName="screen-batch-toolbar__save"
            suppressSavedLabel
            onStatus={showApplicationToast}
          />
        </div>
      ) : null}
    </>
  );

  const platformControl = (
    <AppsPlatformSwitcher
      value={selectedPlatform}
      platforms={appPlatforms.length ? appPlatforms : [selectedPlatform]}
      onChange={selectPlatform}
    />
  );
  const tabs = appDetailTabs(designSystemAvailable
    || (section === 'design-system' && !designSystemMissing));
  const metadata = [
    { label: 'Platform', value: PLATFORM_LABEL[selectedPlatform], content: platformControl },
    { label: 'Category', value: app.categories.map(({ name }) => name).join(', ') },
    { label: 'Screens', value: String(sectionTotals.screens) },
    ...(app.lastCapturedAt ? [{ label: 'Last updated', value: formatCapturedAt(app.lastCapturedAt) }] : []),
  ];
  const actions = role === 'admin' || app.websiteUrl ? (
    <>
      {role === 'admin' ? <HeroButton primary onClick={() => setSection('export')}>Export to Figma</HeroButton> : null}
      {app.websiteUrl && <HeroButton onClick={() => window.open(app.websiteUrl!, '_blank', 'noopener,noreferrer')}>Visit Site</HeroButton>}
    </>
  ) : undefined;
  const versions = sectionData.versions ?? [];
  const latestVersion = versions.find(({ status }) => status === 'published') ?? versions[0];
  const versionOptions = versions.length
    ? versions.map((version) => ({
        value: String(version.version_number),
        label: version.version_number === latestVersion?.version_number
          ? 'Latest'
          : `Version ${version.version_number}`,
      }))
    : [{ value: 'latest', label: 'Latest' }];
  const selectedVersionValue = sectionData.resolvedVersion
    && versions.some(({ version_number }) => version_number === sectionData.resolvedVersion)
    ? String(sectionData.resolvedVersion)
    : 'latest';
  const activeFlowFilterCount = Object.values(flowFilters).reduce((total, values) => total + values.length, 0);
  const sectionTotal = section === 'screens'
    ? `${sectionTotals.screens} screens`
    : section === 'elements'
      ? `${sectionTotals.elements} UI elements`
      : section === 'flows'
        ? activeFlowFilterCount
          ? `${filteredFlows.length} of ${sectionTotals.flows} ${sectionTotals.flows === 1 ? 'flow' : 'flows'}`
          : `${sectionTotals.flows} flows`
        : '';
  const evidenceFilterGroups = (
    selected: ScreenFilterSelections,
    typeLabel: string,
    componentLabel: string,
    includeFlowContext = false,
    includeStates = true,
  ): MetadataFilterGroup[] => [
    { id: 'types', label: typeLabel, options: screenFilterOptions.types, selected: selected.types },
    { id: 'layouts', label: 'Layouts', options: screenFilterOptions.layouts, selected: selected.layouts },
    { id: 'components', label: componentLabel, options: screenFilterOptions.components, selected: selected.components },
    ...(includeStates ? [{ id: 'states' as const, label: 'States', options: screenFilterOptions.states, selected: selected.states }] : []),
    ...(includeFlowContext ? [{
      id: 'flowContext',
      label: 'Found in Flows',
      options: [...new Set(screenContextFlows.map(({ title }) => title))]
        .sort((left, right) => left.localeCompare(right)),
      selected: screenFlowFilters,
    }] : []),
  ];
  const activeMetadataFilter = section === 'screens'
    ? {
        label: 'Screens',
        groups: evidenceFilterGroups(screenFilters, 'Screen types', 'UI elements', true),
        onToggle: (group: string, value: string, checked: boolean) => {
          if (group === 'flowContext') {
            setScreenFlowFilters((current) => checked
              ? [...new Set([...current, value])]
              : current.filter((item) => item !== value));
            return;
          }
          const filterGroup = group as ScreenFilterGroup;
          setScreenFilters((current) => ({
            ...current,
            [filterGroup]: checked
              ? [...new Set([...current[filterGroup], value])]
              : current[filterGroup].filter((item) => item !== value),
          }));
        },
        onClear: () => {
          setScreenFilters(EMPTY_SCREEN_FILTERS);
          setScreenFlowFilters([]);
        },
      }
    : section === 'elements'
      ? {
          label: 'UI Elements',
          groups: evidenceFilterGroups(elementFilters, 'Element types', 'Components', false, false),
          onToggle: (group: string, value: string, checked: boolean) => {
            const filterGroup = group as ScreenFilterGroup;
            setElementFilters((current) => ({
              ...current,
              [filterGroup]: checked
                ? [...new Set([...current[filterGroup], value])]
                : current[filterGroup].filter((item) => item !== value),
            }));
          },
          onClear: () => setElementFilters(EMPTY_SCREEN_FILTERS),
        }
      : section === 'flows'
        ? {
            label: 'Flows',
            groups: [
              { id: 'categories', label: 'Flow groups', options: flowFilterOptions.categories, selected: flowFilters.categories },
              { id: 'tags', label: 'Tags', options: flowFilterOptions.tags, selected: flowFilters.tags },
              { id: 'interactions', label: 'Interactions', options: flowFilterOptions.interactions, selected: flowFilters.interactions },
              { id: 'states', label: 'States', options: flowFilterOptions.states, selected: flowFilters.states },
            ],
            onToggle: (group: string, value: string, checked: boolean) => {
              const filterGroup = group as FlowFilterGroup;
              setFlowFilters((current) => ({
                ...current,
                [filterGroup]: checked
                  ? [...new Set([...current[filterGroup], value])]
                  : current[filterGroup].filter((item) => item !== value),
              }));
              onFlowChange?.(undefined, undefined, undefined, selectedPlatform, sectionData.resolvedVersion);
            },
            onClear: () => {
              setFlowFilters(EMPTY_FLOW_FILTERS);
              onFlowChange?.(undefined, undefined, undefined, selectedPlatform, sectionData.resolvedVersion);
            },
          }
        : null;
  return (
    <>
      <ReferenceDetailPage
        kind="app"
        searchLabel={`Search on ${PLATFORM_LABEL[selectedPlatform]}...`}
        onOpenSearch={onOpenSearch}
        accountControls={accountControls}
        className={`app-detail app-detail--${selectedPlatform}`}
        title={app.app}
        description={app.description}
        identityKey={`app-icon-${app.id}`}
        identityLabel={app.app[0]}
        identityImageUrl={app.iconUrl}
        accent={app.accent}
        onBack={onBack}
        metadata={metadata}
        actions={actions}
        tabs={tabs}
        activeTab={section}
        onTabChange={setSection}
        tabLeading={(
          <AstryxSingleSelectDropdown
            ariaLabel="App version"
            triggerClassName="reference-detail__version-selector"
            value={selectedVersionValue}
            options={versionOptions}
            onChange={(value) => {
              if (!value || value === 'latest') return;
              const version = Number(value);
              setSelectedVersion(version);
              setScreenFilters(EMPTY_SCREEN_FILTERS);
              setScreenFlowFilters([]);
              setElementFilters(EMPTY_SCREEN_FILTERS);
              setFlowFilters(EMPTY_FLOW_FILTERS);
              setLightbox(null);
              onSectionChange?.(section, selectedPlatform, version);
            }}
          />
        )}
        tabControls={activeMetadataFilter ? (
          <div className="app-detail__navigation-tools">
            <MetadataFilterControl
              key={section}
              label={activeMetadataFilter.label}
              groups={activeMetadataFilter.groups}
              onToggle={activeMetadataFilter.onToggle}
              onClear={activeMetadataFilter.onClear}
            />
          </div>
        ) : null}
        tabTrailing={sectionTotal ? (
          <span className="reference-detail__section-total">
            <span>Showing</span>
            <strong>{sectionTotal}</strong>
          </span>
        ) : null}
        bodyPadding={section === 'screens' || section === 'elements' || section === 'flows' ? '32px 40px 72px' : '8px 40px 80px'}
      >
        <div ref={contentRef}>
          {sectionError || (needsDesignSystem && designSystemStatus === 'error') ? <div role="alert"><EmptyState title="Could not load this section" description={sectionError?.message ?? designSystemError?.message} actions={<Button label="Retry" clickAction={() => void (sectionError ? sectionData.retry() : retryDesignSystem())} />} /></div>
              : sectionLoading
                ? section === 'flows'
                  ? <FlowsWorkspaceLoading />
                  : <div role="status" aria-label="Loading section" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
                : section === 'design-system' ? <Suspense fallback={<Spinner size="lg" />}><DesignSystemPanel
                    snapshot={snapshot}
                    status={designSystemStatus}
                    generation={designSystemGeneration}
                    appName={app.app}
                    componentCrops={componentCropSummary?.items}
                    totalComponentOccurrences={componentCropSummary?.totalOccurrences}
                    totalComponentTypes={componentCropSummary?.totalTypes}
                  /></Suspense>
                    : section === 'export' ? <ExportPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} screens={screens} />
                      : section === 'flows' ? (filteredFlows.length || flows.length === 0 ? <FlowsPanel
                          flows={filteredFlows}
                          app={app.id}
                          platform={selectedPlatform}
                          version={sectionData.resolvedVersion}
                          userRole={role}
                          sourceAppName={app.app}
                          sourceAppIconUrl={app.iconUrl}
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
                        : <ReferenceGallerySection><EmptyState title="No flows match these filters" isCompact /></ReferenceGallerySection>)
                        : section === 'screens'
                          ? renderScreens()
                          : renderEvidence(screens, 'No UI elements captured')}
        </div>
      </ReferenceDetailPage>
      {typeof document !== 'undefined'
        ? createPortal(screenActionOverlay, document.body)
        : null}
      {lightbox && screens[lightbox.index] && (() => {
        const item = screens[lightbox.index];
        return (
          <ScreenPreviewDialog
            appName={app.app}
            appIconUrl={app.iconUrl}
            screen={item}
            index={lightbox.index}
            total={Math.max(sectionTotals.screens, screens.length)}
            canNavigateNext={lightbox.index < screens.length - 1 || Boolean(nextCursor)}
            onClose={closeLightbox}
            onNavigate={goLightbox}
            appId={app.id}
            collections={collections}
            onCollectionsChange={onCollectionsChange}
            plan={role === 'admin' ? 'pro' : 'free'}
            foundInFlows={(screenFlowMembership.get(item.id) ?? []).map(({ title }) => title)}
          />
        );
      })()}
      <ScrollToTopButton />
    </>
  );
}
