import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Button,
  Icon,
  IconButton,
  Popover,
  TextInput,
  Tooltip,
} from '@astryxdesign/core';
import type { Screen } from '../../vitrine/types';
import {
  AstryxAlertModal,
  AstryxModal,
  AstryxModalSurface,
} from '../../vitrine/components/AstryxModal';
import { ScreenPreviewDialog } from '../../vitrine/components/ScreenPreviewDialog';
import { AstryxDropdownItem } from '../../vitrine/components/AstryxDropdown';
import '../../vitrine/styles.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productIconography.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/components/AstryxModal.css';
import '../../vitrine/components/AstryxDropdown.css';
import '../../vitrine/flowPreviewDialog.css';
import './OverlaysAndDialogs.css';

const meta = {
  title: 'Components/Overlays and Dialogs/Visual review',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Vitrines overlay contract for production previews, focused dialogs, confirmation alerts, popovers, tooltips, backdrops, and responsive behavior.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const previewScreen: Screen = {
  id: 1,
  type: 'Dashboard',
  productArea: 'Onboarding',
  theme: 'light',
  visibleStates: ['Default'],
  platform: 'web',
  description: 'Aboard onboarding dashboard',
  purpose: 'Review workspace activity and people insights.',
  componentNames: ['People overview', 'Activity summary'],
  layoutPatterns: ['Top navigation', 'Two-column dashboard'],
  responsiveViewport: 'desktop',
  confidence: 0.91,
  uiElements: [
    { type: 'Avatar', group: 'Imagery', layer: 'whole-screen', confidence: 0.92, reviewStatus: 'pending' },
    { type: 'Button', group: 'Control', layer: 'whole-screen', confidence: 0.96, reviewStatus: 'pending' },
    { type: 'Table', group: 'View', layer: 'whole-screen', confidence: 0.89, reviewStatus: 'pending' },
    { type: 'Text Field', group: 'Control', layer: 'whole-screen', confidence: 0.94, reviewStatus: 'pending' },
    { type: 'Top Navigation Bar', group: 'View', layer: 'whole-screen', confidence: 0.97, reviewStatus: 'pending' },
  ],
  url: '/landing/astryx-public-preview-real-flows.png',
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
    <section className="overlay-review__section">
      <header className="overlay-review__section-header">
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

function ProductionDialogLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="overlay-review__production-launcher">
      <div>
        <strong>Production ScreenPreviewDialog</strong>
        <p>The review opens the same component used by App Detail, without a handcrafted specimen.</p>
      </div>
      <Button label="Open production dialog" variant="primary" size="md" onClick={onOpen} />
    </div>
  );
}

function ScreenActionsDropdown({ className = '' }: { className?: string }) {
  return (
    <div
      className={`astryx-dropdown overlay-review__dropdown-menu ${className}`.trim()}
      role="menu"
      aria-label="More screen actions"
    >
      <AstryxDropdownItem label="Open original image" onSelect={() => undefined} />
      <AstryxDropdownItem label="Copy screen link" onSelect={() => undefined} />
      <AstryxDropdownItem label="View screen details" onSelect={() => undefined} />
    </div>
  );
}

function OverlaysAndDialogsReview() {
  const [previewOpen, setPreviewOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [projectName, setProjectName] = useState('Aboard research');

  return (
    <main className="overlay-review">
      <header className="overlay-review__intro">
        <div>
          <p className="overlay-review__eyebrow">Vitrines · Component system</p>
          <h1>Overlays &amp; Dialogs</h1>
          <p className="overlay-review__lede">
            Overlays preserve context, focus one decision, and provide a clear way back.
          </p>
        </div>
        <span className="overlay-review__status">Visual review · App Detail pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Production preview dialog"
        description="The App Detail screen preview defines backdrop, elevation, header actions, evidence stage, and centered footer actions."
      >
        <ProductionDialogLauncher onOpen={() => setPreviewOpen(true)} />
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Focused decisions"
        description="Use a standard dialog for reversible work and an alert dialog only when the action is destructive or difficult to undo."
      >
        <div className="overlay-review__decision-grid">
          <article className="overlay-review__decision-card">
            <span>Standard modal</span>
            <AstryxModalSurface className="overlay-review__dialog-specimen">
              <div>
                <strong>Create research project</strong>
                <p>Group saved screens and flows into one focused workspace.</p>
              </div>
              <div className="overlay-review__field-specimen">Aboard research</div>
              <footer>
                <Button label="Cancel" variant="secondary" size="md" />
                <Button label="Create project" variant="primary" size="md" />
              </footer>
            </AstryxModalSurface>
            <Button label="Open standard modal" variant="secondary" size="md" onClick={() => setDialogOpen(true)} />
          </article>

          <article className="overlay-review__decision-card">
            <span>Alert dialog</span>
            <AstryxModalSurface className="overlay-review__dialog-specimen overlay-review__dialog-specimen--alert">
              <div>
                <strong>Remove saved screen?</strong>
                <p>This removes the screen from this project. The source evidence remains available.</p>
              </div>
              <footer>
                <Button label="Keep screen" variant="secondary" size="md" />
                <Button label="Remove screen" variant="destructive" size="md" />
              </footer>
            </AstryxModalSurface>
            <Button label="Open alert dialog" variant="secondary" size="md" onClick={() => setAlertOpen(true)} />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Contextual overlays"
        description="Popover panels support short contextual tasks; tooltips explain unfamiliar icon actions without becoming a second interface."
      >
        <div className="overlay-review__context-grid">
          <article className="overlay-review__context-card">
            <span>Popover</span>
            <ScreenActionsDropdown />
            <Popover
              dialogLabel="Screen actions"
              hasAutoFocus={false}
              content={<ScreenActionsDropdown className="overlay-review__dropdown-menu--popover" />}
            >
              <Button label="Open popover" variant="secondary" size="md" />
            </Popover>
          </article>

          <article className="overlay-review__context-card">
            <span>Tooltip</span>
            <div className="overlay-review__tooltip-specimen" role="tooltip">Copy link</div>
            <Tooltip content="Copy link">
              <IconButton
                label="Copy link"
                icon={<Icon icon="externalLink" size="sm" />}
                variant="secondary"
              />
            </Tooltip>
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive and elevation contract"
        description="Dialog geometry adapts to the task and viewport while the elevation hierarchy remains stable."
      >
        <div className="overlay-review__contract-grid">
          <article>
            <span>Desktop dialog</span>
            <strong>24px radius</strong>
            <p>Keep 24–32px viewport gutters and cap the content width to the task.</p>
          </article>
          <article>
            <span>Mobile dialog</span>
            <strong>20px → full screen</strong>
            <p>Standard dialogs retain 12px gutters; evidence previews use the full viewport.</p>
          </article>
          <article>
            <span>Overlay depth</span>
            <strong>Panel → modal → preview</strong>
            <p>Increase shadow and backdrop strength only as interruption and focus increase.</p>
          </article>
        </div>
      </ReviewSection>

      {previewOpen ? (
        <ScreenPreviewDialog
          appName="Aboard"
          screen={previewScreen}
          index={0}
          total={1}
          onClose={() => setPreviewOpen(false)}
          onNavigate={() => undefined}
          foundInFlows={['Onboarding']}
        />
      ) : null}

      <AstryxModal
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        purpose="form"
        width={440}
      >
        <form className="overlay-review__live-dialog" onSubmit={(event) => { event.preventDefault(); setDialogOpen(false); }}>
          <div>
            <h2>Create research project</h2>
            <p>Group saved screens and flows into one focused workspace.</p>
          </div>
          <TextInput label="Project name" value={projectName} onChange={setProjectName} />
          <footer>
            <Button label="Cancel" variant="secondary" size="md" onClick={() => setDialogOpen(false)} />
            <Button label="Create project" variant="primary" size="md" type="submit" />
          </footer>
        </form>
      </AstryxModal>

      <AstryxAlertModal
        isOpen={alertOpen}
        onOpenChange={setAlertOpen}
        title="Remove saved screen?"
        description="This removes the screen from this project. The source evidence remains available."
        cancelLabel="Keep screen"
        actionLabel="Remove screen"
        actionVariant="destructive"
        onAction={() => setAlertOpen(false)}
      />
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <OverlaysAndDialogsReview />,
};
