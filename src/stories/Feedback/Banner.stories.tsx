import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '@astryxdesign/core';

const meta = {
  title: 'Components/Feedback/Banner',
  component: Banner,
  tags: ['autodocs'],
  args: {
    status: 'info',
    title: 'Scheduled maintenance',
    description: 'The platform will be briefly unavailable Sunday 2–4 AM PST.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: { status: 'success', title: 'Deployment complete', description: 'Version 0.1.4 is live across all regions.' },
};

export const Error: Story = {
  args: { status: 'error', title: 'Payment failed', description: 'Update your card to keep your subscription active.' },
};
