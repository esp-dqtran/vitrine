import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Lightbox } from '@astryxdesign/core';

const media = [{ src: 'https://picsum.photos/seed/astryx1/1200/800', alt: 'Sample screenshot one' }];

const meta = {
  title: 'Components/DataDisplay/Lightbox',
  component: Lightbox,
  tags: ['autodocs'],
  args: { isOpen: false, onOpenChange: () => {}, media },
} satisfies Meta<typeof Lightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button variant="secondary" label="Open lightbox" onClick={() => setOpen(true)} />
          <Lightbox isOpen={open} onOpenChange={setOpen} media={media} />
        </>
      );
    }
    return <Demo />;
  },
};
