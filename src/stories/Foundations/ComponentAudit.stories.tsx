import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  RADIUS,
  css,
  cssRows,
  cssShare,
  mono,
  nearest,
  nonDS,
  rawTotal,
  rows,
  skipped,
  spacingToken,
  stylesheets,
  tokenShare,
  total,
} from '../designSystemData';

const meta = {
  title: 'Foundations/Component Audit',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Where the app has drifted off the design system. Sources are read at runtime, so this never goes stale — fix a file, refresh, watch the number drop. The headline figures live on the Design System page.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const cell: React.CSSProperties = {
  padding: 'var(--spacing-2) var(--spacing-3)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  textAlign: 'left',
  verticalAlign: 'top',
};

const page: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-8)',
  padding: 'var(--spacing-6)',
  fontFamily: 'var(--font-family-body)',
  color: 'var(--color-text-primary)',
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 650 }}>{title}</h2>
        {note && (
          <p
            style={{
              margin: 'var(--spacing-1) 0 0',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              maxWidth: '68ch',
            }}
          >
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export const Summary: Story = {
  render: () => (
    <div style={page}>
      <Section
        title="Drift at a glance"
        note={`${total.files} app components and ${css.files} stylesheets scanned. Components sit at ${tokenShare}% tokens (${rawTotal} raw values); stylesheets at ${cssShare}% (${css.raw.toLocaleString()} raw values).`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 'var(--spacing-4)' }}>
          {[
            [`${total.files - total.noDS}/${total.files}`, 'Components on the system', `${nonDS.length} still hand-roll UI`],
            [String(total.px), 'Hardcoded px in .tsx', 'should be --spacing / --radius'],
            [String(total.hex), 'Hardcoded hex in .tsx', 'should be --color-*'],
            [String(total.inline), 'Inline style objects', 'no variants, no theming'],
            [css.loc.toLocaleString(), 'Lines of app CSS', `${css.rules.toLocaleString()} rules beside the tokens`],
          ].map(([value, label, sub]) => (
            <div
              key={label}
              style={{
                padding: 'var(--spacing-4)',
                borderRadius: 'var(--radius-container)',
                border: 'var(--border-width) solid var(--color-border)',
                background: 'var(--color-background-card)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{label}</div>
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 650 }}>{value}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};

export const NotUsingTheDesignSystem: Story = {
  name: 'Not using the design system',
  render: () => (
    <div style={page}>
      <Section
        title={`${nonDS.length} components render UI without importing @astryxdesign/core`}
        note={`Each hand-rolls markup that the design system already covers. ${skipped.length} more files import nothing either, but render no DOM at all (providers, hooks, pure composition) — they are correctly excluded, not targets.`}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              <th style={cell}>Component</th>
              <th style={cell}>LOC</th>
              <th style={cell}>HTML elements</th>
              <th style={cell}>className</th>
              <th style={cell}>Inline styles</th>
            </tr>
          </thead>
          <tbody>
            {nonDS.map((r) => (
              <tr key={r.file}>
                <td style={{ ...cell, fontFamily: mono }}>{r.file}</td>
                <td style={cell}>{r.loc}</td>
                <td style={cell}>{r.host}</td>
                <td style={cell}>{r.classes}</td>
                <td style={cell}>{r.inline}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {skipped.length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Excluded as non-visual: {skipped.map((r) => r.file).join(', ')}
          </p>
        )}
      </Section>
    </div>
  ),
};

export const WorstOffenders: Story = {
  name: 'Worst offenders',
  render: () => (
    <div style={page}>
      <Section
        title="Files with the most hardcoded values"
        note="Ranked by raw px + hex. The marketing pages dominate — they were built before the token set existed."
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              <th style={cell}>Component</th>
              <th style={cell}>Raw</th>
              <th style={cell}>Tokens</th>
              <th style={cell}>Inline</th>
              <th style={cell}>Uses DS</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 25).map((r) => {
              const raw = r.px.length + r.hex.length;
              return (
                <tr key={r.file}>
                  <td style={{ ...cell, fontFamily: mono }}>{r.file}</td>
                  <td style={{ ...cell, fontWeight: 650, color: raw > 20 ? 'var(--color-text-error)' : undefined }}>
                    {raw}
                  </td>
                  <td style={cell}>{r.tokens}</td>
                  <td style={cell}>{r.inline}</td>
                  <td style={cell}>{r.usesDS ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  ),
};

export const Stylesheets: Story = {
  render: () => (
    <div style={page}>
      <Section
        title={`${css.loc.toLocaleString()} lines of app CSS across ${cssRows.length} files`}
        note={`${css.rules.toLocaleString()} rules, only ${cssShare}% of styling values are tokens. This is a second, undocumented design system — every rule here is a component that was never built.`}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              <th style={cell}>Stylesheet</th>
              <th style={cell}>LOC</th>
              <th style={cell}>Rules</th>
              <th style={cell}>Raw px</th>
              <th style={cell}>Raw hex</th>
              <th style={cell}>Tokens</th>
              <th style={cell}>Token share</th>
            </tr>
          </thead>
          <tbody>
            {cssRows.map((r) => {
              const share = Math.round((r.tokens / (r.tokens + r.px + r.hex || 1)) * 100);
              return (
                <tr key={r.file}>
                  <td style={{ ...cell, fontFamily: mono }}>{r.file}</td>
                  <td style={cell}>{r.loc.toLocaleString()}</td>
                  <td style={cell}>{r.rules}</td>
                  <td style={cell}>{r.px}</td>
                  <td style={cell}>{r.hex}</td>
                  <td style={cell}>{r.tokens}</td>
                  <td style={{ ...cell, fontWeight: 650, color: share < 25 ? 'var(--color-text-error)' : undefined }}>
                    {share}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  ),
};

export const PixelsToTokens: Story = {
  name: 'Pixels → tokens',
  render: () => {
    const counts = new Map<number, number>();
    const add = (p: string) => {
      const n = parseInt(p, 10);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    };
    rows.forEach((r) => r.px.forEach(add));
    Object.values(stylesheets).forEach((s) => (s.match(/\b\d+px/g) ?? []).forEach(add));
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);

    return (
      <div style={page}>
        <Section
          title="Every hardcoded pixel value, with its replacement"
          note="Values on the scale are mechanical find-and-replace. Off-scale values are the design decisions worth arguing about — they either round to a token or justify a new one."
        >
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                <th style={cell}>Value</th>
                <th style={cell}>Occurrences</th>
                <th style={cell}>Spacing token</th>
                <th style={cell}>Radius token</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(([px, n]) => {
                const s = spacingToken(px);
                const r = nearest(px, RADIUS);
                return (
                  <tr key={px}>
                    <td style={{ ...cell, fontFamily: mono, fontWeight: 650 }}>{px}px</td>
                    <td style={cell}>{n}</td>
                    <td style={{ ...cell, fontFamily: mono, color: s ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                      {s ?? 'off scale'}
                    </td>
                    <td style={{ ...cell, fontFamily: mono, color: r ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                      {r ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </div>
    );
  },
};

export const ColorsToTokens: Story = {
  name: 'Colors → tokens',
  render: () => {
    const counts = new Map<string, number>();
    const add = (h: string) => {
      const k = h.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    rows.forEach((r) => r.hex.forEach(add));
    Object.values(stylesheets).forEach((s) => (s.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).forEach(add));
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 32);

    return (
      <div style={page}>
        <Section
          title="Every hardcoded hex, ranked"
          note="None of these respond to the theme toggle. Anything appearing more than once is a de-facto token that was never named — pick the closest --color-* and delete the literal."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--spacing-4)' }}>
            {ranked.map(([hex, n]) => (
              <div key={hex} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                <div
                  style={{
                    height: 'var(--spacing-12)',
                    borderRadius: 'var(--radius-element)',
                    background: hex,
                    border: 'var(--border-width) solid var(--color-border)',
                  }}
                />
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: mono, fontWeight: 600 }}>{hex}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {n} use{n > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  },
};
