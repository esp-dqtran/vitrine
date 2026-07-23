import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button, Divider, DropdownMenu, Heading, Icon, Text, ToggleButton, useMediaQuery } from '@astryxdesign/core';
import { PlaceholderImage } from './components/PlaceholderImage';
import { useFloatDrift } from './useFloatDrift';
import { useRevealOnScroll } from './useRevealOnScroll';
import { useSlidingIndicator } from './useSlidingIndicator';

const wrap: CSSProperties = { maxWidth: 1160, margin: '0 auto', padding: '0 32px' };

function Section({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <div style={{ ...wrap, ...style }}>{children}</div>;
}

// ---------- hero icon mark (layered, floating above the headline) ----------
function HeroIconStack() {
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  useFloatDrift(backRef, { rotate: -9, dx: 8, dy: 14, rswing: 5, duration: 6.4, delay: -1.6 });
  useFloatDrift(frontRef, { dx: 8, dy: 14, rswing: 4, duration: 6.4 });
  return (
    <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto', animation: 'hmFadeUp .55s cubic-bezier(.16,1,.3,1) both' }}>
      <div
        ref={backRef}
        style={{ position: 'absolute', inset: 6, borderRadius: 24, background: 'var(--color-background-muted)', willChange: 'transform' }}
      />
      <div
        ref={frontRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 26,
          background: 'linear-gradient(155deg,#4c7cf9,#2955d8)',
          boxShadow: '0 18px 34px rgba(41,85,216,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          willChange: 'transform',
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', transform: 'rotate(-12deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.18)' }} />
      </div>
    </div>
  );
}

// ---------- app icon marquee (original glyphs — no third-party logos) ----------
function Glyph({ paths, size }: { paths: ReactNode; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#fff" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}

// Decorative glyphs — only the six the floating StatsBlock still uses.
const GLYPHS: Record<string, (s: number) => ReactNode> = {
  coin: (s) => <Glyph size={s} paths={<><circle cx={12} cy={12} r={7.5} /><path d="M12 8.2v7.6 M9.7 14.3c0 1.1 1 1.7 2.3 1.7s2.3-.6 2.3-1.6-1-1.4-2.3-1.7-2.3-.7-2.3-1.7 1-1.6 2.3-1.6 2.1.5 2.2 1.4" /></>} />,
  terminal: (s) => <Glyph size={s} paths={<><path d="M6.5 9l3.5 3-3.5 3" /><path d="M13 15h5" /></>} />,
  swatch: (s) => <Glyph size={s} paths={<><circle cx={9.5} cy={10} r={3.6} /><circle cx={14.8} cy={14} r={3.6} /></>} />,
  wave: (s) => <Glyph size={s} paths={<path d="M4 13h2.5l2-5 3 10 2.5-13 2 8h3.5" />} />,
  radar: (s) => <Glyph size={s} paths={<><circle cx={12} cy={12} r={2} /><circle cx={12} cy={12} r={5.5} strokeOpacity={0.55} /><circle cx={12} cy={12} r={9} strokeOpacity={0.3} /></>} />,
  layers: (s) => <Glyph size={s} paths={<><path d="M12 4.5l7.5 4L12 12.5l-7.5-4z" /><path d="M4.5 12.5L12 16.5l7.5-4" /><path d="M4.5 16.5L12 20.5l7.5-4" /></>} />,
};

interface IconItem {
  name: string;
  color: string;
  // Simple Icons slug — the SVG is served from jsDelivr and tinted white via CSS.
  slug: string;
}

// Real app logos via the Simple Icons CDN (brand marks belong to their owners).
const FEATURED_ICONS: IconItem[][] = [
  [
    { name: 'Linear', color: '#5E6AD2', slug: 'linear' },
    { name: 'Notion', color: '#000000', slug: 'notion' },
    { name: 'Spotify', color: '#1DB954', slug: 'spotify' },
    { name: 'Figma', color: '#F24E1E', slug: 'figma' },
    { name: 'Slack', color: '#4A154B', slug: 'slack' },
    { name: 'Airbnb', color: '#FF5A5F', slug: 'airbnb' },
  ],
  [
    { name: 'Netflix', color: '#E50914', slug: 'netflix' },
    { name: 'Stripe', color: '#635BFF', slug: 'stripe' },
    { name: 'Discord', color: '#5865F2', slug: 'discord' },
    { name: 'Duolingo', color: '#58CC02', slug: 'duolingo' },
    { name: 'Dropbox', color: '#0061FF', slug: 'dropbox' },
    { name: 'Uber', color: '#000000', slug: 'uber' },
  ],
  [
    { name: 'Pinterest', color: '#BD081C', slug: 'pinterest' },
    { name: 'Twitch', color: '#9146FF', slug: 'twitch' },
    { name: 'Reddit', color: '#FF4500', slug: 'reddit' },
    { name: 'Asana', color: '#F06A6A', slug: 'asana' },
    { name: 'GitHub', color: '#181717', slug: 'github' },
    { name: 'Framer', color: '#0055FF', slug: 'framer' },
  ],
];

function MarqueeRow({ items, duration, reverse }: { items: IconItem[]; duration: number; reverse?: boolean }) {
  const doubled = items.concat(items);
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      {/* marginRight (not flex gap) keeps the doubled strip perfectly periodic so translateX(-50%) lands on the seam without a jump */}
      <div style={{ display: 'flex', width: 'max-content', animation: `hmMarqueeL ${duration}s linear infinite`, animationDirection: reverse ? 'reverse' : 'normal' }}>
        {doubled.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto', marginRight: 48 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', boxShadow: 'var(--shadow-low)' }}>
              <img src={`https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${it.slug}.svg`} alt="" width={28} height={28} loading="lazy" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{it.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconMarquee() {
  return (
    <div style={{ position: 'relative', WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <MarqueeRow items={FEATURED_ICONS[0]} duration={34} />
      <MarqueeRow items={FEATURED_ICONS[1]} duration={40} reverse />
      <MarqueeRow items={FEATURED_ICONS[2]} duration={30} />
    </div>
  );
}

// ---------- stats block ----------
// ponytail: headline figures are marketing copy, not live counts — update by hand.
const STATS = [
  { n: '465', label: 'apps' },
  { n: '137K+', label: 'screens' },
  { n: '647', label: 'UI elements' },
];
const STAT_ICONS = [
  { glyph: 'coin', color: '#3b6ef6', size: 44, top: '4%', left: '8%', dur: 5.6, delay: -1.2, rotate: -6, rswing: 8 },
  { glyph: 'wave', color: '#d94f4f', size: 34, top: '10%', right: '10%', dur: 4.6, delay: -3.1, rotate: 5, rswing: 7 },
  { glyph: 'terminal', color: '#18181b', size: 38, top: '62%', left: '4%', dur: 6.2, delay: -2.0, rotate: -4, rswing: 6 },
  { glyph: 'swatch', color: '#e0518a', size: 36, top: '66%', right: '6%', dur: 5.1, delay: -0.6, rotate: 7, rswing: 9 },
  { glyph: 'radar', color: '#0891b2', size: 30, top: '36%', left: '16%', dur: 7.0, delay: -4.2, rotate: -8, rswing: 5 },
  { glyph: 'layers', color: '#7c3aed', size: 32, top: '40%', right: '18%', dur: 5.4, delay: -1.8, rotate: 6, rswing: 8 },
];

function FloatIcon({ ic }: { ic: (typeof STAT_ICONS)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  useFloatDrift(ref, { rotate: ic.rotate, dx: Math.round(ic.size * 0.3), dy: 16, rswing: ic.rswing, duration: ic.dur, delay: ic.delay });
  return (
    <div
      ref={ref}
      style={{ position: 'absolute', top: ic.top, left: ic.left, right: ic.right, width: ic.size, height: ic.size, borderRadius: Math.round(ic.size * 0.28), background: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 22px rgba(0,0,0,0.14)', willChange: 'transform' }}
    >
      {GLYPHS[ic.glyph](Math.round(ic.size * 0.44))}
    </div>
  );
}

// Counts up from 0 to the number embedded in `value` (e.g. "160+") the first time
// it scrolls into view, then leaves the authored string (suffix and all) in place.
function CountUpNumber({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const match = value.match(/^(\d+)(.*)$/);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !match) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = parseInt(match[1], 10);
    const suffix = match[2];
    const counter = { n: 0 };
    el.textContent = `0${suffix}`;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(counter, {
        n: target,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = `${Math.round(counter.n)}${suffix}`; },
      }),
    });
    return () => trigger.kill();
  }, [match?.[0]]);

  return <div ref={ref} style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>{value}</div>;
}

function StatsBlock() {
  return (
    <div style={{ position: 'relative', textAlign: 'center', padding: '32px 20px' }}>
      {STAT_ICONS.map((ic, i) => <FloatIcon key={i} ic={ic} />)}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Text type="large" color="secondary">A growing library of</Text>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 44, marginTop: 14, flexWrap: 'wrap' }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <CountUpNumber value={s.n} />
              <div style={{ fontSize: 14, color: 'var(--color-text-disabled)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- "find patterns" tabbed feature section ----------
const PATTERN_TABS = [
  { key: 'screens', label: 'Screens', desc: 'Every key screen of the app, captured as it actually looks — not a redraw.', images: [{ seed: 'ledgerly-2', placeholder: 'Checkout' }, { seed: 'beacon-1', placeholder: 'Reports' }, { seed: 'palette-1', placeholder: 'Editor' }] },
  { key: 'elements', label: 'UI elements', desc: 'Buttons, forms, cards and empty states, isolated so you can study them on their own.', images: [{ seed: 'home-el-1', placeholder: 'Primary button' }, { seed: 'home-el-2', placeholder: 'Stat card' }, { seed: 'home-el-3', placeholder: 'Empty state' }] },
  { key: 'flows', label: 'Flows', desc: 'Full user journeys, step by step — onboarding, checkout, upgrade, and more.', images: [{ seed: 'home-flow-1', placeholder: 'Splash Screen' }, { seed: 'home-flow-2', placeholder: 'Signup' }, { seed: 'home-flow-3', placeholder: 'Home' }] },
  { key: 'tokens', label: 'Tokens & evidence', desc: 'The color, spacing and type decisions behind the screen, reconstructed and cited.', images: [{ seed: 'home-inside-tokens', placeholder: 'Tokens & evidence' }] },
];

function PatternTabs() {
  const [active, setActive] = useState('screens');
  const tab = PATTERN_TABS.find((t) => t.key === active)!;
  const { indicatorRef, registerItem } = useSlidingIndicator(active, { wraps: true });
  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 28, padding: 5, background: 'var(--color-background-muted)', borderRadius: 999, width: 'fit-content' }}>
        <div ref={indicatorRef} style={{ position: 'absolute', top: 0, left: 0, borderRadius: 999, background: 'var(--color-text-primary)', pointerEvents: 'none' }} />
        {PATTERN_TABS.map((t) => (
          <ToggleButton
            key={t.key}
            ref={registerItem(t.key)}
            label={t.label}
            isPressed={active === t.key}
            onPressedChange={() => setActive(t.key)}
            style={{
              position: 'relative',
              borderRadius: 999,
              background: 'transparent',
              // The indicator behind this pill is --color-text-primary, so the active label
              // has to invert or it renders in its own background colour (1:1 contrast).
              // Passing children as well as `label` is what makes this colour stick — the
              // label prop alone is styled by the design system and ignores it. Matches
              // FilterChips, which already does exactly this.
              color: active === t.key ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
              transition: 'color .12s ease',
            }}
          >
            {t.label}
          </ToggleButton>
        ))}
      </div>
      <div style={{ marginBottom: 24, maxWidth: 520 }}>
        <Text type="body" color="secondary">{tab.desc}</Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
        {tab.images.map((img) => (
          <div key={img.seed} style={{ position: 'relative', aspectRatio: tab.images.length === 1 ? '16/9' : '4/3', borderRadius: 'var(--radius-container)', overflow: 'hidden', background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-low)' }}>
            <PlaceholderImage seed={img.seed} />
          </div>
        ))}
      </div>
    </div>
  );
}

const navLink: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' };

export function Home({ onBrowse, onPricing, onBuildInPublic, onLogin }: {
  onBrowse: () => void;
  onPricing: () => void;
  onBuildInPublic: () => void;
  onLogin: () => void;
}) {
  const isCompactNav = useMediaQuery('(max-width: 640px)', false);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const patternsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(marqueeRef);
  useRevealOnScroll(patternsRef);
  useRevealOnScroll(statsRef);
  useRevealOnScroll(ctaRef);
  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text-primary)' }}>
      {/* header — glass pill nav */}
      <div
        style={{
          position: 'sticky',
          top: 20,
          zIndex: 10,
          margin: '20px auto 0',
          maxWidth: 1096,
          width: 'calc(100% - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          padding: '11px 12px 11px 22px',
          borderRadius: 999,
          background: 'light-dark(rgba(255,255,255,0.55), rgba(31,31,34,0.65))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid light-dark(rgba(255,255,255,0.6), rgba(255,255,255,0.1))',
          boxShadow: 'light-dark(0 8px 30px rgba(24,24,27,0.08), 0 8px 30px rgba(0,0,0,0.4)), inset 0 1px 0 light-dark(rgba(255,255,255,0.5), rgba(255,255,255,0.06))',
        }}
      >
        <Button type="button" label="Vitrine" variant="ghost" onClick={onBrowse} icon={<span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#FFFFFF' }} /></span>} style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }} />
        {isCompactNav ? (
          <DropdownMenu
            button={{ label: 'Menu', icon: <Icon icon="menu" />, isIconOnly: true, variant: 'ghost', size: 'sm' }}
            items={[
              { label: 'Browse', onClick: onBrowse },
              { label: 'Pricing', onClick: onPricing },
              { label: 'Build in public', onClick: onBuildInPublic },
              { label: 'Log in', onClick: onLogin },
            ]}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 34, flex: '0 0 auto' }}>
            <Button label="Browse" variant="ghost" onClick={onBrowse} style={navLink} />
            <Button label="Pricing" variant="ghost" onClick={onPricing} style={navLink} />
            <Button label="Build in public" variant="ghost" onClick={onBuildInPublic} style={navLink} />
            <Button label="Log in" variant="ghost" onClick={onLogin} style={navLink} />
          </div>
        )}
      </div>

      {/* hero */}
      <Section style={{ padding: '80px 32px 0', textAlign: 'center' }}>
        <HeroIconStack />
        <div style={{ marginTop: 28, animation: 'hmFadeUp .5s cubic-bezier(.16,1,.3,1) .05s both' }}>
          <Heading level={1} type="display-1">Discover real design, reconstructed.</Heading>
        </div>
        <div style={{ margin: '20px auto 0', maxWidth: 520, animation: 'hmFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both' }}>
          <Text type="large" color="secondary">Real screens, real flows, real decisions —</Text>
          <br />
          <Text type="large" color="secondary">reconstructed from the apps you already use.</Text>
        </div>
      </Section>

      {/* app icon marquee */}
      <div ref={marqueeRef} style={{ padding: '96px 0 88px' }}>
        <IconMarquee />
      </div>

      {/* find patterns (tabbed) */}
      <div ref={patternsRef} style={{ background: 'var(--color-background-card, var(--color-background-surface))', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <Section style={{ padding: '80px 32px' }}>
          <div style={{ maxWidth: 560, marginBottom: 40 }}>
            <Heading level={2}>Find design patterns in seconds</Heading>
            <div style={{ marginTop: 8 }}>
              <Text type="body" color="secondary">Not just a screenshot — the full anatomy of the product.</Text>
            </div>
          </div>
          <PatternTabs />
        </Section>
      </div>

      {/* stats block */}
      <Section style={{ padding: '56px 32px 24px' }}>
        <div ref={statsRef}>
          <StatsBlock />
        </div>
      </Section>

      {/* final CTA band */}
      <div ref={ctaRef} style={{ background: '#171717' }}>
        <Section style={{ padding: '72px 32px', textAlign: 'center' }}>
          <Heading level={2}><span style={{ color: '#fff' }}>Start studying the apps you admire.</span></Heading>
          <div style={{ margin: '12px auto 28px', maxWidth: 460 }}>
            <Text type="large"><span style={{ color: '#a1a1aa' }}>Free to browse. No card required to unlock your first 3 apps.</span></Text>
          </div>
          <Button variant="primary" size="lg" label="Start browsing free" clickAction={onLogin} style={{ background: '#fff', color: '#18181b' }} />
        </Section>
      </div>

      {/* footer */}
      <Section style={{ padding: '40px 32px 48px' }}>
        <Divider />
        <div style={{ paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Text type="supporting" color="secondary">Vitrine · a research library of observed application design systems.</Text>
          <div style={{ display: 'flex', gap: 20 }}>
            <Button label="Browse" variant="ghost" size="sm" onClick={onBrowse} style={{ ...navLink, fontSize: 13 }} />
            <Button label="Pricing" variant="ghost" size="sm" onClick={onPricing} style={{ ...navLink, fontSize: 13 }} />
            <Button label="Build in public" variant="ghost" size="sm" onClick={onBuildInPublic} style={{ ...navLink, fontSize: 13 }} />
            <Button label="Sign in" variant="ghost" size="sm" onClick={onLogin} style={{ ...navLink, fontSize: 13 }} />
          </div>
        </div>
      </Section>
    </div>
  );
}
