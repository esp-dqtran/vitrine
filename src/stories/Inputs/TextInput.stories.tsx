import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/TextInput',
  component: TextInput,
  tags: ['autodocs'],
  args: { label: 'Workspace', value: '', onChange: () => {} },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState('acme-prod');
      return <TextInput {...args} value={value} onChange={setValue} description="Lowercase, no spaces." hasClear />;
    }
    return <Demo />;
  },
};

export const WithValidation: Story = {
  name: 'With validation',
  render: () => {
    function Demo() {
      const [email, setEmail] = useState('');
      return (
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          status={email && !email.includes('@') ? { type: 'error', message: 'Email must include @' } : undefined}
        />
      );
    }
    return <Demo />;
  },
};

export const Disabled: Story = {
  args: {
    label: 'API key',
    value: 'sk_live_••••••',
    isDisabled: true,
    disabledMessage: 'Rotate keys from settings',
  },
};
