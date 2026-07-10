import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '@astryxdesign/core';

const meta = {
  title: 'Foundations/Radius & Elevation',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Corner radii and the three-step shadow ramp.' } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Radius: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {(['inner', 'element', 'container', 'page'] as const).map((r) => (
        <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              width: 66,
              height: 66,
              background: 'var(--color-accent-muted)',
              border: '1px solid var(--color-border-emphasized)',
              borderRadius: `var(--radius-${r})`,
            }}
          />
          <Text type="supporting">{r[0].toUpperCase() + r.slice(1)}</Text>
        </div>
      ))}
    </div>
  ),
};

export const Shadow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 18 }}>
      {(['low', 'med', 'high'] as const).map((s) => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              width: 78,
              height: 66,
              background: 'var(--color-background-card)',
              borderRadius: 'var(--radius-container)',
              boxShadow: `var(--shadow-${s})`,
            }}
          />
          <Text type="supporting">{s[0].toUpperCase() + s.slice(1)}</Text>
        </div>
      ))}
    </div>
  ),
};
