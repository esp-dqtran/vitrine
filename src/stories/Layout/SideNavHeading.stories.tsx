import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavHeadingMenu, NavHeadingMenuItem, SideNavHeading } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/SideNavHeading',
  component: SideNavHeading,
  tags: ['autodocs'],
  args: { heading: 'Vitrine' },
} satisfies Meta<typeof SideNavHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div style={{ width: 260, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 8 }}>
      <SideNavHeading heading="Vitrine" superheading="Acme Inc." />
    </div>
  ),
};

export const WithMenu: Story = {
  name: 'With menu',
  render: () => (
    <div style={{ width: 260, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 8 }}>
      <SideNavHeading
        heading="Vitrine"
        superheading="Acme Inc."
        menu={
          <NavHeadingMenu>
            <NavHeadingMenuItem label="Switch workspace" />
            <NavHeadingMenuItem label="Invite teammates" />
          </NavHeadingMenu>
        }
      />
    </div>
  ),
};
