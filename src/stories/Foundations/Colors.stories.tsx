import type { Meta, StoryObj } from '@storybook/react-vite';
import { Code, Heading, Text } from '@astryxdesign/core';
import {
  FOUNDATION_TOKEN_CONTRACT,
  UI_FOUNDATION_STANDARD,
} from '../../vitrine/uiFoundationStandard';

const meta = {
  title: 'Foundations/Color',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The 13 semantic color roles available to Vitrines product UI. Toggle the Storybook theme to verify every role in light and dark modes.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LABELS: Record<(typeof FOUNDATION_TOKEN_CONTRACT.color)[number], string> = {
  '--vitrine-color-page': 'Page',
  '--vitrine-color-surface': 'Surface',
  '--vitrine-color-surface-muted': 'Muted surface',
  '--vitrine-color-border': 'Border',
  '--vitrine-color-border-emphasized': 'Emphasized border',
  '--vitrine-color-text-primary': 'Primary text',
  '--vitrine-color-text-secondary': 'Secondary text',
  '--vitrine-color-text-disabled': 'Disabled text',
  '--vitrine-color-action-primary': 'Primary action',
  '--vitrine-color-on-action-primary': 'On primary action',
  '--vitrine-color-status-success': 'Success',
  '--vitrine-color-status-warning': 'Warning',
  '--vitrine-color-status-error': 'Error',
};

function Swatch({ token }: { token: (typeof FOUNDATION_TOKEN_CONTRACT.color)[number] }) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-3)',
        padding: 'var(--spacing-4)',
        border: 'var(--border-width) solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        background: 'var(--color-background-surface)',
      }}
    >
      <div
        aria-label={`${LABELS[token]} swatch`}
        style={{
          height: 'var(--spacing-12)',
          border: 'var(--border-width) solid var(--color-border-emphasized)',
          borderRadius: 'var(--radius-element)',
          background: `var(${token})`,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
        <Text type="label">{LABELS[token]}</Text>
        <Code>{token}</Code>
      </div>
    </article>
  );
}

export const ProductPalette: Story = {
  name: 'Product palette',
  render: () => (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-8)',
        padding: 'var(--spacing-8)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-body)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', maxWidth: '72ch' }}>
        <Heading level={1} type="display-3">13 roles, not 149 choices</Heading>
        <Text type="large" color="secondary">
          Product screens use this compact semantic palette, extracted from the Vitrines App detail screen. Success and warning stay neutral; error remains the chromatic exception.
        </Text>
      </header>
      <section
        aria-label="Vitrines product color roles"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 'var(--spacing-4)',
        }}
      >
        {FOUNDATION_TOKEN_CONTRACT.color.map((token) => <Swatch key={token} token={token} />)}
      </section>
      <Text type="supporting" color="secondary">
        {UI_FOUNDATION_STANDARD.specializedColorPolicy}
      </Text>
    </main>
  ),
};
