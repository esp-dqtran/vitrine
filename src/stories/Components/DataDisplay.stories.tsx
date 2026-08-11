import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '@astryxdesign/core';
import type { App, RowStatus, Screen } from '../../vitrine/types';
import { AppCard } from '../../vitrine/components/AppCard';
import { AppCardSkeleton } from '../../vitrine/components/AppCardSkeleton';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productDataDisplay.css';
import './DataDisplay.css';

const meta = {
  title: 'Components/DataDisplay/Cards and lists',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The first Vitrines Data Display standard, grounded in the production Apps discovery card and extended to loading, compact list, empty, focus, and responsive states.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface ReviewApp {
  app: App;
  status?: RowStatus;
  progressLabel?: string;
}

const makeScreen = (id: number, url: string, platform = 'web'): Screen => ({
  id,
  type: 'Dashboard',
  productArea: 'Workspace',
  theme: 'light',
  visibleStates: [],
  platform,
  description: null,
  url,
});

const reviewApps: ReviewApp[] = [
  {
    app: {
      id: 'aboard-ea683077-aadb-47c5-a771-d21fd9676510',
      app: 'Aboard',
      categories: [{ id: 1, name: 'Business, Jobs & Recruitment', slug: 'business-jobs-recruitment' }],
      accent: '#08bfe8',
      totalScreens: 624,
      platforms: ['web'],
      analyzedScreens: 0,
      lastCapturedAt: '2026-07-24T00:00:00.000Z',
      iconUrl: 'https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png',
      description: 'Business, Jobs & Recruitment',
      screens: [
        makeScreen(
          1,
          'http://127.0.0.1:5173/api/preview-media/aboard-ea683077-aadb-47c5-a771-d21fd9676510/web/1',
        ),
      ],
    },
    status: 'In progress',
    progressLabel: '0/624 analyzed',
  },
  {
    app: {
      id: 'flows-library',
      app: 'Flows library',
      categories: [{ id: 2, name: 'Product design', slug: 'product-design' }],
      accent: '#7a72ff',
      totalScreens: 166,
      platforms: ['web'],
      analyzedScreens: 166,
      lastCapturedAt: '2026-07-22T00:00:00.000Z',
      description: 'Product design',
      screens: [makeScreen(2, '/landing/astryx-public-preview-real-flows.png')],
    },
    status: 'Complete',
  },
  {
    app: {
      id: 'catalog',
      app: 'Apps catalog',
      categories: [{ id: 3, name: 'Reference library', slug: 'reference-library' }],
      accent: '#3d8bfd',
      totalScreens: 452,
      platforms: ['web'],
      analyzedScreens: 452,
      lastCapturedAt: '2026-07-20T00:00:00.000Z',
      description: 'Reference library',
      screens: [makeScreen(3, '/landing/astryx-apps-catalog.png')],
    },
    status: 'Complete',
  },
];

function ReviewSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="data-display-review__section">
      <header className="data-display-review__section-header">
        <span>{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function AppCardExample({
  item,
  selected,
  onSelect,
}: {
  item: ReviewApp;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="data-display-review__card-slot data-display-card"
      data-selected={selected ? 'true' : undefined}
    >
      <AppCard
        app={item.app}
        platform="web"
        onOpen={onSelect}
      />
    </div>
  );
}

function DataDisplayReview() {
  const [selectedId, setSelectedId] = useState(reviewApps[2].app.id);

  return (
    <main className="data-display-review apps-discovery">
      <header className="data-display-review__intro">
        <div>
          <p className="data-display-review__eyebrow">Vitrines · Component system</p>
          <h1>Data Display</h1>
          <p className="data-display-review__lede">
            Cards and lists turn captured evidence into a clear, comparable, and scannable library.
          </p>
        </div>
        <span className="data-display-review__status">Visual review · Apps pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Production card"
        description="The current Apps discovery card is the reference for media, identity, hierarchy, metadata, and status."
      >
        <div className="data-display-review__reference">
          <AppCardExample
            item={reviewApps[0]}
            selected={selectedId === reviewApps[0].app.id}
            onSelect={() => setSelectedId(reviewApps[0].app.id)}
          />
          <aside className="data-display-review__anatomy" aria-label="Card anatomy">
            <div>
              <span>01</span>
              <strong>Preview</strong>
              <p>Use the best available screen without cropping the evidence.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Identity</strong>
              <p>Logo, app name, and category remain grouped as one readable unit.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Metadata</strong>
              <p>Date, screen count, and analysis progress stay in one secondary row.</p>
            </div>
          </aside>
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Grid and interaction states"
        description="The same component supports comparison, hover, keyboard focus, current selection, and loading."
      >
        <div className="data-display-review__grid">
          {reviewApps.slice(1).map((item) => (
            <div className="data-display-review__state-example" key={item.app.id}>
              <span>{selectedId === item.app.id ? 'Selected' : 'Default'}</span>
              <AppCardExample
                item={item}
                selected={selectedId === item.app.id}
                onSelect={() => setSelectedId(item.app.id)}
              />
            </div>
          ))}
          <div className="data-display-review__state-example">
            <span>Loading</span>
            <div className="data-display-review__card-slot">
              <AppCardSkeleton index={3} />
            </div>
          </div>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Compact list"
        description="Use the compact presentation when vertical scanning matters more than a large preview. The content order does not change."
      >
        <div className="data-display-review__list data-display-list" aria-label="Compact app list">
          {reviewApps.map((item) => (
            <AppCardExample
              key={item.app.id}
              item={item}
              selected={selectedId === item.app.id}
              onSelect={() => setSelectedId(item.app.id)}
            />
          ))}
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Empty and responsive behavior"
        description="A clear recovery message replaces missing results; cards collapse from three columns to one without losing their hierarchy."
      >
        <div className="data-display-review__ending-grid">
          <article className="data-display-review__empty">
            <EmptyState
              title="No apps match these filters"
              description="Remove one or more filters to see more captured references."
            />
          </article>
          <article className="data-display-review__responsive-note">
            <span>Responsive contract</span>
            <strong>3 → 2 → 1</strong>
            <p>Three columns on wide screens, two on compact desktop, and one on mobile.</p>
          </article>
        </div>
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <DataDisplayReview />,
};
