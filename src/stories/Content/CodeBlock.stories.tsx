import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock } from '@astryxdesign/core';

const sample = `function greet(name) {
  return \`Hello, \${name}!\`;
}`;

const meta = {
  title: 'Components/Content/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
  args: { code: sample, language: 'javascript', hasLanguageLabel: true, hasCopyButton: true },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithLineNumbers: Story = {
  name: 'With line numbers',
  args: { hasLineNumbers: true, highlightLines: [2] },
};
