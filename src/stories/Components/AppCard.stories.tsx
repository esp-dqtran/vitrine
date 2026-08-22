import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppCard } from '../../vitrine/components/AppCard';
import type { App } from '../../vitrine/types';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';

const aboard: App = {
  id: 'aboard',
  app: 'Aboard',
  categories: [{ id: 1, name: 'Business', slug: 'business' }],
  accent: '#5b8ff9',
  totalScreens: 624,
  platforms: ['web'],
  analyzedScreens: 624,
  lastCapturedAt: '2026-08-18T00:00:00.000Z',
  iconUrl: null,
  previewUrl: '/landing/astryx-apps-catalog.png',
  isUpdated: false,
  description: 'Business, Jobs & Recruitment',
  previewVideoUrl: '/motion/magnetic-product-cards.mp4',
  screens: [
    {
      id: 1,
      type: 'Dashboard',
      productArea: 'Workspace',
      theme: 'dark',
      visibleStates: ['default'],
      platform: 'web',
      description: null,
      url: '/landing/astryx-apps-catalog.png',
    },
  ],
};

const meta = {
  title: 'Components/AppCard',
  component: AppCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The focused Apps discovery card used in Vitrines.',
      },
    },
  },
  globals: {
    theme: 'dark',
  },
  decorators: [
    (Story) => (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 48,
          background: 'var(--color-background-body)',
        }}
      >
        <div style={{ width: 'min(440px, calc(100vw - 48px))' }}>
          <Story />
        </div>
      </main>
    ),
  ],
  args: {
    app: aboard,
    platform: 'web',
    onOpen: () => undefined,
  },
} satisfies Meta<typeof AppCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const sliderApp: App = {
  ...aboard,
  previewUrl: null,
  previewVideoUrl: null,
  totalScreens: 4,
  analyzedScreens: 4,
  screens: [
    { ...aboard.screens[0], id: 1, url: '/landing/astryx-apps-catalog.png' },
    { ...aboard.screens[0], id: 2, url: '/landing/astryx-public-preview-real-flows.png' },
    { ...aboard.screens[0], id: 3, url: '/landing/vitrines-social-card.jpg' },
    { ...aboard.screens[0], id: 4, url: '/landing/vitrines-social-card-v6.png' },
  ],
};

export const Slider: Story = {
  args: {
    app: sliderApp,
    slider: true,
  },
};
