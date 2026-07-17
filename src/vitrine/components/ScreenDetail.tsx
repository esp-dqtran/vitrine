import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Icon, Selector, Spinner } from '@astryxdesign/core';
import type { App } from '../types';
import type { ResearchCollection } from '../../db';
import type { AppVersion } from '../../db';
import { useDesignSystem } from '../useDesignSystem';
import { ComponentsPanel } from './ComponentsPanel';
import { FlowsPanel } from './FlowsPanel';
import { HeroButton } from './HeroButton';
import { Lightbox } from './Lightbox';
import { ScreenGridCard } from './ScreenGridCard';
import { ScrollToTopButton } from './ScrollToTopButton';
import { ExportPanel } from './ExportPanel';
import { VersionPanel } from './VersionPanel';
import { OverviewPanel } from './OverviewPanel';
import { CuratorReviewPanel } from './CuratorReviewPanel';
import { listAppVersions } from '../researchApi';
import { PLATFORM_LABEL, type Platform } from '../../platformFromUrl';

const DesignSystemPanel = lazy(() =>
  import('./DesignSystemPanel').then((module) => ({ default: module.DesignSystemPanel })),
);

type Section = 'overview' | 'screens' | 'elements' | 'flows' | 'design-system' | 'export' | 'review';
type LightboxState = { index: number } | null;

const SECTIONS: Section[] = ['overview', 'screens', 'elements', 'flows', 'design-system', 'export', 'review'];

interface ScreenDetailProps {
  app: App;
  onBack: () => void;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  role: 'admin' | 'user';
  initialSection?: string;
  onSectionChange?: (section: Section) => void;
}

export function ScreenDetail({ app, onBack, role, initialSection, onSectionChange }: ScreenDetailProps) {
  const appPlatforms = [...new Set(app.screens.map((s) => s.platform))].filter(
    (p): p is Platform => p === 'ios' || p === 'android' || p === 'web',
  );
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(appPlatforms[0] ?? 'web');
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>();
  const [versionScreens, setVersionScreens] = useState<App['screens'] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Raw UI Element crops — shown directly (like Screens) until this app has been
  // analyzed into named components; ComponentsPanel takes over once that exists.
  const [elementImages, setElementImages] = useState<App['screens'] | null>(null);
  const [elementsCursor, setElementsCursor] = useState<string | null>(null);
  const [elementsLoadingMore, setElementsLoadingMore] = useState(false);
  const [elementLightbox, setElementLightbox] = useState<LightboxState>(null);
  // Platform is the first-layer filter for the whole screen — scope screens to it
  // up front so every section below (Overview, Screens, Elements, Flows) agrees,
  // even during the brief window before the platform-scoped version fetch resolves.
  const screens = (versionScreens ?? app.screens).filter((s) => s.platform === selectedPlatform);
  const count = screens.length;
  const { snapshot, status: designSystemStatus } = useDesignSystem(app.id, selectedPlatform, selectedVersion);
  const components = snapshot?.components ?? [];
  const flows = snapshot?.flows ?? [];

  const [section, setSectionState] = useState<Section>(() => {
    const allowed = initialSection === 'review' ? role === 'admin' : SECTIONS.includes(initialSection as Section);
    return (allowed ? initialSection : 'overview') as Section;
  });
  const setSection = (next: Section) => {
    setSectionState(next);
    onSectionChange?.(next);
  };
  const [typeFilter, setTypeFilter] = useState('All');
  const [layoutFilter, setLayoutFilter] = useState('All');
  const [componentFilter, setComponentFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  // version arrives explicitly (not read from `selectedVersion` state) so this can run
  // inside `selectVersion` itself, at the exact moment Screens' own version is resolved —
  // matching Screens' fetch-once-version-is-known timing instead of racing it.
  const loadElements = async (version?: number) => {
    const response = await fetch(`/api/apps/${app.id}?platform=${selectedPlatform}&kind=ui_element&${version ? `version=${version}&` : ''}limit=48`);
    if (response.ok) {
      const data = await response.json() as { screens: App['screens']; nextCursor: string | null };
      setElementImages(data.screens);
      setElementsCursor(data.nextCursor);
    }
  };

  const selectVersion = async (version: number) => {
    setSelectedVersion(version);
    setElementImages(null);
    setElementsCursor(null);
    const [response] = await Promise.all([
      fetch(`/api/apps/${app.id}?platform=${selectedPlatform}&version=${version}&limit=48`),
      loadElements(version),
    ]);
    if (response.ok) {
      const data = await response.json() as { screens: App['screens']; nextCursor: string | null };
      setVersionScreens(data.screens);
      setNextCursor(data.nextCursor);
    }
  };

  const loadMoreScreens = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/apps/${app.id}?platform=${selectedPlatform}&${selectedVersion ? `version=${selectedVersion}&` : ''}cursor=${encodeURIComponent(nextCursor)}&limit=48`);
      if (response.ok) {
        const data = await response.json() as { screens: App['screens']; nextCursor: string | null };
        setVersionScreens((prev) => [...(prev ?? app.screens), ...data.screens]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreElements = async () => {
    if (!elementsCursor || elementsLoadingMore) return;
    setElementsLoadingMore(true);
    try {
      const response = await fetch(`/api/apps/${app.id}?platform=${selectedPlatform}&kind=ui_element&${selectedVersion ? `version=${selectedVersion}&` : ''}cursor=${encodeURIComponent(elementsCursor)}&limit=48`);
      if (response.ok) {
        const data = await response.json() as { screens: App['screens']; nextCursor: string | null };
        setElementImages((prev) => [...(prev ?? []), ...data.screens]);
        setElementsCursor(data.nextCursor);
      }
    } finally {
      setElementsLoadingMore(false);
    }
  };

  useEffect(() => {
    listAppVersions(app.id, selectedPlatform).then((items) => {
      setVersions(items);
      const latest = items.find(({ status }) => status === 'published') ?? items[0];
      if (latest) void selectVersion(latest.version_number);
      else {
        setElementImages(null);
        setElementsCursor(null);
        void loadElements();
      }
    }).catch(() => setVersions([]));
  }, [app.id, selectedPlatform]);

  const types = Array.from(new Set(screens.map((s) => s.type)));
  const typeCounts = (t: string) => (t === 'All' ? count : screens.filter((s) => s.type === t).length);
  const layouts = [...new Set(screens.flatMap((screen) => screen.layoutPatterns ?? []))];
  const screenComponents = [...new Set(screens.flatMap((screen) => screen.componentNames ?? []))];
  const states = [...new Set(screens.flatMap((screen) => screen.visibleStates))];
  const filtered = screens.filter((screen) =>
    (typeFilter === 'All' || screen.type === typeFilter)
    && (layoutFilter === 'All' || screen.layoutPatterns?.includes(layoutFilter))
    && (componentFilter === 'All' || screen.componentNames?.includes(componentFilter))
    && (stateFilter === 'All' || screen.visibleStates.includes(stateFilter)));

  const tabRefs = useRef<Record<Section, HTMLButtonElement | null>>({
    overview: null,
    screens: null,
    elements: null,
    flows: null,
    'design-system': null,
    export: null,
    review: null,
  });
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstTabRender = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const elementsSentinelRef = useRef<HTMLDivElement>(null);

  // Fetch the next page of screens as the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    if (section !== 'screens' || !nextCursor) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMoreScreens();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [section, nextCursor, loadingMore, selectedVersion]);

  useEffect(() => {
    if (section !== 'elements' || !elementsCursor) return;
    const sentinel = elementsSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMoreElements();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [section, elementsCursor, elementsLoadingMore, selectedVersion]);

  // Slide the tab underline to whichever tab is active.
  useLayoutEffect(() => {
    const tab = tabRefs.current[section];
    const indicator = indicatorRef.current;
    if (!tab || !indicator) return;
    const target = { x: tab.offsetLeft, width: tab.offsetWidth };
    if (isFirstTabRender.current) {
      gsap.set(indicator, target);
      isFirstTabRender.current = false;
    } else {
      gsap.to(indicator, { ...target, duration: 0.35, ease: 'power3.out' });
    }
  }, [section]);

  // Fade the panel content in on every section change.
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
  }, [section]);

  const goLightbox = (i: number) =>
    setLightbox((lb) => {
      if (!lb) return lb;
      return { index: ((i % count) + count) % count };
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox !== null) {
        if (e.key === 'Escape') setLightbox(null);
        else if (e.key === 'ArrowLeft') goLightbox(lightbox.index - 1);
        else if (e.key === 'ArrowRight') goLightbox(lightbox.index + 1);
      } else if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ background: 'var(--color-background-surface)' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '22px 40px 0' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px 6px 6px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 28,
            }}
          >
            <Icon icon="chevronLeft" size="sm" />
            Back to all apps
          </button>
          <motion.div
            layoutId={`app-icon-${app.id}`}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: app.iconUrl ? 'transparent' : app.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {app.iconUrl
              ? <img src={app.iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>}
          </motion.div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 24px',
              lineHeight: 1.05,
              animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .05s both',
            }}
          >
            {app.app}
          </h1>
          <div style={{ display: 'flex', gap: 40, marginBottom: 28, flexWrap: 'wrap', animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Platform
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(appPlatforms.length ? appPlatforms : [selectedPlatform]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPlatform(p)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '3px 10px',
                      cursor: appPlatforms.length > 1 ? 'pointer' : 'default',
                      font: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      background: p === selectedPlatform ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                      color: p === selectedPlatform ? 'var(--color-background-surface)' : 'var(--color-text-primary)',
                    }}
                  >
                    {PLATFORM_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            {([
              ['Category', app.cat],
              ['Screens', String(app.totalScreens)],
            ] as const).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .15s both' }}>
            <HeroButton primary onClick={() => setSection('export')}>Export to Figma</HeroButton>
            {app.websiteUrl && <HeroButton onClick={() => window.open(app.websiteUrl!, '_blank', 'noopener,noreferrer')}>Visit site</HeroButton>}
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              borderBottom: '1px solid var(--color-border)',
              animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .2s both',
              overflowX: 'auto',
            }}
          >
            {(
              [
                ['overview', 'Overview'],
                ['screens', 'Screens'],
                ['elements', 'UI Elements'],
                ['flows', 'Flows'],
                ['design-system', 'Design System'],
                ['export', 'Export'],
                ...(role === 'admin' ? [['review', 'Review'] as const] : []),
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                type="button"
                onClick={() => {
                  setSection(id);
                }}
                style={{
                  fontFamily: 'inherit',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: section === id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  padding: '0 0 14px',
                  transition: 'color .15s ease',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
            <div
              ref={indicatorRef}
              style={{ position: 'absolute', bottom: -1, left: 0, height: 2, background: 'var(--color-text-primary)', borderRadius: 1, pointerEvents: 'none' }}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingBottom: 14 }}>
              {section === 'overview'
                ? ''
                : section === 'design-system'
                ? 'Design system document'
                : section === 'export'
                  ? 'Editable observed assets'
                : section === 'review'
                  ? 'Curator controls'
                : section === 'screens'
                ? `Showing ${filtered.length}${app.totalScreens > count ? ` of ${app.totalScreens}` : ''} screens`
                : section === 'elements'
                  ? components.length > 0
                    ? `${components.length} components`
                    : `${(elementImages ?? []).length} UI elements`
                  : `${flows.length} flows`}
            </span>
          </div>

          {section === 'screens' && types.length > 1 ? (
            <div style={{ display: 'flex', gap: 8, padding: '16px 0', flexWrap: 'wrap', animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .25s both' }}>
              {['All', ...types].map((t) => {
                const active = typeFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 7px 6px 12px',
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                      color: active ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
                      fontFamily: 'inherit',
                      transition: 'background .18s cubic-bezier(.16,1,.3,1), border-color .18s cubic-bezier(.16,1,.3,1)',
                    }}
                  >
                    {t}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: active ? 'color-mix(in srgb, var(--color-background-surface) 22%, transparent)' : 'var(--color-background-muted)',
                        color: active ? 'inherit' : 'var(--color-text-secondary)',
                      }}
                    >
                      {typeCounts(t)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 16 }} />
          )}
          {section === 'screens' && (
            <div style={{ display: 'flex', gap: 8, padding: '0 0 16px', flexWrap: 'wrap' }}>
              {([
                ['Layout', layoutFilter, setLayoutFilter, layouts],
                ['Component', componentFilter, setComponentFilter, screenComponents],
                ['State', stateFilter, setStateFilter, states],
              ] as Array<[string, string, (value: string) => void, string[]]>).map(([label, value, change, options]) => options.length ? (
                <Selector key={label} label={label} size="sm" value={value} onChange={change} options={['All', ...options]} />
              ) : null)}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: section === 'screens' ? 'var(--color-background-body)' : 'var(--color-background-surface)', minHeight: 400 }}>
        <div
          ref={contentRef}
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding:
              section === 'screens'
                ? '32px 40px 72px'
                : section === 'overview' || section === 'elements' || section === 'design-system' || section === 'export' || section === 'review'
                  ? '8px 40px 80px'
                  : '32px 40px 80px',
          }}
        >
          {section === 'overview' ? (
            <>
              <VersionPanel app={app.id} platform={selectedPlatform} role={role} versions={versions} selectedVersion={selectedVersion} onVersionsChange={setVersions} onSelect={(version) => void selectVersion(version)} />
              <OverviewPanel snapshot={snapshot} screens={screens} />
            </>
          ) : section === 'review' ? (
            <CuratorReviewPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} />
          ) : section === 'design-system' ? (
            <Suspense fallback={<Spinner size="lg" />}>
              <DesignSystemPanel snapshot={snapshot} status={designSystemStatus} />
            </Suspense>
          ) : section === 'export' ? (
            <ExportPanel app={app.id} platform={selectedPlatform} snapshot={snapshot} screens={screens} />
          ) : section === 'flows' ? (
            <FlowsPanel flows={flows} app={app.id} platform={selectedPlatform} />
          ) : section === 'screens' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
                {filtered.map((s) => {
                  const i = screens.indexOf(s);
                  const delay = Math.min(i * 0.04, 0.32);
                  return (
                    <ScreenGridCard key={i} screen={s} accent={app.accent} delay={delay} onOpen={() => setLightbox({ index: i })} />
                  );
                })}
              </div>
              {nextCursor && (
                <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  {loadingMore && <Spinner size="sm" />}
                </div>
              )}
            </>
          ) : components.length > 0 ? (
            <ComponentsPanel components={components} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
                {(elementImages ?? []).map((s, i) => (
                  <ScreenGridCard key={i} screen={s} accent={app.accent} delay={Math.min(i * 0.04, 0.32)} onOpen={() => setElementLightbox({ index: i })} />
                ))}
              </div>
              {elementsCursor && (
                <div ref={elementsSentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  {elementsLoadingMore && <Spinner size="sm" />}
                </div>
              )}
              {elementImages !== null && elementImages.length === 0 && (
                <ComponentsPanel components={components} />
              )}
            </>
          )}
        </div>
      </div>

      {elementLightbox !== null &&
        (() => {
          const items = elementImages ?? [];
          const lbItem = items[elementLightbox.index];
          if (!lbItem) return null;
          return (
            <Lightbox
              item={{ url: lbItem.url, type: lbItem.type, caption: lbItem.description ?? lbItem.type, platform: lbItem.platform }}
              index={elementLightbox.index}
              total={items.length}
              onClose={() => setElementLightbox(null)}
              onNavigate={(i) => setElementLightbox((lb) => {
                if (!lb || items.length === 0) return lb;
                return { index: ((i % items.length) + items.length) % items.length };
              })}
            />
          );
        })()}

      {lightbox !== null &&
        (() => {
          const lbItem = screens[lightbox.index];
          return (
            <Lightbox
              item={{ url: lbItem.url, type: lbItem.type, caption: lbItem.description ?? lbItem.type, platform: lbItem.platform }}
              index={lightbox.index}
              total={screens.length}
              onClose={() => setLightbox(null)}
              onNavigate={goLightbox}
            />
          );
        })()}
      <ScrollToTopButton />
    </motion.div>
  );
}
