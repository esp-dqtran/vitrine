import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CONTROL_SIZE_SCALE,
  SPACING_SCALE,
} from '../../vitrine/uiFoundationStandard';

const panel: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
};

const tokenLabel: CSSProperties = {
  color: 'var(--color-text-secondary)',
  overflowWrap: 'anywhere',
};

const meta = {
  title: 'Foundations/Spacing',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact spacing and control-size contract extracted from Vitrines Apps discovery, App detail, and Workspace. Seven public spacing choices cover product composition; the finer internal scale remains an implementation detail.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {
  render: () => (
    <main style={{ display: 'grid', gap: 'var(--spacing-8)', maxWidth: 1120, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 'var(--spacing-3)', maxWidth: 760 }}>
        <span className="vitrine-type-label" style={{ color: 'var(--color-text-secondary)' }}>
          {'FOUNDATION 03 · SPACING & SIZE'}
        </span>
        <h1 className="vitrine-type-title" style={{ margin: 0 }}>
          Seven spacing choices create the Vitrines rhythm.
        </h1>
        <p className="vitrine-type-body" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Start with relationships, not isolated measurements: tighter inside a component, regular between related content, and wider between regions.
        </p>
      </header>

      <section aria-labelledby="spacing-scale-title" style={{ ...panel, padding: 'var(--spacing-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-6)' }}>
          <h2 id="spacing-scale-title" className="vitrine-type-heading" style={{ margin: 0 }}>Spacing scale</h2>
          <p className="vitrine-type-detail" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Public product choices stop at seven. Zero is written as 0; 2px adjustments belong inside shared components.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
          {SPACING_SCALE.map(({ token, value, use }) => (
            <article
              key={token}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 0.6fr) minmax(96px, 0.4fr) minmax(180px, 1fr)', alignItems: 'center', gap: 'var(--spacing-4)' }}
            >
              <code className="vitrine-type-code" style={tokenLabel}>{token}</code>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                <span aria-hidden="true" style={{ display: 'block', width: `var(${token})`, height: 12, borderRadius: 'var(--radius-full)', background: 'var(--vitrine-color-text-primary)' }} />
                <strong className="vitrine-type-label">{value}</strong>
              </div>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="control-size-title" style={{ ...panel, padding: 'var(--spacing-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-6)' }}>
          <h2 id="control-size-title" className="vitrine-type-heading" style={{ margin: 0 }}>Control heights</h2>
          <p className="vitrine-type-detail" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Size variants align adjacent controls. Padding changes content fit, never the declared height.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--spacing-6)' }}>
          {CONTROL_SIZE_SCALE.map(({ token, value, use }) => (
            <article key={token} style={{ display: 'grid', gap: 'var(--spacing-2)', minWidth: 220 }}>
              <code className="vitrine-type-code" style={tokenLabel}>{token}</code>
              <button
                type="button"
                className="vitrine-type-label"
                style={{ height: `var(${token})`, width: 'fit-content', paddingInline: 'var(--spacing-3)', border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', color: 'var(--color-text-primary)', background: 'var(--color-background-muted)' }}
              >
                {value} control
              </button>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="composition-title" style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--spacing-1)' }}>
          <h2 id="composition-title" className="vitrine-type-heading" style={{ margin: 0 }}>Composition rhythm</h2>
          <p className="vitrine-type-detail" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            The same scale becomes compact controls, a content card, and page-level sections.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--spacing-4)' }}>
          <article style={{ ...panel, display: 'grid', alignContent: 'start', gap: 'var(--spacing-3)', padding: 'var(--spacing-4)' }}>
            <span className="vitrine-type-supporting" style={tokenLabel}>COMPACT · 8 / 12 / 16</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
              <span className="vitrine-type-label" style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)' }}>Screens</span>
              <span className="vitrine-type-label" style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)' }}>Flows</span>
            </div>
          </article>
          <article style={{ ...panel, display: 'grid', alignContent: 'start', gap: 'var(--spacing-4)', padding: 'var(--spacing-6)' }}>
            <span className="vitrine-type-supporting" style={tokenLabel}>CONTENT · 16 / 24</span>
            <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
              <strong className="vitrine-type-heading">Aboard screen</strong>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>Web · Screen information</span>
            </div>
          </article>
          <article style={{ ...panel, display: 'grid', alignContent: 'start', gap: 'var(--spacing-8)', padding: 'var(--spacing-8)' }}>
            <span className="vitrine-type-supporting" style={tokenLabel}>REGION · 32 / 48</span>
            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
              <strong className="vitrine-type-title">Collections</strong>
              <span className="vitrine-type-body" style={{ color: 'var(--color-text-secondary)' }}>Keep useful screens and flows together.</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  ),
};
