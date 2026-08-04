import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@astryxdesign/core';
import type { Screen } from '../../vitrine/types';
import { MediaGridCard } from '../../vitrine/components/MediaGridCard';
import { ScreenGridCard } from '../../vitrine/components/ScreenGridCard';
import { ScreenPreviewDialog } from '../../vitrine/components/ScreenPreviewDialog';
import '../../vitrine/styles.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productDataDisplay.css';
import '../../vitrine/productIconography.css';
import '../../vitrine/components/AstryxModal.css';
import '../../vitrine/flowPreviewDialog.css';
import './MediaAndEvidence.css';

const meta = {
  title: 'Components/Media and Evidence/Visual review',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Vitrines media standard uses the production App Detail screen card and preview dialog to review evidence fit, selection, loading, locked, unavailable, and responsive states.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const APP_ID = 'aboard-ea683077-aadb-47c5-a771-d21fd9676510';
const PREVIEW_HOST = 'http://127.0.0.1:5173';
const APP_ICON = 'https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png';

const screens: Screen[] = [
  {
    id: 1,
    type: 'Dashboard',
    productArea: 'Home',
    theme: 'light',
    visibleStates: ['Default'],
    platform: 'web',
    description: 'Aboard home dashboard with people insights and workspace activity.',
    url: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/1?variant=full`,
    thumbnailUrl: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/1`,
    visibleText: ['Bring joy to your workplace'],
  },
  {
    id: 2,
    type: 'Form',
    productArea: 'Onboarding',
    theme: 'light',
    visibleStates: ['Signup'],
    platform: 'web',
    description: 'Aboard onboarding screen for creating a workspace account.',
    url: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/2?variant=full`,
    thumbnailUrl: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/2`,
    visibleText: ['Create account'],
  },
  {
    id: 3,
    type: 'People overview',
    productArea: 'People',
    theme: 'light',
    visibleStates: ['Overview'],
    platform: 'web',
    description: 'Aboard people overview with employee data and team summaries.',
    url: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/3?variant=full`,
    thumbnailUrl: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/3`,
    visibleText: ['People overview'],
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
    <section className="media-review__section">
      <header className="media-review__section-header">
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

function MediaAndEvidenceReview() {
  const [selectedIds, setSelectedIds] = useState(new Set<number>([1]));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [lockedMessage, setLockedMessage] = useState('');

  const toggleSelected = (id: number, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <main className="media-review app-detail--web">
      <header className="media-review__intro">
        <div>
          <p className="media-review__eyebrow">Vitrines · Component system</p>
          <h1>Media &amp; Evidence</h1>
          <p className="media-review__lede">
            Screens stay legible, comparable, and trustworthy from the first thumbnail to the full evidence preview.
          </p>
        </div>
        <span className="media-review__status">Visual review · App Detail pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Production evidence gallery"
        description="The App Detail screen card is the reference for contain-fit media, evidence labels, selection, and actions."
      >
        <div className="media-review__production-frame reference-detail" data-reference-detail="app">
          <div className="media-review__gallery" data-reference-gallery-layout="web-screens">
            {screens.map((screen, index) => (
              <ScreenGridCard
                key={screen.id}
                screen={screen}
                accent="#08bfe8"
                delay={index * 0.04}
                appName="Aboard"
                appId={APP_ID}
                collections={[]}
                onCollectionsChange={() => undefined}
                flowNames={index === 0 ? ['Onboarding'] : index === 1 ? ['Signup'] : ['People']}
                selected={selectedIds.has(screen.id)}
                onSelectedChange={(selected) => toggleSelected(screen.id, selected)}
                onOpen={() => setPreviewIndex(index)}
              />
            ))}
          </div>
          <p className="media-review__interaction-note" aria-live="polite">
            {selectedIds.size} selected · Open any screen to inspect the production preview.
          </p>
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Fit and hierarchy"
        description="Evidence is never cropped. The frame adapts around the source while labels remain readable over light or dark imagery."
      >
        <div className="media-review__fit-grid">
          <article className="media-review__fit-card">
            <span>Web evidence · contain</span>
            <MediaGridCard
              label="Open Aboard dashboard evidence"
              kind="image"
              url={screens[0].url}
              thumbnailUrl={screens[0].thumbnailUrl}
              aspectRatio="16 / 10"
              imageFit="contain"
              preferFullImage
              preserveNaturalAspectRatio
              title="Home dashboard"
              onOpen={() => setPreviewIndex(0)}
            />
          </article>
          <aside className="media-review__anatomy" aria-label="Media hierarchy">
            <div>
              <span>01</span>
              <strong>Evidence first</strong>
              <p>Contain fit preserves every captured pixel and avoids misleading crops.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Context second</strong>
              <p>Product area and state labels stay short, consistent, and secondary.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Actions on intent</strong>
              <p>Save, copy, and selection appear on hover, focus, or current selection.</p>
            </div>
          </aside>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="System states"
        description="Loading, locked, and unavailable evidence keep the same footprint so the gallery never jumps."
      >
        <div className="media-review__state-grid">
          <article className="media-review__state-example">
            <span>Loading</span>
            <div className="media-review__state-card media-review__loading" role="status" aria-label="Loading screen preview">
              <div className="media-review__loading-media" />
              <div className="media-review__loading-line" />
              <div className="media-review__loading-line media-review__loading-line--short" />
            </div>
          </article>
          <article className="media-review__state-example">
            <span>Locked</span>
            <div className="media-review__state-card media-review__locked">
              <img src={screens[1].thumbnailUrl ?? screens[1].url} alt="" />
              <span className="media-review__locked-overlay">
                <Button
                  label="Unlock more"
                  variant="primary"
                  size="md"
                  onClick={() => setLockedMessage('Unlock flow opened')}
                />
              </span>
            </div>
          </article>
          <article className="media-review__state-example">
            <span>Unavailable</span>
            <div className="media-review__state-card media-review__unavailable">
              <MediaGridCard
                label="Unavailable screen preview"
                kind="image"
                accent="#08bfe8"
                aspectRatio="16 / 10"
                onOpen={() => undefined}
              />
              <Button label="Try again" variant="secondary" size="sm" onClick={() => undefined} />
            </div>
          </article>
        </div>
        <p className="media-review__state-message" aria-live="polite">{lockedMessage}</p>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="Wide evidence remains comparable on desktop and becomes a single, edge-safe reading column on mobile."
      >
        <div className="media-review__responsive-grid">
          <article>
            <span>Wide desktop</span>
            <strong>3-column comparison</strong>
            <p>Minimum evidence width protects legibility before the grid reduces columns.</p>
          </article>
          <article>
            <span>Compact desktop</span>
            <strong>2-column scan</strong>
            <p>Actions remain reachable without changing the evidence aspect ratio.</p>
          </article>
          <article>
            <span>Mobile</span>
            <strong>1-column reading</strong>
            <p>Cards use the full content width and preview controls stay inside safe areas.</p>
          </article>
        </div>
      </ReviewSection>

      {previewIndex !== null ? (
        <ScreenPreviewDialog
          appName="Aboard"
          appIconUrl={APP_ICON}
          screen={screens[previewIndex]}
          index={previewIndex}
          total={screens.length}
          foundInFlows={previewIndex === 0 ? ['Onboarding'] : previewIndex === 1 ? ['Signup'] : ['People']}
          onClose={() => setPreviewIndex(null)}
          onNavigate={(index) => setPreviewIndex(index)}
        />
      ) : null}
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <MediaAndEvidenceReview />,
};
