import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@astryxdesign/core';

const meta = {
  title: 'Foundations/Color',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Tokens resolve live from the Neutral theme — toggle the toolbar Theme switch to watch every value adapt to dark mode.' } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ token, name, hex }: { token: string; name: string; hex: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          height: 56,
          borderRadius: 'var(--radius-element)',
          background: `var(--color-${token})`,
          border: '1px solid var(--color-border)',
        }}
      />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{hex}</div>
      </div>
    </div>
  );
}

function Grid({ items }: { items: [string, string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 18 }}>
      {items.map(([token, name, hex]) => (
        <Swatch key={token} token={token} name={name} hex={hex} />
      ))}
    </div>
  );
}

export const Surfaces: Story = {
  render: () => (
    <Grid
      items={[
        ['background-body', 'Body', '#f1f1f1'],
        ['background-surface', 'Surface', '#ffffff'],
        ['background-card', 'Card', '#ffffff'],
        ['background-muted', 'Muted', '#f1f1f1'],
        ['border', 'Border', '#ebebeb'],
        ['border-emphasized', 'Border strong', '#d4d4d4'],
      ]}
    />
  ),
};

export const Text: Story = {
  render: () => (
    <Grid
      items={[
        ['text-primary', 'Primary', '#171717'],
        ['text-secondary', 'Secondary', '#737373'],
        ['text-disabled', 'Disabled', '#a3a3a3'],
      ]}
    />
  ),
};

export const Status: Story = {
  render: () => (
    <Grid
      items={[
        ['success', 'Success', '#007004'],
        ['warning', 'Warning', '#745b00'],
        ['error', 'Error', '#a50c25'],
      ]}
    />
  ),
};

export const CategoricalHues: Story = {
  name: 'Categorical hues',
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'gray'].map((c) => (
        <Badge key={c} variant={c as never} label={c[0].toUpperCase() + c.slice(1)} />
      ))}
    </div>
  ),
};
