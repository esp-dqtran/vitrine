import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { ICON_SIZE_SCALE } from '../../vitrine/uiFoundationStandard';

const panel: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
  padding: 'var(--spacing-6)',
};

const meta = {
  title: 'Foundations/Iconography',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'One outline family, three sizes, and one accessible icon-control contract for Vitrines.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {
  render: () => (
    <main className="vitrine-iconography-preview" style={{ display: 'grid', gap: 'var(--spacing-8)', maxWidth: 1040, margin: '0 auto' }}>
      <header style={{ display: 'grid', gap: 'var(--spacing-3)', maxWidth: 720 }}>
        <span className="vitrine-type-label" style={{ color: 'var(--color-text-secondary)' }}>
          FOUNDATION 05 · ICONOGRAPHY
        </span>
        <h1 className="vitrine-type-title" style={{ margin: 0 }}>One icon language for every product action.</h1>
        <p className="vitrine-type-body" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Use the shared rounded outline family. Icons support labels and actions; app logos, brand marks, and captured evidence remain unchanged.
        </p>
      </header>

      <section style={panel} aria-labelledby="icon-size-title">
        <h2 id="icon-size-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-6)' }}>Three sizes only</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 'var(--spacing-4)' }}>
          {ICON_SIZE_SCALE.map(({ token, value, use }, index) => (
            <article key={token} style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
              <Icon icon="copy" size={index === 0 ? 'sm' : index === 1 ? 'md' : 'lg'} />
              <code className="vitrine-type-code">{token}</code>
              <strong className="vitrine-type-label">{value}</strong>
              <span className="vitrine-type-detail" style={{ color: 'var(--color-text-secondary)' }}>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section style={panel} aria-labelledby="icon-control-title">
        <h2 id="icon-control-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-6)' }}>Control composition</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          <Button label="Copy flow link" icon={<Icon icon="copy" size="sm" />} variant="secondary" />
          <Button label="Latest" endContent={<Icon icon="chevronDown" size="sm" />} variant="secondary" />
          <IconButton label="More actions" tooltip="More actions" icon={<Icon icon="moreHorizontal" size="md" />} variant="secondary" />
          <IconButton label="Close" tooltip="Close" icon={<Icon icon="close" size="md" />} variant="ghost" />
        </div>
        <p className="vitrine-type-detail" style={{ margin: 'var(--spacing-4) 0 0', color: 'var(--color-text-secondary)' }}>
          Text and icons use an 8px gap. Icon-only controls are 40×40px and always include an accessible label plus tooltip.
        </p>
      </section>

      <section style={panel} aria-labelledby="icon-state-title">
        <h2 id="icon-state-title" className="vitrine-type-heading" style={{ margin: '0 0 var(--spacing-6)' }}>Semantic states</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-6)' }}>
          {[
            ['Default', 'copy', 'inherit'],
            ['Muted', 'info', 'secondary'],
            ['Success', 'success', 'success'],
            ['Warning', 'warning', 'warning'],
            ['Destructive', 'error', 'danger'],
            ['Disabled', 'close', 'disabled'],
          ].map(([label, icon, color]) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <Icon icon={icon as 'copy'} size="sm" color={color as 'inherit'} />
              <span className="vitrine-type-label">{label}</span>
            </span>
          ))}
        </div>
      </section>
    </main>
  ),
};
