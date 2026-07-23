import type { CSSProperties } from 'react';
import { Button, Divider, Heading, Text } from '@astryxdesign/core';

type RoadmapStatus = 'building' | 'shipped' | 'next' | 'exploring';

interface RoadmapItemData {
  status: RoadmapStatus;
  date: string;
  title: string;
  description: string;
  evidence?: readonly string[];
}

const ROADMAP_ITEMS: readonly RoadmapItemData[] = [
  {
    status: 'building',
    date: 'July 2026',
    title: 'Product polish and production hardening',
    description: 'Improving reliability, responsive behavior, catalog presentation, and the path from evidence to a developer-ready artifact.',
    evidence: ['Current focus'],
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Flow-to-feature developer handoff',
    description: 'Turned observed product flows into reviewable feature documents with evidence navigation, revision state, export, and read-only sharing.',
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Design-system reconstruction',
    description: 'Made imported and reconstructed systems explorable through specimens, tokens, components, variants, usage guidance, and source material.',
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Full catalog crawl',
    description: 'Completed the current catalog pass and made its scale visible across apps, screens, and UI elements.',
    evidence: ['465 apps', '137K+ screens', '647 UI elements'],
  },
  {
    status: 'shipped',
    date: 'July 2026',
    title: 'Evidence and catalog foundation',
    description: 'Established versioned Apps, Screens, UI Elements, Flows, protected media, search, collections, and evidence-aware publication boundaries.',
  },
  {
    status: 'next',
    date: 'Next',
    title: 'Public launch and feedback loop',
    description: 'Finish the public-facing experience, validate the production launch path, and establish a deliberate channel for learning from early users.',
  },
  {
    status: 'exploring',
    date: 'Later',
    title: 'Collaborative research and integrations',
    description: 'Explore shared evidence comparisons, decision trails, team handoff, and external integrations after the core public workflow is stable.',
  },
];

const STATUS: Record<RoadmapStatus, { label: string; color: string; soft: string }> = {
  building: { label: 'Building now', color: '#2f64e9', soft: 'rgba(47,100,233,0.12)' },
  shipped: { label: 'Shipped', color: '#16845b', soft: 'rgba(22,132,91,0.12)' },
  next: { label: 'Up next', color: '#b26400', soft: 'rgba(178,100,0,0.12)' },
  exploring: { label: 'Exploring', color: '#7a55c5', soft: 'rgba(122,85,197,0.12)' },
};

const SNAPSHOT = [
  { value: '465', label: 'apps' },
  { value: '137K+', label: 'screens' },
  { value: '647', label: 'UI elements' },
] as const;

const page: CSSProperties = { minHeight: '100vh', color: 'var(--color-text-primary)', overflowX: 'hidden' };
const wrap: CSSProperties = { width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 24px' };
const navLink: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' };

function RoadmapItem({ item }: { item: RoadmapItemData }) {
  const status = STATUS[item.status];
  return (
    <li className="bip-timeline-item" style={{ position: 'relative' }}>
      <div className="bip-date" style={{ paddingTop: 4 }}>
        <Text type="supporting" color="secondary">{item.date}</Text>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 'var(--bip-dot-left)', top: 9, width: 13, height: 13,
          borderRadius: 999, background: status.color, border: '3px solid var(--color-background-body)',
          boxShadow: `0 0 0 1px ${status.color}`,
        }}
      />
      <article
        style={{
          padding: '24px 26px', border: '1px solid var(--color-border)', borderRadius: 20,
          background: 'var(--color-background-card, var(--color-background-surface))', boxShadow: 'var(--shadow-low)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: status.soft, color: status.color, fontSize: 12, lineHeight: 1.2, fontWeight: 700 }}>
            {status.label}
          </span>
          <Text type="supporting" color="secondary">{item.date}</Text>
        </div>
        <Heading level={3}>{item.title}</Heading>
        <div style={{ marginTop: 9, maxWidth: 680 }}>
          <Text type="body" color="secondary">{item.description}</Text>
        </div>
        {item.evidence && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {item.evidence.map((evidence) => (
              <span key={evidence} style={{ padding: '6px 9px', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-background-muted)' }}>
                {evidence}
              </span>
            ))}
          </div>
        )}
      </article>
    </li>
  );
}

export function BuildInPublicPage({ onHome, onBrowse, onPricing }: {
  onHome: () => void;
  onBrowse: () => void;
  onPricing: () => void;
}) {
  return (
    <div style={page}>
      <style>{`
        .bip-timeline { --bip-dot-left: 136px; }
        .bip-timeline::before { content: ''; position: absolute; top: 10px; bottom: 28px; left: 142px; width: 1px; background: var(--color-border); }
        .bip-timeline-item { display: grid; grid-template-columns: 112px minmax(0, 1fr); column-gap: 58px; padding-bottom: 24px; }
        .bip-timeline-item article > div:first-child > span:last-child { display: none; }
        @media (max-width: 680px) {
          .bip-public-nav-secondary { display: none !important; }
          .bip-timeline { --bip-dot-left: 0px; padding-left: 26px !important; }
          .bip-timeline::before { left: 6px; }
          .bip-timeline-item { display: block; padding-bottom: 18px; }
          .bip-timeline-item .bip-date { display: none; }
          .bip-timeline-item article > div:first-child > span:last-child { display: inline; }
          .bip-timeline-item article { padding: 21px 20px !important; }
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
          <div aria-hidden="true" style={{ position: 'absolute', width: 560, height: 360, top: -70, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(59,110,246,0.17), transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ ...wrap, position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-background-card, var(--color-background-surface))', marginBottom: 24 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#2f64e9', boxShadow: '0 0 0 4px rgba(47,100,233,0.12)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>BUILD IN PUBLIC</span>
            </div>
            <Heading level={1} type="display-1">Building the design intelligence workspace in the open</Heading>
            <div style={{ maxWidth: 660, margin: '20px auto 0' }}>
              <Text type="large" color="secondary">Follow what Astryx has shipped, what we are improving now, and where the product may go next.</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
              <Button label="Browse the library" variant="primary" size="lg" onClick={onBrowse} />
              <Button label="See pricing" variant="secondary" size="lg" onClick={onPricing} />
            </div>
            <div style={{ marginTop: 18 }}><Text type="supporting" color="secondary">Last updated July 23, 2026</Text></div>
          </div>
        </section>

        <section aria-labelledby="snapshot-heading" style={{ ...wrap, paddingBottom: 88 }}>
          <div style={{ padding: '26px 28px', borderRadius: 24, border: '1px solid var(--color-border)', background: 'var(--color-background-card, var(--color-background-surface))', boxShadow: 'var(--shadow-low)' }}>
            <div style={{ marginBottom: 22 }}>
              <Heading id="snapshot-heading" level={2}>Current catalog snapshot</Heading>
              <div style={{ marginTop: 6 }}><Text type="supporting" color="secondary">Completed-crawl figures, maintained alongside this roadmap.</Text></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {SNAPSHOT.map((stat) => (
                <div key={stat.label} style={{ padding: '20px', borderRadius: 16, background: 'var(--color-background-muted)', minWidth: 0 }}>
                  <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{stat.value}</div>
                  <div style={{ marginTop: 7 }}><Text type="supporting" color="secondary">{stat.label}</Text></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="roadmap-heading" style={{ ...wrap, paddingBottom: 104 }}>
          <div style={{ maxWidth: 620, marginBottom: 42 }}>
            <Text type="supporting" color="secondary">THE ROAD AHEAD</Text>
            <div style={{ marginTop: 8 }}><Heading id="roadmap-heading" level={2}>From evidence to confident product decisions</Heading></div>
            <div style={{ marginTop: 10 }}><Text type="body" color="secondary">Shipped work is available today. Future entries describe intent, not a delivery promise.</Text></div>
          </div>
          <ol className="bip-timeline" style={{ position: 'relative', listStyle: 'none', padding: 0, margin: 0 }}>
            {ROADMAP_ITEMS.map((item) => <RoadmapItem key={`${item.status}-${item.title}`} item={item} />)}
          </ol>
        </section>

        <section style={{ background: '#171717' }}>
          <div style={{ ...wrap, paddingTop: 68, paddingBottom: 68, textAlign: 'center' }}>
            <Heading level={2}><span style={{ color: '#fff' }}>The useful parts are already here.</span></Heading>
            <div style={{ maxWidth: 540, margin: '12px auto 26px' }}><Text type="body"><span style={{ color: '#a1a1aa' }}>Explore real product evidence while we keep improving the path from reference to decision to handoff.</span></Text></div>
            <Button label="Browse the library" variant="primary" size="lg" onClick={onBrowse} style={{ background: '#fff', color: '#18181b' }} />
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
