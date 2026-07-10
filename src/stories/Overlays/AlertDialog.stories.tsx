import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertDialog, Button } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  args: {
    isOpen: false,
    onOpenChange: () => {},
    title: 'Delete project?',
    description: 'This action cannot be undone. The project and all its screens will be permanently removed.',
    actionLabel: 'Delete project',
    onAction: () => {},
  },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button variant="destructive" label="Delete project" onClick={() => setOpen(true)} />
          <AlertDialog
            isOpen={open}
            onOpenChange={setOpen}
            title="Delete project?"
            description="This action cannot be undone. The project and all its screens will be permanently removed."
            actionLabel="Delete project"
            onAction={() => setOpen(false)}
          />
        </>
      );
    }
    return <Demo />;
  },
};
