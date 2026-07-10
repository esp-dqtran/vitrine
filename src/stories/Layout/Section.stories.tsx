import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/Section',
  component: Section,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section variant="section" style={{ padding: 16, borderRadius: 'var(--radius-element)' }}>
        <Text>Section variant</Text>
      </Section>
      <Section variant="muted" style={{ padding: 16, borderRadius: 'var(--radius-element)' }}>
        <Text>Muted variant</Text>
      </Section>
      <Section variant="transparent" style={{ padding: 16, borderRadius: 'var(--radius-element)', border: '1px dashed var(--color-border-emphasized)' }}>
        <Text>Transparent variant</Text>
      </Section>
    </div>
  ),
};
