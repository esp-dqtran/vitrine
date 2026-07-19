import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Button, EmptyState, Icon, Selector, Spinner, ToggleButton } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db';
import type { Platform } from '../../platformFromUrl';
import { PLATFORM_LABEL } from '../../platformFromUrl';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { AppMetadata, Screen } from '../types';
import { useAppSectionData, type DetailSection } from '../useAppSectionData';
import { useDesignSystem } from '../useDesignSystem';
import { useSlidingIndicator } from '../useSlidingIndicator';
import { AppOverviewPanel } from './AppOverviewPanel';
import { CuratorReviewPanel } from './CuratorReviewPanel';
import { ExportPanel } from './ExportPanel';
import { FlowsPanel } from './FlowsPanel';
import { HeroButton } from './HeroButton';
import { Lightbox } from './Lightbox';
import { ScreenGridCard } from './ScreenGridCard';
import { ScrollToTopButton } from './ScrollToTopButton';
import { VersionPanel } from './VersionPanel';

const DesignSystemPanel = lazy(() =>
  import('./DesignSystemPanel').then((module) => ({ default: module.DesignSystemPanel })),
);

type LightboxState = { index: number } | null;
const SECTIONS: DetailSection[] = ['overview', 'screens', 'elements', 'flows', 'design-system', 'export', 'review'];

const resolveSection = (initialSection: string | undefined, role: 'admin' | 'user'): DetailSection => {
  const allowed = initialSection === 'review' ? role === 'admin' : SECTIONS.includes(initialSection as DetailSection);
  return (allowed ? initialSection : 'overview') as DetailSection;
};

interface ScreenDetailProps {
  app: AppMetadata;
  onBack: () => void;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  role: 'admin' | 'user';
  initialSection?: string;
  onSectionChange?: (section: DetailSection) => void;
}

export function ScreenDetail({ app, onBack, role, initialSection, onSectionChange }: ScreenDetailProps) {
  const appPlatforms = (app.platforms ?? []).filter(
    (platform): platform is Platform => platform === 'ios' || platform === 'android' || platform === 'web',
  );
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(appPlatforms[0] ?? 'web');
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [section, setSectionState] = useState<DetailSection>(() => resolveSection(initialSection, role));
  useEffect(() => setSectionState(resolveSection(initialSection, role)), [initialSection, role]);
  const setSection = (next: DetailSection) => {
    setSectionState(next);
    onSectionChange?.(next);
  };

  const sectionData = useAppSectionData({
    appId: app.id,
    activeSection: section,
    platform: selectedPlatform,
    selectedVersion,
  });
  const needsDesignSystem = section === 'design-system' || section === 'export' || section === 'review';
  const { snapshot, status: designSystemStatus, error: designSystemError, retry: retryDesignSystem, invalidate: invalidateDesignSystem } = useDesignSystem(
    app.id,
    selectedPlatform,
    sectionData.resolvedVersion,
    needsDesignSystem && !sectionData.versionsLoading,
  );

  const evidence = sectionData.state.data && 'screens' in sectionData.state.data
    ? sectionData.state.data
    : null;
  const screens = evidence?.screens ?? [];
  const flows = sectionData.state.data && 'flows' in sectionData.state.data
    ? sectionData.state.data.flows
    : [] as DesignFlow<EvidenceView>[];
  const nextCursor = evidence?.nextCursor ?? null;
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [layoutFilter, setLayoutFilter] = useState('All');
  const [componentFilter, setComponentFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const platformTabRefs = useRef<Partial<Record<Platform, HTMLButtonElement>>>({});
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

  const { indicatorRef, registerItem: registerTab } = useSlidingIndicator<DetailSection>(section);

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

  const sectionLoading = sectionData.versionsLoading || sectionData.state.status === 'loading' || (needsDesignSystem && designSystemStatus === 'loading');
  const sectionError = sectionData.state.status === 'error' ? sectionData.state.error : null;
  const renderEvidence = (items: Screen[], emptyTitle: string) => items.length ? (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: section === 'elements' ? 'repeat(auto-fill,minmax(200px,1fr))' : 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
        {(section === 'screens' ? filtered : items).map((screen, index) => (
          <ScreenGridCard
            key={screen.id}
            screen={screen}
            accent={app.accent}
            delay={Math.min(index * 0.04, 0.32)}
            onOpen={() => setLightbox({ index: screens.indexOf(screen) })}
          />
        ))}
      </div>
      {nextCursor && <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>{loadingMore && <Spinner size="sm" />}</div>}
    </>
  ) : <EmptyState title={emptyTitle} isCompact />;

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
      <div style={{ background: 'var(--color-background-surface)' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '22px 40px 0' }}>
          <Button label="Back to all apps" icon={<Icon icon="chevronLeft" size="sm" />} variant="ghost" size="sm" onClick={onBack} style={{ borderRadius: 8, marginBottom: 28 }} />
          <motion.div
            layoutId={`app-icon-${app.id}`}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 88, height: 88, borderRadius: 22, background: app.iconUrl ? 'transparent' : app.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden', position: 'relative' }}
          >
            {app.iconUrl
              ? <img src={app.iconUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>}
          </motion.div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: '0 0 24px', lineHeight: 1.05 }}>{app.app}</h1>
          <div style={{ display: 'flex', gap: 40, marginBottom: 28, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Platform</span>
              <div role="tablist" aria-label="Platform" style={{ display: 'inline-flex', gap: 2, padding: 3, border: '1px solid var(--color-border)', borderRadius: 999, background: 'var(--color-background-muted)' }}>
                {(appPlatforms.length ? appPlatforms : [selectedPlatform]).map((platform, index, platforms) => (
                  <div key={platform} role="presentation" style={{ position: 'relative' }}>
                    {platform === selectedPlatform && <motion.div layoutId="platform-active-indicator" transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.6 }} style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--color-background-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.18)', pointerEvents: 'none' }} />}
                    <ToggleButton
                      ref={(node) => { platformTabRefs.current[platform] = node ?? undefined; }}
                      label={PLATFORM_LABEL[platform]}
                      isPressed={platform === selectedPlatform}
                      onPressedChange={() => selectPlatform(platform)}
                      role="tab"
                      aria-pressed={undefined}
                      aria-selected={platform === selectedPlatform}
                      aria-label={PLATFORM_LABEL[platform]}
                      tabIndex={platform === selectedPlatform ? 0 : -1}
                      onKeyDown={(event) => {
                        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                        const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? platforms.length - 1 : offset ? (index + offset + platforms.length) % platforms.length : -1;
                        if (targetIndex < 0) return;
                        event.preventDefault();
                        const nextPlatform = platforms[targetIndex];
                        selectPlatform(nextPlatform);
                        platformTabRefs.current[nextPlatform]?.focus();
                      }}
                      size="sm"
                      style={{ position: 'relative', zIndex: 1, border: 'none', borderRadius: 999, background: 'transparent' }}
                    />
                  </div>
                ))}
              </div>
            </div>
            {([['Category', app.cat], ['Screens', String(app.totalScreens)]] as const).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            <HeroButton primary onClick={() => setSection('export')}>Export to Figma</HeroButton>
            {app.websiteUrl && <HeroButton onClick={() => window.open(app.websiteUrl!, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28, borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
            {([
              ['overview', 'Overview'], ['screens', 'Screens'], ['elements', 'UI Elements'], ['flows', 'Flows'],
              ['design-system', 'Design System'], ['export', 'Export'], ...(role === 'admin' ? [['review', 'Review'] as const] : []),
            ] as const).map(([id, label]) => (
              <ToggleButton key={id} ref={registerTab(id)} label={label} isPressed={section === id} onPressedChange={() => setSection(id)} size="sm" style={{ background: 'none', border: 'none', color: section === id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', padding: '0 0 14px', flexShrink: 0, whiteSpace: 'nowrap' }} />
            ))}
            <div ref={indicatorRef} style={{ position: 'absolute', bottom: -1, left: 0, height: 2, background: 'var(--color-text-primary)', borderRadius: 1, pointerEvents: 'none' }} />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingBottom: 14 }}>
              {section === 'screens' ? `${screens.length} screens` : section === 'elements' ? `${screens.length} UI elements` : section === 'flows' ? `${flows.length} flows` : ''}
            </span>
          </div>
          {section === 'screens' && types.length > 1 && <div style={{ display: 'flex', gap: 8, padding: '16px 0', flexWrap: 'wrap' }}>{['All', ...types].map((type) => <ToggleButton key={type} label={type} isPressed={typeFilter === type} onPressedChange={() => setTypeFilter(type)} size="sm" />)}</div>}
          {section === 'screens' && <div style={{ display: 'flex', gap: 8, padding: '16px 0', flexWrap: 'wrap' }}>{([
            ['Layout', layoutFilter, setLayoutFilter, layouts], ['Component', componentFilter, setComponentFilter, screenComponents], ['State', stateFilter, setStateFilter, states],
          ] as Array<[string, string, (value: string) => void, string[]]>).map(([label, value, change, options]) => options.length ? <Selector key={label} label={label} size="sm" value={value} onChange={change} options={['All', ...options]} /> : null)}</div>}
        </div>
      </div>

      <div style={{ background: section === 'screens' ? 'var(--color-background-body)' : 'var(--color-background-surface)', minHeight: 400 }}>
        <div ref={contentRef} style={{ maxWidth: 1360, margin: '0 auto', padding: section === 'screens' ? '32px 40px 72px' : '8px 40px 80px' }}>
          {section !== 'overview' && sectionData.versions !== null && (
            <VersionPanel
              app={app.id}
              platform={selectedPlatform}
              role={role}
              versions={sectionData.versions}
              selectedVersion={sectionData.resolvedVersion}
              onVersionsChange={(items) => {
                if (sectionData.resolvedVersion !== undefined) sectionData.invalidateVersion(selectedPlatform, sectionData.resolvedVersion);
                invalidateDesignSystem();
                sectionData.setVersions(items);
              }}
              onSelect={setSelectedVersion}
            />
          )}
          {section === 'overview' ? <AppOverviewPanel app={app} />
            : sectionError || (needsDesignSystem && designSystemStatus === 'error') ? <div role="alert"><EmptyState title="Could not load this section" description={sectionError?.message ?? designSystemError?.message} actions={<Button label="Retry" clickAction={() => void (sectionError ? sectionData.retry() : retryDesignSystem())} />} /></div>
              : sectionLoading ? <div role="status" aria-label="Loading section" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
                : section === 'review' ? <CuratorReviewPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} />
                  : section === 'design-system' ? <Suspense fallback={<Spinner size="lg" />}><DesignSystemPanel snapshot={snapshot} status={designSystemStatus} /></Suspense>
                    : section === 'export' ? <ExportPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} screens={screens} />
                      : section === 'flows' ? (flows.length ? <FlowsPanel flows={flows} app={app.id} platform={selectedPlatform} /> : <EmptyState title="No flows captured" isCompact />)
                        : renderEvidence(screens, section === 'elements' ? 'No UI elements captured' : 'No screens captured')}
        </div>
      </div>

      {lightbox && screens[lightbox.index] && (() => {
        const item = screens[lightbox.index];
        return <Lightbox item={{ url: item.url, type: item.type, caption: item.description ?? item.type, platform: item.platform }} index={lightbox.index} total={screens.length} onClose={() => setLightbox(null)} onNavigate={goLightbox} />;
      })()}
      <ScrollToTopButton />
    </motion.div>
  );
}
