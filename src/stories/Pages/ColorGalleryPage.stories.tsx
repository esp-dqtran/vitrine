import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorGalleryPage } from '../../vitrine/components/ColorGalleryPage.tsx';
import '../../vitrine/components/ColorPackStack.css';
import '../../vitrine/colorGallery.css';

const meta = {
  title: 'Pages/Color gallery',
  component: ColorGalleryPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ColorGalleryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
