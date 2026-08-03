import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  Icon,
} from '@astryxdesign/core';
import type { BadgeVariant } from '@astryxdesign/core';
import type { ProgressSnapshot, RowStatus } from '../../vitrine/types';
import { ProgressBannerView } from '../../vitrine/components/ProgressBanner';
import '../../vitrine/styles.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productIconography.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import './FeedbackAndStatus.css';

const meta = {
  title: 'Components/Feedback and Status/Visual review',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Vitrines feedback contract for import, analysis, save, empty, and irreversible-action states.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const statusVariant: Record<RowStatus, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  Complete: 'success',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

const lifecycleStatuses: RowStatus[] = [
  'Queued',
  'In progress',
  'Complete',
  'Needs attention',
  'Cancelled',
];

const progressSnapshot: ProgressSnapshot = {
  entries: [
    {
      id: 'aboard-crawl',
      stage: 'crawl',
      app: 'Aboard',
      done: 326,
      total: 624,
      status: 'running',
      message: 'Preparing screen evidence',
      updatedAt: '2026-08-03T09:42:00.000Z',
    },
    {
      id: 'linear-smart-crawl',
      stage: 'smart-crawl',
      app: 'Linear',
      done: 0,
      total: 0,
      status: 'running',
      message: 'Waiting for the first page',
      updatedAt: '2026-08-03T09:41:00.000Z',
    },
    {
      id: 'figma-caption',
      stage: 'caption',
      app: 'Figma',
      done: 42,
      total: 120,
      status: 'error',
      message: 'Connection interrupted',
      updatedAt: '2026-08-03T09:40:00.000Z',
    },
  ],
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
    <section className="feedback-review__section">
      <header className="feedback-review__section-header">
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

function FeedbackAndStatusReview() {
  return (
    <main className="feedback-review">
      <header className="feedback-review__intro">
        <div>
          <p className="feedback-review__eyebrow">Vitrines · Component system</p>
          <h1>Feedback &amp; Status</h1>
          <p className="feedback-review__lede">
            Every state explains what happened, what is happening now, and what the user can do next.
          </p>
        </div>
        <span className="feedback-review__status">Visual review · Apps pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Semantic feedback"
        description="Use persistent messages when the state matters beyond the action that triggered it."
      >
        <div className="feedback-review__banner-grid">
          <Banner
            status="info"
            title="Aboard import started"
            description="We found 624 screens and started preparing the library."
          />
          <Banner
            status="success"
            title="Analysis complete"
            description="Aboard is ready to browse, compare, and save to projects."
          />
          <Banner
            status="warning"
            title="Analysis paused"
            description="The remaining screens will continue when processing capacity is available."
            endContent={<Button label="View progress" variant="primary" size="md" />}
          />
          <Banner
            status="error"
            title="Import needs attention"
            description="We could not reach the source. Check the link and try again."
            endContent={<Button label="Try again" variant="destructive" size="md" />}
          />
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Lifecycle and progress"
        description="Badges summarize a record; progress explains active work and preserves the last useful result."
      >
        <div className="feedback-review__progress-layout">
          <article className="feedback-review__card">
            <span className="feedback-review__card-label">App lifecycle</span>
            <div className="feedback-review__badge-row" aria-label="App lifecycle statuses">
              {lifecycleStatuses.map((status) => (
                <Badge key={status} label={status} variant={statusVariant[status]} />
              ))}
            </div>
            <p>Use one status at a time. Keep category and plan labels visually separate.</p>
          </article>
          <article className="feedback-review__progress-card">
            <span className="feedback-review__card-label">Live import progress</span>
            <ProgressBannerView snapshot={progressSnapshot} />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Transient feedback"
        description="Confirm completed actions briefly; keep failures visible until the user understands them."
      >
        <div className="feedback-review__toast-layout">
          <article className="feedback-review__card">
            <span className="feedback-review__card-label">Completed action</span>
            <div className="screen-action-toast feedback-review__application-toast" role="status">
              <Icon icon="success" size="sm" />
              <strong>12 screens saved to Research project</strong>
            </div>
            <p>Auto-dismiss after the result is visible elsewhere in the interface.</p>
          </article>
          <article className="feedback-review__card">
            <span className="feedback-review__card-label">Action failed</span>
            <div className="feedback-review__toast-frame">
              <div
                className="screen-action-toast feedback-review__application-toast feedback-review__application-toast--error"
                role="alert"
              >
                <Icon icon="error" size="sm" />
                <strong>Copy failed. Check browser permissions and try again.</strong>
              </div>
            </div>
            <p>Do not auto-dismiss a failure before the recovery path is clear.</p>
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Empty and irreversible states"
        description="Empty states help users recover; alert dialogs slow down destructive decisions."
      >
        <div className="feedback-review__ending-grid">
          <article className="feedback-review__empty-card">
            <EmptyState
              title="No apps match these filters"
              description="Remove one or more filters to see more captured references."
              actions={<Button label="Clear filters" variant="primary" size="md" />}
            />
          </article>
          <article className="feedback-review__dialog-card">
            <AlertDialog
              isOpen
              isInline
              onOpenChange={() => undefined}
              title="Cancel Aboard analysis?"
              description="The completed screens will remain available, but unfinished analysis will stop."
              cancelLabel="Keep analyzing"
              actionLabel="Cancel analysis"
              actionVariant="destructive"
              onAction={() => undefined}
            />
          </article>
        </div>
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <FeedbackAndStatusReview />,
};
