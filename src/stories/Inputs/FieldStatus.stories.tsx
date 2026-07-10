import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldStatus } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/FieldStatus',
  component: FieldStatus,
  tags: ['autodocs'],
  args: { type: 'error', message: 'This field is required.' },
} satisfies Meta<typeof FieldStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Detached: Story = {
  args: { variant: 'detached', type: 'warning', message: 'This value looks unusual.' },
};
