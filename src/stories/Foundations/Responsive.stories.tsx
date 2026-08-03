import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RESPONSIVE_RANGES } from '../../vitrine/uiFoundationStandard';

const panel: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
  padding: 'var(--spacing-6)',
};

function ResponsivePreview() {
  return (
    <main style={{ display: 'grid', gap: 'var(--spacing-8)', maxWidth: 1040, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 'var(--spacing-3)', maxWidth: 720 }}>
        <span className="vitrine-type-label" style={{ color: 'var(--color-text-secondary)' }}>
          FOUNDATION 07 · RESPONSIVE
        </span>
        <h1 className="vitrine-type-title" style={{ margin: 0 }}>Preserve task priority at every width.</h1>
        <p className="vitrine-type-body" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Reflow before hiding. Keep context and primary controls reachable without introducing a second mobile visual language.
        </p>
      </header>

      <section style={panel} aria-labelledby="responsive-ranges-title">
        <h2 id="responsive-ranges-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-6)' }}>Three layout ranges</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          {RESPONSIVE_RANGES.map(({ id, range, columns, gutter, use }) => (
            <article key={id} style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
              <strong className="vitrine-type-label" style={{ textTransform: 'capitalize' }}>{id}</strong>
              <code className="vitrine-type-code">{range}</code>
              <span className="vitrine-type-detail">{columns} result {columns === 1 ? 'column' : 'columns'} · {gutter} gutter</span>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section style={panel} aria-labelledby="responsive-rules-title">
        <h2 id="responsive-rules-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-4)' }}>Apps pilot rules</h2>
        <ul className="vitrine-type-body" style={{ display: 'grid', gap: 'var(--spacing-2)', margin: 0, paddingLeft: 'var(--spacing-6)' }}>
          <li>Wide keeps a single-row header and three result columns.</li>
          <li>Medium uses a two-row header, wrapping filters, and two result columns.</li>
          <li>Compact keeps filters horizontally reachable and stacks results into one column.</li>
          <li>Dropdown sheets stay inside the viewport and the page never scrolls horizontally.</li>
        </ul>
      </section>
    </main>
  );
}

const meta = {
  title: 'Foundations/Responsive',
  component: ResponsivePreview,
  tags: ['autodocs'],
} satisfies Meta<typeof ResponsivePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {};
