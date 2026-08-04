import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@astryxdesign/core';
import type { App } from '../../vitrine/types';
import { AppCard } from '../../vitrine/components/AppCard';
import {
  DiscoveryFilterMenu,
  type DiscoveryFilterGroup,
  type DiscoveryFilterOption,
} from '../../vitrine/components/AppsFilterBar';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/components/AstryxDropdown.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productDataDisplay.css';
import '../../vitrine/productForms.css';
import './InteractionPatternsAndMotion.css';

const meta = {
  title: 'Patterns/Interaction Patterns and Motion',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A production-grounded visual review of direct feedback, card selection, local overlays, loading, sticky chrome, and reduced-motion behavior across Apps Discovery and App Detail.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const APP_ID = 'aboard-ea683077-aadb-47c5-a771-d21fd9676510';
const PREVIEW_HOST = 'http://127.0.0.1:5173';
const APPS_DISCOVERY_URL = `${PREVIEW_HOST}/apps?platform=web&content_type=apps&sort=latest`;
const APP_ICON = 'https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png';

const aboard: App = {
  id: APP_ID,
  app: 'Aboard',
  categories: [{ id: 1, name: 'Business, Jobs & Recruitment', slug: 'business' }],
  accent: '#08bfe8',
  totalScreens: 624,
  totalUiElements: 118,
  totalFlows: 166,
  platforms: ['web'],
  analyzedScreens: 0,
  lastCapturedAt: '2026-07-24T00:00:00.000Z',
  iconUrl: APP_ICON,
  description: 'Business, Jobs & Recruitment',
  previewVideoUrl: null,
  screens: [{
    id: 1,
    type: 'Dashboard',
    productArea: 'Workspace',
    theme: 'light',
    visibleStates: ['Default'],
    platform: 'web',
    description: null,
    url: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/1?variant=full`,
    thumbnailUrl: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/1`,
  }],
};

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
    <section className="interaction-review__section">
      <header className="interaction-review__section-header">
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

function DurationCard({ token, value, label }: { token: string; value: string; label: string }) {
  return (
    <article className="interaction-review__duration-card">
      <span className="interaction-review__duration-line" style={{ '--motion-duration': value } as CSSProperties} />
      <strong>{value}</strong>
      <span>{label}</span>
      <code>{token}</code>
    </article>
  );
}

function DirectFeedback() {
  const [pressed, setPressed] = useState(false);

  return (
    <div className="interaction-review__direct-grid">
      <article className="interaction-review__specimen-card">
        <span className="interaction-review__specimen-label">Production controls</span>
        <div className="interaction-review__control-row">
          <Button label="Primary action" variant="primary" size="md" onClick={() => setPressed((value) => !value)} />
          <Button label="Secondary" variant="secondary" size="md" />
          <Button label="Disabled" variant="secondary" size="md" isDisabled />
        </div>
        <p>{pressed ? 'Pressed state confirmed.' : 'Hover, press, or tab through the controls.'}</p>
      </article>
      <div className="interaction-review__duration-grid" aria-label="Motion duration scale">
        <DurationCard token="fast" value="120ms" label="Direct feedback" />
        <DurationCard token="medium" value="180ms" label="Local state" />
        <DurationCard token="slow" value="240ms" label="Context change" />
      </div>
    </div>
  );
}

function SelectionAndOverlays() {
  const [selected, setSelected] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterPreview, setFilterPreview] = useState<DiscoveryFilterOption | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const popoverContainerRef = useRef<HTMLDivElement>(null);
  const categoryFilter: DiscoveryFilterGroup = {
    id: 'categories',
    label: 'Categories',
    selected: selectedCategories,
    options: [
      { value: 'AI', section: 'Categories' },
      { value: 'Business', section: 'Categories' },
      { value: 'CRM', section: 'Categories' },
      { value: 'Finance', section: 'Categories' },
      { value: 'News', section: 'Categories' },
    ],
  };

  return (
    <div className="interaction-review__selection-grid">
      <article className="interaction-review__specimen-card interaction-review__selection-card">
        <div className="interaction-review__specimen-heading">
          <div>
            <span className="interaction-review__specimen-label">Card selection</span>
            <strong>Overlay, never layout shift</strong>
          </div>
          <Button
            label={selected ? 'Clear selection' : 'Select card'}
            variant={selected ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setSelected((value) => !value)}
          />
        </div>
        <div className="interaction-review__app-card data-display-card" data-selected={selected ? 'true' : undefined}>
          <AppCard app={aboard} platform="web" onOpen={() => setSelected(true)} />
        </div>
      </article>

      <article className="interaction-review__specimen-card interaction-review__overlay-card">
        <span className="interaction-review__specimen-label">Production filter popover</span>
        <strong>Shared Apps filter panel</strong>
        <p>The review uses the same searchable, multi-select popover as Apps Discovery and App Detail.</p>
        <DiscoveryFilterMenu
          group={categoryFilter}
          open={popoverOpen}
          query={filterQuery}
          preview={filterPreview}
          containerRef={popoverContainerRef}
          onToggleOpen={() => {
            setFilterQuery('');
            setFilterPreview(null);
            setPopoverOpen((current) => !current);
          }}
          onQueryChange={setFilterQuery}
          onPreview={setFilterPreview}
          onToggleOption={(option) => {
            setSelectedCategories((current) => current.includes(option.value)
              ? current.filter((value) => value !== option.value)
              : [...current, option.value]);
          }}
          onClear={() => setSelectedCategories([])}
        />
      </article>
    </div>
  );
}

function LoadingAndContext() {
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="interaction-review__context-grid">
      <article className="interaction-review__specimen-card">
        <div className="interaction-review__specimen-heading">
          <div>
            <span className="interaction-review__specimen-label">Loading</span>
            <strong>Footprint stays stable</strong>
          </div>
          <Button label={loading ? 'Show result' : 'Replay loading'} variant="secondary" size="sm" onClick={() => setLoading((value) => !value)} />
        </div>
        <div className="interaction-review__loading-stage" aria-live="polite">
          {loading ? (
            <div className="interaction-review__skeleton" role="status" aria-label="Loading app evidence">
              <span /><span /><span />
            </div>
          ) : (
            <div className="interaction-review__loaded-result">
              <img src={APP_ICON} alt="" />
              <div><strong>Aboard is ready</strong><span>624 screens available</span></div>
            </div>
          )}
        </div>
      </article>

      <article className="interaction-review__specimen-card">
        <div className="interaction-review__specimen-heading">
          <div>
            <span className="interaction-review__specimen-label">Context change</span>
            <strong>240ms deliberate reveal</strong>
          </div>
          <Button label={detailsOpen ? 'Close details' : 'Open details'} variant="primary" size="sm" onClick={() => setDetailsOpen((value) => !value)} />
        </div>
        <div className="interaction-review__detail-stage" data-open={detailsOpen ? 'true' : 'false'}>
          <div>
            <span>App Detail</span>
            <strong>Aboard</strong>
            <p>Evidence remains visible while contextual information enters.</p>
          </div>
        </div>
      </article>
    </div>
  );
}

function StickyChrome() {
  return (
    <div className="interaction-review__sticky-review">
      <p>
        Scroll inside the live route. The full product header stays intact at the top with Apps,
        Sites, and Flows visible; after the taxonomy passes, the discovery toolbar becomes the
        second sticky header line.
      </p>
      <iframe
        className="interaction-review__live-apps"
        title="Live production Apps Discovery sticky chrome"
        src={APPS_DISCOVERY_URL}
        loading="eager"
      />
    </div>
  );
}

function InteractionPatternsAndMotionReview() {
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <main className="interaction-review" data-reduced-motion={reducedMotion ? 'true' : undefined}>
      <header className="interaction-review__intro">
        <div>
          <p className="interaction-review__eyebrow">Vitrines · Pattern system</p>
          <h1>Interaction Patterns &amp; Motion</h1>
          <p className="interaction-review__lede">Motion confirms intent, preserves spatial context, and never delays the next action.</p>
        </div>
        <div className="interaction-review__review-controls">
          <span className="interaction-review__status">Visual review · Apps + App Detail</span>
          <Button
            label={reducedMotion ? 'Reduced motion on' : 'Preview reduced motion'}
            variant="secondary"
            size="sm"
            onClick={() => setReducedMotion((value) => !value)}
          />
        </div>
      </header>

      <ReviewSection index="01" title="Direct feedback" description="Hover, focus, pressed, and disabled states respond in 120ms without moving surrounding content.">
        <DirectFeedback />
      </ReviewSection>

      <ReviewSection index="02" title="Selection and local overlays" description="Selection uses a non-layout overlay; menus enter from their trigger in 180ms and keep focus nearby.">
        <SelectionAndOverlays />
      </ReviewSection>

      <ReviewSection index="03" title="Loading and context change" description="Loading preserves the final footprint; deliberate reveals use 240ms and animate only opacity and transform.">
        <LoadingAndContext />
      </ReviewSection>

      <ReviewSection index="04" title="Sticky chrome" description="Scroll the live production Apps Discovery route to review the real header and toolbar behavior without a Storybook-only reconstruction.">
        <StickyChrome />
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <InteractionPatternsAndMotionReview />,
};
