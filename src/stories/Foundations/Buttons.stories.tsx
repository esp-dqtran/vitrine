import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { buttonRows, buttons, mono, rawButtonKind } from '../designSystemData';

const meta = {
  title: 'Foundations/Buttons',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every button in Vitrines, rendered from the real components. Anything not on this page is drift. The last story lists the raw `<button>` elements still left in the app and which component each one actually needs.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

const page: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-10)',
  padding: 'var(--spacing-8)',
  fontFamily: 'var(--font-family-body)',
  color: 'var(--color-text-primary)',
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 160,
          flexShrink: 0,
          fontSize: 'var(--font-size-sm)',
          fontFamily: mono,
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  );
}

export const AllVariants: Story = {
  name: 'Variants × sizes',
  render: () => (
    <div style={page}>
      <Section
        title="4 variants × 3 sizes"
        note="The complete matrix. Every button in the product should be one of these twelve — anything else is a one-off."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {SIZES.map((size) => (
            <Row key={size} label={`size="${size}"`}>
              {VARIANTS.map((variant) => (
                <Button key={variant} label={variant} variant={variant} size={size} />
              ))}
            </Row>
          ))}
        </div>
      </Section>

      <Section title="States" note="Disabled and loading are props, never hand-rolled text swaps. isLoading also sets aria-busy.">
        {VARIANTS.map((variant) => (
          <Row key={variant} label={`variant="${variant}"`}>
            <Button label="Default" variant={variant} />
            <Button label="Disabled" variant={variant} isDisabled />
            <Button label="Loading" variant={variant} isLoading />
          </Row>
        ))}
      </Section>
    </div>
  ),
};

export const WithContent: Story = {
  name: 'Icons & content',
  render: () => (
    <div style={page}>
      <Section title="Leading icon" note="Pass `icon` — never place an <svg> beside the label yourself.">
        {VARIANTS.map((variant) => (
          <Row key={variant} label={`variant="${variant}"`}>
            {SIZES.map((size) => (
              <Button key={size} label="Settings" variant={variant} size={size} icon={<Icon icon="wrench" size="sm" />} />
            ))}
          </Row>
        ))}
      </Section>

      <Section title="End content" note="Badges, counts and chevrons go in `endContent`, which inherits the button's text colour.">
        <Row label="endContent">
          <Button label="Messages" endContent={<span>3</span>} />
          <Button label="More" variant="ghost" endContent={<Icon icon="chevronDown" size="sm" />} />
          <Button label="Continue" variant="primary" endContent={<Icon icon="chevronRight" size="sm" />} />
        </Row>
      </Section>

      <Section
        title="As a link"
        note="With `href` the button renders an <a>, so Cmd+click and right-click → open in new tab work natively. A div with onClick cannot do this."
      >
        <Row label="href">
          <Button label="Visit site" variant="primary" href="https://example.com" />
          <Button label="New tab" href="https://example.com" target="_blank" rel="noopener noreferrer" />
          <Button label="Disabled link" href="https://example.com" isDisabled />
        </Row>
      </Section>
    </div>
  ),
};

export const IconOnly: Story = {
  name: 'IconButton',
  render: () => (
    <div style={page}>
      <Section
        title="Icon-only buttons"
        note="Use IconButton, not <Button isIconOnly>. `label` becomes the aria-label — it is required, so an icon-only button can never ship without an accessible name."
      >
        {VARIANTS.map((variant) => (
          <Row key={variant} label={`variant="${variant}"`}>
            {SIZES.map((size) => (
              <IconButton key={size} label={`Close (${size})`} variant={variant} size={size} icon={<Icon icon="close" size="sm" />} />
            ))}
          </Row>
        ))}
        <Row label="states">
          <IconButton label="Settings" icon={<Icon icon="wrench" size="sm" />} />
          <IconButton label="Disabled" icon={<Icon icon="wrench" size="sm" />} isDisabled />
          <IconButton label="Loading" icon={<Icon icon="wrench" size="sm" />} isLoading />
          <IconButton label="With tooltip" tooltip="I have a tooltip" icon={<Icon icon="info" size="sm" />} />
        </Row>
      </Section>
    </div>
  ),
};

export const AppWrappers: Story = {
  name: 'App wrappers',
  render: () => (
    <div style={page}>
      <Section
        title="Wrappers the app adds on top"
        note="Four components in src/vitrine/components wrap the DS button. All of them already delegate to Button or IconButton — they add positioning or a preset, not new styling."
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              <th style={cell}>Wrapper</th>
              <th style={cell}>Wraps</th>
              <th style={cell}>What it adds</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['HeroButton', 'Button', 'Pill radius + wider padding for marketing pages'],
              ['ArrowButton', 'IconButton', 'Absolute positioning inside a carousel'],
              ['CopyButton', 'Button', 'Copy-to-clipboard action with a toast'],
              ['ScrollToTopButton', 'IconButton', 'Fixed position, shows after 400px of scroll'],
            ].map(([name, wraps, adds]) => (
              <tr key={name}>
                <td style={{ ...cell, fontFamily: mono }}>{name}</td>
                <td style={{ ...cell, fontFamily: mono }}>{wraps}</td>
                <td style={cell}>{adds}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          HeroButton's pill shape is the one real gap — it overrides <code style={{ fontFamily: mono }}>borderRadius: 999</code>{' '}
          inline. That wants <code style={{ fontFamily: mono }}>--radius-full</code>, or a `pill` variant on Button.
        </p>
      </Section>
    </div>
  ),
};

const cell: React.CSSProperties = {
  padding: 'var(--spacing-2) var(--spacing-3)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  textAlign: 'left',
  verticalAlign: 'top',
};

export const StillRaw: Story = {
  name: 'Still raw <button>',
  render: () => {
    const remaining = buttonRows.filter((r) => r.raw > 0);
    const byKind = new Map<string, number>();
    remaining.forEach((r) => r.tags.forEach((t) => {
      const k = rawButtonKind(t);
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }));

    return (
      <div style={page}>
        <Section
          title={`${buttons.ds} design-system buttons, ${buttons.raw} raw <button> left`}
          note="Grouped by what each raw button actually needs. Only the ones marked Button are a straight swap — the rest need a different component, or are legitimately bespoke."
        >
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
            {[...byKind.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([kind, n]) => (
                <div
                  key={kind}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-2)',
                    alignItems: 'baseline',
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-full)',
                    border: 'var(--border-width) solid var(--color-border)',
                    background: kind === 'Button' ? 'var(--color-background-muted)' : 'var(--color-background-card)',
                    fontSize: 'var(--font-size-base)',
                  }}
                >
                  <span style={{ fontFamily: mono }}>{kind}</span>
                  <strong>{n}</strong>
                </div>
              ))}
          </div>
        </Section>

        <Section title="By file">
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--font-size-base)' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                <th style={cell}>File</th>
                <th style={cell}>Raw</th>
                <th style={cell}>DS</th>
                <th style={cell}>Needs</th>
              </tr>
            </thead>
            <tbody>
              {remaining.map((r) => (
                <tr key={r.file}>
                  <td style={{ ...cell, fontFamily: mono }}>{r.file}</td>
                  <td style={{ ...cell, fontWeight: 650 }}>{r.raw}</td>
                  <td style={cell}>{r.ds}</td>
                  <td style={{ ...cell, fontSize: 'var(--font-size-sm)' }}>
                    {[...new Set(r.tags.map(rawButtonKind))].join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    );
  },
};
