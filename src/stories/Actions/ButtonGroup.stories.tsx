import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, ButtonGroup } from '@astryxdesign/core';

const meta = {
  title: 'Components/Actions/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  args: { label: 'History', children: null },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ButtonGroup label="History">
      <Button variant="secondary" label="Undo" />
      <Button variant="secondary" label="Redo" />
      <Button variant="secondary" label="Reset" />
    </ButtonGroup>
  ),
};
