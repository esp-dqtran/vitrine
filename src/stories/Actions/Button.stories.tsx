import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@astryxdesign/core';

const meta = {
  title: 'Components/Actions/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: { label: 'Button' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { variant: 'primary', label: 'Get started' } };

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <Button variant="primary" label="Primary" />
      <Button variant="secondary" label="Secondary" />
      <Button variant="ghost" label="Ghost" />
      <Button variant="destructive" label="Delete" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Button size="sm" variant="primary" label="Small" />
      <Button size="md" variant="primary" label="Medium" />
      <Button size="lg" variant="primary" label="Large" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <Button variant="primary" isLoading label="Saving" />
      <Button variant="secondary" isDisabled label="Disabled" />
    </div>
  ),
};
