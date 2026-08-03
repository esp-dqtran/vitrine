import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@astryxdesign/core';
import { MOTION_SCALE } from '../../vitrine/uiFoundationStandard';

const panel: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
  padding: 'var(--spacing-6)',
};

function MotionPreview() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main style={{ display: 'grid', gap: 'var(--spacing-8)', maxWidth: 1040, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 'var(--spacing-3)', maxWidth: 720 }}>
        <span className="vitrine-type-label" style={{ color: 'var(--color-text-secondary)' }}>
          FOUNDATION 06 · MOTION
        </span>
        <h1 className="vitrine-type-title" style={{ margin: 0 }}>Motion explains what changed.</h1>
        <p className="vitrine-type-body" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Use one expressive easing and the smallest duration that clearly communicates the interaction.
        </p>
      </header>

      <section style={panel} aria-labelledby="motion-scale-title">
        <h2 id="motion-scale-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-6)' }}>Three speeds only</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 'var(--spacing-4)' }}>
          {MOTION_SCALE.map(({ token, value, use }) => (
            <article key={token} style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
              <code className="vitrine-type-code">{token}</code>
              <strong className="vitrine-type-label">{value}</strong>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section style={panel} aria-labelledby="motion-demo-title">
        <h2 id="motion-demo-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-4)' }}>State-change preview</h2>
        <Button label={expanded ? 'Hide details' : 'Show details'} variant="secondary" onClick={() => setExpanded((value) => !value)} />
        <div
          style={{
            maxWidth: 520,
            marginTop: 'var(--spacing-4)',
            padding: expanded ? 'var(--spacing-4)' : '0 var(--spacing-4)',
            overflow: 'hidden',
            border: expanded ? '1px solid var(--color-border)' : '0 solid transparent',
            borderRadius: 'var(--radius-container)',
            opacity: expanded ? 1 : 0,
            transform: expanded ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity var(--vitrine-transition-standard), transform var(--vitrine-transition-standard)',
          }}
        >
          <span className="vitrine-type-body">Direct feedback uses 120ms, local state changes use 180ms, and major context changes use 240ms.</span>
        </div>
      </section>

      <p className="vitrine-type-detail" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
        Applied to discovery, detail, project, settings, and admin surfaces. Flow evidence, editors, and canvases keep their domain-owned behavior. Under prefers-reduced-motion, transitions complete immediately and every final state remains usable.
      </p>
    </main>
  );
}

const meta = {
  title: 'Foundations/Motion',
  component: MotionPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof MotionPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {};
