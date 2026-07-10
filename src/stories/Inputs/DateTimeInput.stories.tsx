import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateTimeInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/DateTimeInput',
  component: DateTimeInput,
  tags: ['autodocs'],
  args: { label: 'Meeting time', onChange: () => {} },
} satisfies Meta<typeof DateTimeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
