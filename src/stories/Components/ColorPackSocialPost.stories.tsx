import type { Meta, StoryObj } from '@storybook/react-vite';
import { defaultColorPalettes } from '../../colorPalettes.ts';
import { ColorPackSocialPost } from '../../vitrine/components/ColorPackSocialPost.tsx';
import '../../vitrine/components/ColorPackStack.css';
import '../../vitrine/components/ColorPackSocialPost.css';

const quietAuthority = defaultColorPalettes.find(({ id }) => id === 'quiet-authority');
if (!quietAuthority) throw new Error('Quiet Authority palette is required for the Color Pack social post story');

const meta = {
  title: 'Components/Color pack social post',
  component: ColorPackSocialPost,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <>
        <style>{`html, body, #storybook-root { width: 100%; min-height: 100%; margin: 0; padding: 0; }`}</style>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof ColorPackSocialPost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QuietAuthority: Story = {
  args: { palette: quietAuthority },
};
