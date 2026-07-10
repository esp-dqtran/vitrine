import type { Meta, StoryObj } from '@storybook/react-vite';
import { Collapsible, CollapsibleGroup, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Disclosure/Collapsible',
  component: CollapsibleGroup,
  tags: ['autodocs'],
  args: { type: 'single', children: null },
} satisfies Meta<typeof CollapsibleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FAQGroup: Story = {
  name: 'FAQ group',
  render: () => (
    <CollapsibleGroup type="single">
      <Collapsible value="a" trigger="What is Astryx?" defaultIsOpen={false}>
        <Text type="body" color="secondary">
          An open-source React + StyleX design system with 150+ accessible components.
        </Text>
      </Collapsible>
      <Collapsible value="b" trigger="How do I theme it?" defaultIsOpen={false}>
        <Text type="body" color="secondary">
          A theme is a set of CSS custom-property overrides — no forking or wrapping required.
        </Text>
      </Collapsible>
      <Collapsible value="c" trigger="Does it support dark mode?" defaultIsOpen={false}>
        <Text type="body" color="secondary">
          Yes — dark mode is driven by CSS light-dark() keyed to color-scheme.
        </Text>
      </Collapsible>
    </CollapsibleGroup>
  ),
};
