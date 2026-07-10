import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from '@astryxdesign/core';

const meta = {
  title: 'Components/Feedback/Toast',
  component: Toast,
  tags: ['autodocs'],
  args: { type: 'info', body: 'Changes saved.', isAutoHide: false, autoHideDuration: 0, onDismiss: () => {} },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    body: <span style={{ color: 'var(--color-on-accent)' }}>Changes saved.</span>,
    endContent: (
      <span style={{ color: 'var(--color-on-accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: 0.9 }}>Undo</span>
    ),
  },
};

export const ErrorToast: Story = {
  name: 'Error',
  args: { type: 'error', body: 'Upload failed — the file is larger than 25 MB.' },
};
