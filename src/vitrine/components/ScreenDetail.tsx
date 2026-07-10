import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Icon, Spinner } from '@astryxdesign/core';
import type { App } from '../types';
import { useDesignSystem } from '../useDesignSystem';
import { ComponentsPanel } from './ComponentsPanel';
import { FlowsPanel } from './FlowsPanel';
import { HeroButton } from './HeroButton';
import { Lightbox } from './Lightbox';
import { ScreenGridCard } from './ScreenGridCard';

const DesignSystemPanel = lazy(() =>
  import('./DesignSystemPanel').then((module) => ({ default: module.DesignSystemPanel })),
);

type Section = 'screens' | 'elements' | 'flows' | 'design-system';
type LightboxState = { index: number } | null;

interface ScreenDetailProps {
  app: App;
  onBack: () => void;
}

export function ScreenDetail({ app, onBack }: ScreenDetailProps) {
  const screens = app.screens;
  const count = screens.length;
  const { snapshot, status: designSystemStatus } = useDesignSystem(app.id);
  const components = snapshot?.components ?? [];
  const flows = snapshot?.flows ?? [];

  const [section, setSection] = useState<Section>('screens');
  const [typeFilter, setTypeFilter] = useState('All');
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  const types = Array.from(new Set(screens.map((s) => s.type)));
  const typeCounts = (t: string) => (t === 'All' ? count : screens.filter((s) => s.type === t).length);
  const filtered = typeFilter === 'All' ? screens : screens.filter((s) => s.type === typeFilter);

  const tabRefs = useRef<Record<Section, HTMLButtonElement | null>>({
    screens: null,
    elements: null,
    flows: null,
    'design-system': null,
  });
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstTabRender = useRef(true);

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
      <div style={{ background: '#121214' }}>
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
              color: '#a1a1aa',
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
              background: app.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>
          </motion.div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              margin: '0 0 24px',
              lineHeight: 1.05,
              animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .05s both',
            }}
          >
            {app.app}
          </h1>
          <div style={{ display: 'flex', gap: 40, marginBottom: 28, flexWrap: 'wrap', animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both' }}>
            {([['Platform', 'Web'], ['Category', app.cat], ['Screens', String(app.totalScreens)]] as const).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#8b8b93', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .15s both' }}>
            <HeroButton primary>Save</HeroButton>
            <HeroButton>Visit site</HeroButton>
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .2s both',
            }}
          >
            {(
              [
                ['screens', 'Screens'],
                ['elements', 'UI Elements'],
                ['flows', 'Flows'],
                ['design-system', 'Design System'],
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
                  color: section === id ? '#fff' : '#8b8b93',
                  padding: '0 0 14px',
                  transition: 'color .15s ease',
                }}
              >
                {label}
              </button>
            ))}
            <div
              ref={indicatorRef}
              style={{ position: 'absolute', bottom: -1, left: 0, height: 2, background: '#fff', borderRadius: 1, pointerEvents: 'none' }}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: '#8b8b93', paddingBottom: 14 }}>
              {section === 'design-system'
                ? 'Design system document'
                : section === 'screens'
                ? `Showing ${filtered.length}${app.totalScreens > count ? ` of ${app.totalScreens}` : ''} screens`
                : section === 'elements'
                  ? `${components.length} components`
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
                      border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.16)'}`,
                      background: active ? '#fff' : 'rgba(255,255,255,0.06)',
                      color: active ? '#18181b' : '#d4d4d8',
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
                        background: active ? 'rgba(24,24,27,0.12)' : 'rgba(255,255,255,0.12)',
                        color: active ? '#18181b' : '#a1a1aa',
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
                : section === 'elements' || section === 'design-system'
                  ? '8px 40px 80px'
                  : '32px 40px 80px',
          }}
        >
          {section === 'design-system' ? (
            <Suspense fallback={<Spinner size="lg" />}>
              <DesignSystemPanel snapshot={snapshot} status={designSystemStatus} />
            </Suspense>
          ) : section === 'flows' ? (
            <FlowsPanel flows={flows} />
          ) : section === 'screens' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
              {filtered.map((s) => {
                const i = screens.indexOf(s);
                const delay = Math.min(i * 0.04, 0.32);
                return (
                  <ScreenGridCard key={i} screen={s} accent={app.accent} delay={delay} onOpen={() => setLightbox({ index: i })} />
                );
              })}
            </div>
          ) : <ComponentsPanel components={components} />}
        </div>
      </div>

      {lightbox !== null &&
        (() => {
          const lbItem = screens[lightbox.index];
          return (
            <Lightbox
              item={{ url: lbItem.url, type: lbItem.type, caption: lbItem.description ?? lbItem.type }}
              index={lightbox.index}
              total={screens.length}
              onClose={() => setLightbox(null)}
              onNavigate={goLightbox}
            />
          );
        })()}
    </motion.div>
  );
}
