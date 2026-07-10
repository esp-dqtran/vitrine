import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputGroup, InputGroupText, TextInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/InputGroup',
  component: InputGroup,
  tags: ['autodocs'],
  args: { label: 'Website', children: null },
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <InputGroup label="Website">
      <InputGroupText>https://</InputGroupText>
      <TextInput label="Website" isLabelHidden value="" onChange={() => {}} placeholder="yourcompany.com" />
    </InputGroup>
  ),
};
