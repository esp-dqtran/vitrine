import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormLayout, NumberInput, Selector, TextInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/FormLayout',
  component: FormLayout,
  tags: ['autodocs'],
} satisfies Meta<typeof FormLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: () => (
    <FormLayout direction="vertical">
      <TextInput label="Name" value="" onChange={() => {}} />
      <TextInput label="Email" value="" onChange={() => {}} />
    </FormLayout>
  ),
};

export const HorizontalLabels: Story = {
  name: 'Horizontal labels',
  render: () => (
    <FormLayout direction="horizontal-labels">
      <TextInput label="Name" value="" onChange={() => {}} />
      <NumberInput label="Seats" value={5} onChange={() => {}} />
      <Selector label="Plan" value="" onChange={() => {}} options={[{ value: 'pro', label: 'Pro' }]} />
    </FormLayout>
  ),
};
