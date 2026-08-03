import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const TYPE_ROLES = [
  {
    name: 'Title',
    className: 'vitrine-type-title',
    specimen: 'Aboard',
    spec: '18–20 / 26 / 600',
    use: 'App identity and dialog titles',
  },
  {
    name: 'Action',
    className: 'vitrine-type-action',
    specimen: 'Save · Copy image',
    spec: '16 / 22 / 600 · +0.2',
    use: 'Prominent action labels',
  },
  {
    name: 'Heading',
    className: 'vitrine-type-heading',
    specimen: 'Aboard screen',
    spec: '15 / 22.5 / 700',
    use: 'Information panels and compact section headings',
  },
  {
    name: 'Body',
    className: 'vitrine-type-body',
    specimen: 'Web',
    spec: '14 / 18.2 / 400',
    use: 'Default product copy and metadata',
  },
  {
    name: 'Label',
    className: 'vitrine-type-label',
    specimen: 'More info',
    spec: '14 / 20 / 600 · +0.2',
    use: 'Controls, tabs, inputs, and emphasized context',
  },
  {
    name: 'Detail',
    className: 'vitrine-type-detail',
    specimen: 'Web · Screen information',
    spec: '13 / 18.85 / 400',
    use: 'Information-panel detail and dense secondary copy',
  },
  {
    name: 'Supporting',
    className: 'vitrine-type-supporting',
    specimen: 'Last updated 10 minutes ago',
    spec: '12 / 16 / 400',
    use: 'Counts, timestamps, captions, and helper text',
  },
  {
    name: 'Micro',
    className: 'vitrine-type-micro',
    specimen: 'BETA',
    spec: '11 / 16 / 500',
    use: 'Compact badges only',
  },
  {
    name: 'Code',
    className: 'vitrine-type-code',
    specimen: 'flow.screen_id',
    spec: '13 / 20 / 400',
    use: 'Technical values and identifiers',
  },
] as const;

const panel: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
};

const meta = {
  title: 'Foundations/Typography',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Figtree is the Vitrines product family. The rendered App Screen detail dialog supplies the compact title, action, information, control, metadata, and detail hierarchy used across product UI.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {
  render: () => (
    <main style={{ display: 'grid', gap: 32, maxWidth: 1120, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        <span className="vitrine-type-label" style={{ color: 'var(--color-text-secondary)' }}>
          FOUNDATION 02 · TYPOGRAPHY
        </span>
        <h1 className="vitrine-type-title" style={{ margin: 0 }}>
          App Screen detail is the product typography standard.
        </h1>
        <p className="vitrine-type-body" style={{ maxWidth: 680, margin: 0, color: 'var(--color-text-secondary)' }}>
          Nine compact roles replace page-specific font choices. Large editorial type stays in the presentation layer instead of inflating everyday product UI.
        </p>
      </header>

      <section style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div style={{ display: 'grid', gap: 8, padding: 20 }}>
          <span className="vitrine-type-supporting" style={{ color: 'var(--color-text-secondary)' }}>PRODUCT FAMILY</span>
          <strong className="vitrine-type-heading">Figtree</strong>
          <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>
            400 Regular · 500 Medium · 600 SemiBold · 700 Bold
          </span>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: 20, borderInlineStart: '1px solid var(--color-border)' }}>
          <span className="vitrine-type-supporting" style={{ color: 'var(--color-text-secondary)' }}>TECHNICAL FAMILY</span>
          <strong className="vitrine-type-code">SF Mono · Monaco · Consolas</strong>
          <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>
            Reserved for identifiers, code, and machine values.
          </span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 12 }}>
        {TYPE_ROLES.map((role) => (
          <article key={role.name} style={{ ...panel, minWidth: 0, display: 'grid', gap: 20, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <strong className="vitrine-type-label">{role.name}</strong>
              <code className="vitrine-type-code" style={{ color: 'var(--color-text-secondary)' }}>{role.spec}</code>
            </div>
            <div className={role.className} style={{ overflowWrap: 'anywhere' }}>{role.specimen}</div>
            <p className="vitrine-type-detail" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{role.use}</p>
          </article>
        ))}
      </section>
    </main>
  ),
};

export const ProductHierarchy: Story = {
  name: 'App Screen detail anatomy',
  render: () => (
    <article style={{ ...panel, position: 'relative', minHeight: 560, maxWidth: 880, margin: '0 auto', overflow: 'hidden' }}>
      <header style={{ display: 'flex', minHeight: 88, alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '0 24px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-background-muted)' }} />
          <strong className="vitrine-type-title">Aboard</strong>
        </div>
        <span className="vitrine-type-label">Copy link · Close</span>
      </header>
      <div style={{ minHeight: 380, margin: 24, borderRadius: 'var(--radius-element)', background: 'var(--color-background-muted)' }} />
      <aside style={{ ...panel, position: 'absolute', right: 24, bottom: 92, width: 250, display: 'grid', gap: 7, padding: 16 }}>
        <strong className="vitrine-type-heading">Aboard screen</strong>
        <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>Web</span>
      </aside>
      <div style={{ position: 'absolute', left: '50%', bottom: 28, display: 'flex', alignItems: 'center', gap: 8, transform: 'translateX(-50%)' }}>
        <span className="vitrine-type-action" style={{ padding: '11px 20px', borderRadius: 999, background: 'var(--vitrine-color-action-primary)', color: 'var(--vitrine-color-on-action-primary)' }}>Save</span>
        <span className="vitrine-type-action" style={{ padding: '11px 20px', borderRadius: 999, background: 'var(--color-background-muted)' }}>Copy image</span>
      </div>
      <div style={{ position: 'absolute', right: 24, bottom: 28, display: 'grid', justifyItems: 'end', gap: 4 }}>
        <span className="vitrine-type-body" style={{ color: 'var(--color-text-secondary)' }}>Web</span>
        <span className="vitrine-type-label">More info</span>
      </div>
    </article>
  ),
};
