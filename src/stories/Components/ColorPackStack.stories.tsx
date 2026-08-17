import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorPackStack } from '../../vitrine/components/ColorPackStack';
import '../../vitrine/components/ColorPackStack.css';

const cards = [
  {
    id: 'obsidian-ink',
    name: 'Obsidian Ink',
    hex: '#151311',
    color: '#151311',
    foreground: '#EED3BA',
    role: 'lead' as const,
  },
  {
    id: 'velvet-curfew',
    name: 'Velvet Curfew',
    hex: '#4B262F',
    color: '#4B262F',
    foreground: '#EED3BA',
    role: 'accent' as const,
  },
  {
    id: 'almond-hearth',
    name: 'Almond Hearth',
    hex: '#EED3BA',
    color: '#EED3BA',
    foreground: '#151311',
    role: 'companion' as const,
  },
] as const;

const meta = {
  title: 'Components/Color pack stack',
  component: ColorPackStack,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A three-colour palette summary that expands from a compact overlapping card stack into three readable colour cards.',
      },
    },
  },
  decorators: [
    (Story) => (
      <main
        style={{
          minHeight: '100vh',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          padding: '48px 24px',
          background: '#EED3BA',
        }}
      >
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof ColorPackStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { cards, initiallyExpanded: false },
};

export const Expanded: Story = {
  args: { cards },
};
