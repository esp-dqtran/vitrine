import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Dialog, Heading, Text, TextInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: { isOpen: false, onOpenChange: () => {}, children: null },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      const [email, setEmail] = useState('');
      return (
        <>
          <Button variant="primary" label="Invite teammate" onClick={() => setOpen(true)} />
          <Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={440}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Heading level={3}>Invite teammate</Heading>
              <Text type="body" color="secondary">
                They will receive an email invite to join your workspace.
              </Text>
              <TextInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="ghost" label="Cancel" onClick={() => setOpen(false)} />
                <Button variant="primary" label="Send invite" onClick={() => setOpen(false)} />
              </div>
            </div>
          </Dialog>
        </>
      );
    }
    return <Demo />;
  },
};
