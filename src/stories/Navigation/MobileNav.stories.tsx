import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, MobileNav, SideNavItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/MobileNav',
  component: MobileNav,
  tags: ['autodocs'],
  args: { isOpen: false, onOpenChange: () => {}, header: 'Navigation', children: null },
} satisfies Meta<typeof MobileNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button variant="secondary" label="Open menu" onClick={() => setOpen(true)} />
          <MobileNav isOpen={open} onOpenChange={setOpen} header="Navigation">
            <SideNavItem label="Home" href="#" isSelected />
            <SideNavItem label="Projects" href="#" />
            <SideNavItem label="Settings" href="#" />
          </MobileNav>
        </>
      );
    }
    return <Demo />;
  },
};
