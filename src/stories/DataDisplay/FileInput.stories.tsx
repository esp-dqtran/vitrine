import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/DataDisplay/FileInput',
  component: FileInput,
  tags: ['autodocs'],
  args: { label: 'Upload artwork', value: null, onChange: () => {} },
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dropzone: Story = {
  render: () => {
    function Demo() {
      const [file, setFile] = useState<File | File[] | null>(null);
      return (
        <FileInput
          label="Upload artwork"
          isLabelHidden
          mode="dropzone"
          accept="image/*"
          value={file}
          onChange={setFile}
          description="PNG or JPG, up to 10 MB"
        />
      );
    }
    return <Demo />;
  },
};
