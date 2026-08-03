import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  FONT_SIZES,
  RADIUS,
  SPACING,
  css,
  cssShare,
  libraryByCategory,
  library,
  mono,
  nonDS,
  rawTotal,
  tokenGroupsRanked,
  tokenNames,
  tokenShare,
  total,
} from './designSystemData';
import { FOUNDATION_TOKEN_CONTRACT } from '../vitrine/uiFoundationStandard';

const foundationTokenCount = Object.values(FOUNDATION_TOKEN_CONTRACT).flat().length;

const meta = {
  title: 'Design System',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The single source of truth for Vitrines UI. Every number on this page is read live from the token module, the story files and the app source — nothing here is hand-maintained.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const page: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-12)',
  padding: 'var(--spacing-8)',
  fontFamily: 'var(--font-family-body)',
  color: 'var(--color-text-primary)',
};

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 650, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        padding: 'var(--spacing-5)',
        borderRadius: 'var(--radius-container)',
        border: 'var(--border-width) solid var(--color-border)',
        background: 'var(--color-background-surface)',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{label}</div>
    </div>
  );
}

const KEY_COLORS = [
  ['--color-accent', 'Accent'],
  ['--color-background-body', 'Body'],
  ['--color-background-surface', 'Surface'],
  ['--color-background-muted', 'Muted'],
  ['--color-border', 'Border'],
  ['--color-text-primary', 'Text primary'],
  ['--color-text-secondary', 'Text secondary'],
];

export const Overview: Story = {
  render: () => (
    <div style={page}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 650,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Vitrines Design System
        </div>
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-5xl)', fontWeight: 700, letterSpacing: '-0.03em' }}>
          One system, {foundationTokenCount} foundation roles, {library.length} components.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            maxWidth: '70ch',
          }}
        >
          Everything below is read live from <code style={{ fontFamily: mono }}>@astryxdesign/core</code> and the
          app source. If a number looks wrong, the code is wrong — not this page.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--spacing-4)' }}>
        <Stat value={String(foundationTokenCount)} label="Public foundation roles" />
        <Stat value={String(library.length)} label="Documented components" />
        <Stat value={`${total.files - total.noDS}/${total.files}`} label="App components on the system" />
        <Stat value="2" label="Themes (light / dark)" />
      </div>

      <Section
        title="Color"
        note="Semantic, never literal. Every swatch resolves through the theme — flip the toolbar Theme switch and watch them adapt. A hex in application code cannot do this."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--spacing-4)' }}>
          {KEY_COLORS.map(([token, label]) => (
            <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <div
                style={{
                  height: 'var(--spacing-12)',
                  borderRadius: 'var(--radius-element)',
                  background: `var(${token})`,
                  border: 'var(--border-width) solid var(--color-border)',
                }}
              />
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: mono, color: 'var(--color-text-secondary)' }}>
                  {token}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing" note="A 15-step scale. Every gap, pad and margin comes from here.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {SPACING.filter(([px]) => px > 0).map(([px, token]) => (
            <div key={token} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
              <div style={{ width: 110, fontSize: 'var(--font-size-sm)', fontFamily: mono, color: 'var(--color-text-secondary)' }}>
                {token.replace('--spacing-', '')}
              </div>
              <div style={{ height: 'var(--spacing-3)', width: px, background: 'var(--color-accent)', borderRadius: 'var(--radius-inner)' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{px}px</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radius" note="Five meaningful steps plus a pill. Inner nests inside element, element inside container.">
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
          {RADIUS.filter(([px]) => px !== 9999).map(([, token]) => (
            <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', alignItems: 'center' }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: `var(${token})`,
                  background: 'var(--color-background-muted)',
                  border: 'var(--border-width) solid var(--color-border)',
                }}
              />
              <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: mono, color: 'var(--color-text-secondary)' }}>
                {token.replace('--radius-', '')}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="One family, twelve sizes. Anything off this ramp is a bug.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {[...FONT_SIZES].reverse().map((size) => (
            <div key={size} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-4)' }}>
              <div style={{ width: 110, fontSize: 'var(--font-size-sm)', fontFamily: mono, color: 'var(--color-text-secondary)' }}>
                {size}
              </div>
              <div style={{ fontSize: `var(--font-size-${size})`, lineHeight: 1.2 }}>
                The quick brown fox
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Implementation token inventory"
        note={`${tokenNames.length} implementation tokens across ${tokenGroupsRanked.length} groups. Product screens use the smaller public contract documented under Foundations/Standards; charts, syntax, and imported evidence keep their domain palettes private.`}
      >
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          {tokenGroupsRanked.map(([group, names]) => (
            <div
              key={group}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--spacing-2)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-full)',
                border: 'var(--border-width) solid var(--color-border)',
                background: 'var(--color-background-surface)',
                fontSize: 'var(--font-size-base)',
              }}
            >
              <span style={{ fontFamily: mono }}>--{group}</span>
              <span style={{ fontWeight: 700 }}>{names.length}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Component library"
        note={`${library.length} components documented across ${Object.keys(libraryByCategory).length} categories. If you are about to build UI, check here first — it probably already exists.`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 'var(--spacing-4)' }}>
          {Object.entries(libraryByCategory)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([category, names]) => (
              <div
                key={category}
                style={{
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-container)',
                  border: 'var(--border-width) solid var(--color-border)',
                  background: 'var(--color-background-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-2)' }}>
                  <strong style={{ fontSize: 'var(--font-size-base)' }}>{category}</strong>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{names.length}</span>
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  {names.sort().join(', ')}
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section
        title="Adoption"
        note={`The system is complete. Getting the app onto it is the open work — ${nonDS.length} components still hand-roll UI, and ${css.loc.toLocaleString()} lines of app CSS run beside the tokens. Full breakdown under Foundations → Component Audit.`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Bar label={`Components (.tsx) — ${rawTotal} raw values`} share={tokenShare} />
          <Bar label={`Stylesheets (.css) — ${css.raw.toLocaleString()} raw values`} share={cssShare} />
        </div>
      </Section>

      <Section title="The rules" note="Four of them. They are the whole system.">
        <ol style={{ margin: 0, paddingLeft: '1.2em', fontSize: 'var(--font-size-base)', lineHeight: 2 }}>
          <li>Use a component from the library before writing markup.</li>
          <li>Use a token before writing a value. No hex, no raw px.</li>
          <li>Colors are semantic — pick by role (<code style={{ fontFamily: mono }}>--color-text-secondary</code>), never by appearance.</li>
          <li>If nothing fits, add it to the system — not to a stylesheet.</li>
        </ol>
      </Section>
    </div>
  ),
};

function Bar({ label, share }: { label: string; share: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>{label}</div>
      <div
        style={{
          display: 'flex',
          height: 'var(--spacing-6)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          border: 'var(--border-width) solid var(--color-border)',
        }}
      >
        <div
          style={{
            width: `${share}%`,
            background: 'var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {share >= 12 ? `tokens ${share}%` : ''}
        </div>
        <div
          style={{
            flex: 1,
            background: 'var(--color-background-muted)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          raw {100 - share}%
        </div>
      </div>
    </div>
  );
}
