import type { CSSProperties } from 'react';
import { Button, Divider, Heading, Text } from '@astryxdesign/core';

interface PillarStat { value: string; label: string }
interface PillarItem { date: string; title: string }
interface PillarData {
  step: string;
  name: string;
  color: string;
  soft: string;
  description: string;
  stats: readonly PillarStat[];
  now: string;
  recent: readonly PillarItem[];
}

const PILLARS: readonly PillarData[] = [
  {
    step: '01',
    name: 'Sites + Apps we crawl',
    color: '#2f64e9',
    soft: 'rgba(47,100,233,0.12)',
    description: 'Real products captured as evidence, screen by screen.',
    stats: [
      { value: '465', label: 'apps' },
      { value: '137K+', label: 'screens' },
    ],
    now: 'Deepening site capture and coverage',
    recent: [
      { date: 'Jul 27', title: 'Site analysis and deployment pipeline evolved' },
      { date: 'Jul 25', title: 'Captured App previews served publicly' },
      { date: 'Jul 23', title: 'Full catalog crawl pass completed' },
    ],
  },
  {
    step: '02',
    name: 'Data we analyze',
    color: '#7a55c5',
    soft: 'rgba(122,85,197,0.12)',
    description: 'Raw captures become structured design intelligence: flows, elements, design systems.',
    stats: [
      { value: '647', label: 'UI elements' },
    ],
    now: 'Normalizing flows into a browsable hierarchy',
    recent: [
      { date: 'Jul 27', title: 'Hierarchical flows normalized' },
      { date: 'Jul 26', title: 'Published Sites indexed for search' },
      { date: 'Jul 25', title: 'Taxonomy preview pools cached' },
    ],
  },
  {
    step: '03',
    name: 'Features we build',
    color: '#16845b',
    soft: 'rgba(22,132,91,0.12)',
    description: 'The evidence surfaces in the product as features you can use today.',
    stats: [
      { value: 'Daily', label: 'shipping cadence' },
    ],
    now: 'Unifying discovery across Apps, Sites, and Flows',
    recent: [
      { date: 'Jul 27', title: 'Category management for the catalog' },
      { date: 'Jul 26', title: 'Scoped search across Apps and Sites' },
      { date: 'Jul 25', title: 'Live category hover previews' },
    ],
  },
];

const AHEAD = [
  { label: 'Up next', color: '#b26400', soft: 'rgba(178,100,0,0.12)', title: 'Public launch and feedback loop', description: 'Finish the public-facing experience, validate the launch path, and open a deliberate channel for early users.' },
  { label: 'Exploring', color: '#7a55c5', soft: 'rgba(122,85,197,0.12)', title: 'Collaborative research and integrations', description: 'Shared evidence comparisons, decision trails, team handoff, and external integrations once the core is stable.' },
] as const;

const page: CSSProperties = { minHeight: '100vh', color: 'var(--color-text-primary)', overflowX: 'hidden' };
const wrap: CSSProperties = { width: '100%', maxWidth: 1120, margin: '0 auto', padding: '0 24px' };
const navLink: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' };

function Connector({ color }: { color: string }) {
  return (
    <div aria-hidden="true" className="bip-connector">
      <span className="bip-connector-dot" style={{ background: color }} />
      <span className="bip-connector-dot" style={{ background: color }} />
      <span className="bip-connector-dot" style={{ background: color }} />
    </div>
  );
}

function Pillar({ pillar, index }: { pillar: PillarData; index: number }) {
  return (
    <article
      className="bip-pillar"
      aria-labelledby={`pillar-${pillar.step}`}
      style={{
        animationDelay: `${index * 140}ms`,
        position: 'relative', overflow: 'hidden',
        padding: '26px 26px 22px', border: '1px solid var(--color-border)', borderRadius: 22,
        background: 'var(--color-background-surface)', boxShadow: 'var(--shadow-low)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: pillar.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ padding: '4px 9px', borderRadius: 999, background: pillar.soft, color: pillar.color, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>{pillar.step}</span>
        <Heading id={`pillar-${pillar.step}`} level={3}>{pillar.name}</Heading>
      </div>
      <Text type="body" color="secondary">{pillar.description}</Text>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {pillar.stats.map((stat) => (
          <div key={stat.label} style={{ flex: '1 1 120px', padding: '16px 18px', borderRadius: 14, background: 'var(--color-background-muted)', minWidth: 0 }}>
            <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{stat.value}</div>
            <div style={{ marginTop: 6 }}><Text type="supporting" color="secondary">{stat.label}</Text></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 12, border: `1px solid ${pillar.soft}`, background: pillar.soft }}>
        <span aria-hidden="true" className="bip-live-dot" style={{ width: 7, height: 7, borderRadius: 999, background: pillar.color, flexShrink: 0, '--bip-pulse-color': pillar.soft } as CSSProperties} />
        <span style={{ fontSize: 13, fontWeight: 600, color: pillar.color }}>{pillar.now}</span>
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
        {pillar.recent.map((item, itemIndex) => (
          <li key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0', borderTop: itemIndex === 0 ? 'none' : '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.date}</span>
            <Text type="supporting" color="secondary">{item.title}</Text>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function BuildInPublicPage({ onHome, onBrowse, onPricing }: {
  onHome: () => void;
  onBrowse: () => void;
  onPricing: () => void;
}) {
  return (
    <div className="vitrine-page" style={page}>
      <style>{`
        @keyframes bip-fade-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes bip-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(47,100,233,0.4); } 60% { box-shadow: 0 0 0 7px rgba(47,100,233,0); } }
        @keyframes bip-breathe { 0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.12); } }
        @keyframes bip-drift { to { transform: translate(var(--bip-dx), var(--bip-dy)); } }
        @keyframes bip-travel { 0% { left: -7px; opacity: 0; } 14% { opacity: 1; } 86% { opacity: 1; } 100% { left: calc(100% + 1px); opacity: 0; } }
        @keyframes bip-travel-y { 0% { top: -7px; opacity: 0; } 14% { opacity: 1; } 86% { opacity: 1; } 100% { top: calc(100% + 1px); opacity: 0; } }
        .bip-hero-glow { animation: bip-breathe 7s ease-in-out infinite; }
        .bip-live-dot { animation: bip-pulse 1.8s ease-out infinite; }
        .bip-particle { position: absolute; border-radius: 999px; background: rgba(59,110,246,0.45); pointer-events: none; animation: bip-drift var(--bip-t) ease-in-out infinite alternate; }
        .bip-pillar { animation: bip-fade-up 0.6s ease both; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .bip-pillar:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(0,0,0,0.14); }
        .bip-flow { display: grid; grid-template-columns: 1fr 48px 1fr 48px 1fr; align-items: stretch; }
        .bip-connector { position: relative; align-self: center; height: 2px; background: var(--color-border); }
        .bip-connector-dot { position: absolute; top: -2.5px; left: -7px; width: 7px; height: 7px; border-radius: 999px; animation: bip-travel 2.4s linear infinite; }
        .bip-connector-dot:nth-child(2) { animation-delay: 0.8s; }
        .bip-connector-dot:nth-child(3) { animation-delay: 1.6s; }
        .bip-ahead-card { animation: bip-fade-up 0.6s ease both; }
        @media (max-width: 920px) {
          .bip-flow { grid-template-columns: minmax(0, 1fr); }
          .bip-connector { width: 2px; height: 44px; margin: 0 auto; align-self: auto; justify-self: center; }
          .bip-connector-dot { top: -7px; left: -2.5px; animation-name: bip-travel-y; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bip-pillar, .bip-ahead-card, .bip-live-dot, .bip-hero-glow, .bip-particle { animation: none; }
          .bip-connector-dot { display: none; }
          .bip-pillar:hover { transform: none; }
        }
        @media (max-width: 680px) {
          .bip-public-nav-secondary { display: none !important; }
        }
      `}</style>

      <header style={{ ...wrap, paddingTop: 20 }}>
        <nav aria-label="Public navigation" style={{ minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '9px 10px 9px 16px', border: '1px solid var(--color-border)', borderRadius: 999, background: 'color-mix(in srgb, var(--color-background-body) 86%, transparent)', backdropFilter: 'blur(18px)', position: 'relative', zIndex: 2 }}>
          <Button type="button" label="Vitrine" variant="ghost" onClick={onHome} icon={<span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#fff' }} /></span>} style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="bip-public-nav-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Button label="Pricing" variant="ghost" onClick={onPricing} style={navLink} />
            </div>
            <Button label="Browse" variant="primary" onClick={onBrowse} />
          </div>
        </nav>
      </header>

      <main>
        <section style={{ position: 'relative', padding: '104px 0 72px', textAlign: 'center' }}>
          <div aria-hidden="true" className="bip-hero-glow" style={{ position: 'absolute', width: 560, height: 360, top: -70, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(59,110,246,0.17), transparent 68%)', pointerEvents: 'none' }} />
          <div aria-hidden="true">
            <span className="bip-particle" style={{ width: 6, height: 6, top: 60, left: '26%', '--bip-dx': '34px', '--bip-dy': '-26px', '--bip-t': '9s' } as CSSProperties} />
            <span className="bip-particle" style={{ width: 4, height: 4, top: 150, left: '18%', '--bip-dx': '-24px', '--bip-dy': '30px', '--bip-t': '11s' } as CSSProperties} />
            <span className="bip-particle" style={{ width: 5, height: 5, top: 90, right: '22%', '--bip-dx': '-30px', '--bip-dy': '22px', '--bip-t': '8s' } as CSSProperties} />
            <span className="bip-particle" style={{ width: 4, height: 4, top: 210, right: '15%', '--bip-dx': '26px', '--bip-dy': '-32px', '--bip-t': '12s' } as CSSProperties} />
          </div>
          <div style={{ ...wrap, position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', marginBottom: 24 }}>
              <span aria-hidden="true" className="bip-live-dot" style={{ width: 7, height: 7, borderRadius: 999, background: '#2f64e9' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>BUILD IN PUBLIC</span>
            </div>
            <Heading level={1} type="display-1">Building the design intelligence workspace in the open</Heading>
            <div style={{ maxWidth: 660, margin: '20px auto 0' }}>
              <Text type="large" color="secondary">Astryx runs on three engines — crawling real products, analyzing the data, and shipping features. All three move at once, in public.</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
              <Button label="Browse the library" variant="primary" size="lg" onClick={onBrowse} />
              <Button label="See pricing" variant="secondary" size="lg" onClick={onPricing} />
            </div>
            <div style={{ marginTop: 18 }}><Text type="supporting" color="secondary">Last updated July 30, 2026</Text></div>
          </div>
        </section>

        <section aria-labelledby="pipeline-heading" style={{ ...wrap, paddingBottom: 96 }}>
          <div style={{ maxWidth: 620, margin: '0 auto 40px', textAlign: 'center' }}>
            <Text type="supporting" color="secondary">HOW ASTRYX RUNS</Text>
            <div style={{ marginTop: 8 }}><Heading id="pipeline-heading" level={2}>Three engines, one pipeline</Heading></div>
            <div style={{ marginTop: 10 }}><Text type="body" color="secondary">Crawling feeds analysis, analysis feeds the product — and all three run in parallel.</Text></div>
          </div>
          <div className="bip-flow">
            <Pillar pillar={PILLARS[0]} index={0} />
            <Connector color={PILLARS[0].color} />
            <Pillar pillar={PILLARS[1]} index={1} />
            <Connector color={PILLARS[1].color} />
            <Pillar pillar={PILLARS[2]} index={2} />
          </div>
        </section>

        <section aria-labelledby="ahead-heading" style={{ ...wrap, paddingBottom: 104 }}>
          <div style={{ maxWidth: 620, marginBottom: 28 }}>
            <Text type="supporting" color="secondary">THE ROAD AHEAD</Text>
            <div style={{ marginTop: 8 }}><Heading id="ahead-heading" level={2}>Where this is going</Heading></div>
            <div style={{ marginTop: 10 }}><Text type="body" color="secondary">Future entries describe intent, not a delivery promise.</Text></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {AHEAD.map((item, index) => (
              <article key={item.title} className="bip-ahead-card" style={{ animationDelay: `${index * 120}ms`, padding: '22px 24px', border: '1px solid var(--color-border)', borderRadius: 20, background: 'var(--color-background-surface)', boxShadow: 'var(--shadow-low)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ alignSelf: 'flex-start', padding: '5px 9px', borderRadius: 999, background: item.soft, color: item.color, fontSize: 12, lineHeight: 1.2, fontWeight: 700 }}>{item.label}</span>
                <Heading level={3}>{item.title}</Heading>
                <Text type="body" color="secondary">{item.description}</Text>
              </article>
            ))}
          </div>
        </section>

        <section style={{ background: 'var(--color-background-surface)', borderBlock: '1px solid var(--color-border)' }}>
          <div style={{ ...wrap, paddingTop: 68, paddingBottom: 68, textAlign: 'center' }}>
            <Heading level={2}>The useful parts are already here.</Heading>
            <div style={{ maxWidth: 540, margin: '12px auto 26px' }}><Text type="body" color="secondary">Explore real product evidence while we keep improving the path from reference to decision to handoff.</Text></div>
            <Button label="Browse the library" variant="primary" size="lg" onClick={onBrowse} />
          </div>
        </section>
      </main>

      <footer style={{ ...wrap, paddingTop: 36, paddingBottom: 44 }}>
        <Divider />
        <div style={{ paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <Text type="supporting" color="secondary">Vitrine · building Astryx in public.</Text>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Button label="Home" variant="ghost" size="sm" onClick={onHome} style={navLink} />
            <Button label="Pricing" variant="ghost" size="sm" onClick={onPricing} style={navLink} />
            <Button label="Browse" variant="ghost" size="sm" onClick={onBrowse} style={navLink} />
          </div>
        </div>
      </footer>
    </div>
  );
}
