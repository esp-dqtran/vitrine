import type { Meta, StoryObj } from '@storybook/react-vite';
import { Breadcrumbs, BreadcrumbItem, DropdownMenu } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Breadcrumbs>
      <BreadcrumbItem href="#">Home</BreadcrumbItem>
      <BreadcrumbItem href="#">Projects</BreadcrumbItem>
      <BreadcrumbItem isCurrent>Vitrine</BreadcrumbItem>
    </Breadcrumbs>
  ),
};

export const WithOverflowMenu: Story = {
  name: 'With overflow menu',
  render: () => (
    <Breadcrumbs>
      <BreadcrumbItem href="#">Home</BreadcrumbItem>
      <BreadcrumbItem>
        <DropdownMenu
          button={{ label: '…', variant: 'ghost', size: 'sm' }}
          hasChevron={false}
          items={[{ label: 'Workspace' }, { label: 'Team' }, { label: 'Projects' }]}
        />
      </BreadcrumbItem>
      <BreadcrumbItem href="#">Vitrine</BreadcrumbItem>
      <BreadcrumbItem isCurrent>Settings</BreadcrumbItem>
    </Breadcrumbs>
  ),
};
