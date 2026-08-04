import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Icon, TextArea, TextInput } from "@astryxdesign/core";
import {
  AstryxModal,
  AstryxModalSurface,
} from "../../vitrine/components/AstryxModal";
import { ScreenGridCard } from "../../vitrine/components/ScreenGridCard";
import type { Screen } from "../../vitrine/types";
import "../../vitrine/styles.css";
import "../../vitrine/productTypography.css";
import "../../vitrine/productSpacing.css";
import "../../vitrine/productShape.css";
import "../../vitrine/productIconography.css";
import "../../vitrine/productMotion.css";
import "../../vitrine/productResponsive.css";
import "../../vitrine/components/AstryxModal.css";
import "./SaveToProjectAndHandoff.css";

const meta = {
  title: "Patterns/Save to Project and Evidence Handoff",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A production-grounded review of saving one App, Screen, or Flow into a Research Project, creating a destination, handling duplicate and error states, and continuing into the project.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const APP_ID = "aboard-ea683077-aadb-47c5-a771-d21fd9676510";
const PREVIEW_HOST = "http://127.0.0.1:5173";
const PREVIEW_URL = `${PREVIEW_HOST}/api/preview-media/${APP_ID}/1?variant=full`;

const PREVIEW_SCREEN: Screen = {
  id: 1,
  type: "Unclassified",
  productArea: "Unclassified",
  theme: "light",
  visibleStates: [],
  platform: "web",
  description: null,
  url: PREVIEW_URL,
  thumbnailUrl: null,
  visibleText: ["Work Habits & Professionalism"],
};

type SaveStep = "choose" | "create" | "saved" | "error";

const projects = [
  {
    id: "aboard-research",
    name: "Aboard research",
    detail: "12 references · Updated today",
    saved: true,
  },
  {
    id: "onboarding-audit",
    name: "Onboarding audit",
    detail: "8 references · Updated yesterday",
    saved: false,
  },
  {
    id: "workspace-patterns",
    name: "Workspace patterns",
    detail: "24 references · Updated Jul 31",
    saved: false,
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
    <section className="save-review__section">
      <header className="save-review__section-header">
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

function EvidencePreview({ onSave }: { onSave: () => void }) {
  return (
    <div
      className="save-review__production-card reference-detail app-detail--web"
      data-reference-detail="app"
    >
      <div data-reference-gallery-layout="web-screens">
        <ScreenGridCard
          screen={PREVIEW_SCREEN}
          accent="#08bfe8"
          delay={0}
          appName="Aboard"
          flowNames={["Onboarding"]}
          onOpen={() => undefined}
          onSave={onSave}
        />
      </div>
      <p>
        Hover or focus the production Screen card to reveal Save and Copy image.
      </p>
    </div>
  );
}

function ProjectOption({
  name,
  detail,
  selected,
  saved,
  onSelect,
}: {
  name: string;
  detail: string;
  selected?: boolean;
  saved?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className="save-review__project-option"
      aria-pressed={selected}
      data-selected={selected || undefined}
      onClick={onSelect}
    >
      <span className="save-review__project-icon">
        <Icon icon="viewColumns" size="sm" />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
      {saved ? (
        <span className="save-review__saved-label">
          <Icon icon="check" size="sm" /> Saved
        </span>
      ) : null}
      {!saved && selected ? <Icon icon="check" size="sm" /> : null}
    </button>
  );
}

function ChooseProjectSurface({
  selectedProject,
  onSelect,
  onCreate,
  onSave,
  onClose,
}: {
  selectedProject: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSave: () => void;
  onClose?: () => void;
}) {
  const selected = projects.find(({ id }) => id === selectedProject);
  return (
    <AstryxModalSurface className="save-review__dialog-surface">
      <header className="save-review__dialog-header">
        <div>
          <h3>Save to project</h3>
          <p>Keep this screen with the evidence for your next decision.</p>
        </div>
        {onClose ? (
          <Button label="Close" variant="ghost" size="sm" onClick={onClose} />
        ) : null}
      </header>
      <div className="save-review__dialog-body">
        <div className="save-review__dialog-search">
          <Icon icon="search" size="sm" />
          <span>Search projects…</span>
        </div>
        <div
          className="save-review__project-list"
          role="listbox"
          aria-label="Research projects"
        >
          {projects.map((project) => (
            <ProjectOption
              key={project.id}
              {...project}
              selected={selectedProject === project.id}
              onSelect={() => onSelect(project.id)}
            />
          ))}
        </div>
        <Button
          label="Create new project"
          variant="secondary"
          size="md"
          onClick={onCreate}
        />
      </div>
      <footer className="save-review__dialog-footer">
        <span>
          {selected?.saved
            ? "Already saved in this project"
            : selected
              ? `Save to ${selected.name}`
              : "Choose a project"}
        </span>
        <Button
          label={selected?.saved ? "Saved" : "Save to project"}
          variant="primary"
          size="md"
          isDisabled={!selected || selected.saved}
          onClick={onSave}
        />
      </footer>
    </AstryxModalSurface>
  );
}

function CreateProjectSurface({
  name,
  onNameChange,
  onBack,
  onCreate,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <AstryxModalSurface className="save-review__dialog-surface">
      <header className="save-review__dialog-header">
        <div>
          <h3>Create a project</h3>
          <p>The current screen will be saved when the project is created.</p>
        </div>
      </header>
      <div className="save-review__dialog-body save-review__form-body">
        <TextInput
          label="Project name"
          placeholder="I.e. “Onboarding audit”"
          value={name}
          onChange={onNameChange}
          width="100%"
        />
        <TextArea
          label="Description"
          placeholder="What decision should this evidence support?"
          rows={3}
          width="100%"
        />
      </div>
      <footer className="save-review__dialog-footer save-review__dialog-footer--actions">
        <Button label="Back" variant="secondary" size="md" onClick={onBack} />
        <Button
          label="Create and save"
          variant="primary"
          size="md"
          isDisabled={!name.trim()}
          onClick={onCreate}
        />
      </footer>
    </AstryxModalSurface>
  );
}

function ResultSurface({
  kind,
  onRetry,
  onClose,
}: {
  kind: "saved" | "error";
  onRetry?: () => void;
  onClose?: () => void;
}) {
  const saved = kind === "saved";
  return (
    <AstryxModalSurface className="save-review__dialog-surface save-review__result-surface">
      <span
        className={`save-review__result-icon save-review__result-icon--${kind}`}
      >
        <Icon icon={saved ? "check" : "close"} size="md" />
      </span>
      <div>
        <h3>
          {saved ? "Saved to Onboarding audit" : "Couldn’t save this screen"}
        </h3>
        <p>
          {saved
            ? "The screen and its source context are ready in the project."
            : "Your project is unchanged. Check your connection and try again."}
        </p>
      </div>
      <div className="save-review__result-actions">
        {saved ? (
          <>
            <Button
              label="Done"
              variant="secondary"
              size="md"
              onClick={onClose}
            />
            <Button label="View project" variant="primary" size="md" />
          </>
        ) : (
          <>
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              onClick={onClose}
            />
            <Button
              label="Try again"
              variant="primary"
              size="md"
              onClick={onRetry}
            />
          </>
        )}
      </div>
    </AstryxModalSurface>
  );
}

function SaveToProjectReview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<SaveStep>("choose");
  const [selectedProject, setSelectedProject] = useState("onboarding-audit");
  const [newProjectName, setNewProjectName] = useState("Onboarding audit");

  const openDialog = () => {
    setStep("choose");
    setDialogOpen(true);
  };

  return (
    <main className="save-review">
      <header className="save-review__intro">
        <div>
          <p className="save-review__eyebrow">Vitrines · Workflow patterns</p>
          <h1>Save to Project &amp; Evidence Handoff</h1>
          <p className="save-review__lede">
            Preserve source context, choose one clear destination, and continue
            into a decision-ready project.
          </p>
        </div>
        <span className="save-review__status">
          Visual review · App Detail pilot
        </span>
      </header>

      <ReviewSection
        index="01"
        title="Production entry point"
        description="The existing App Detail Save action starts the workflow without selecting or moving surrounding content."
      >
        <div className="save-review__entry-layout">
          <EvidencePreview onSave={openDialog} />
          <aside>
            <span>Save contract</span>
            <strong>One item, one destination</strong>
            <p>
              Apps, Screens, and Flows use the same action label and destination
              dialog.
            </p>
            <Button
              label="Open save dialog"
              variant="primary"
              size="md"
              onClick={openDialog}
            />
          </aside>
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Choose or create a destination"
        description="Existing projects stay scannable; creation remains available without leaving the evidence."
      >
        <div className="save-review__dialog-grid">
          <ChooseProjectSurface
            selectedProject="onboarding-audit"
            onSelect={() => undefined}
            onCreate={() => undefined}
            onSave={() => undefined}
          />
          <CreateProjectSurface
            name="Onboarding audit"
            onNameChange={() => undefined}
            onBack={() => undefined}
            onCreate={() => undefined}
          />
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Outcome and recovery"
        description="Success moves forward, duplicates remain harmless, and failures keep a direct retry path."
      >
        <div className="save-review__outcome-grid">
          <article className="save-review__outcome-card save-review__outcome-card--success">
            <Icon icon="check" size="md" />
            <div>
              <strong>Saved</strong>
              <span>View project is the primary follow-up.</span>
            </div>
            <Button label="View project" variant="primary" size="md" />
          </article>
          <article className="save-review__outcome-card">
            <Icon icon="check" size="md" />
            <div>
              <strong>Already saved</strong>
              <span>No duplicate reference is created.</span>
            </div>
            <Button label="View project" variant="secondary" size="md" />
          </article>
          <article className="save-review__outcome-card save-review__outcome-card--error">
            <Icon icon="close" size="md" />
            <div>
              <strong>Save failed</strong>
              <span>The project stays unchanged.</span>
            </div>
            <Button
              label="Try again"
              variant="primary"
              size="md"
              onClick={() => {
                setStep("error");
                setDialogOpen(true);
              }}
            />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="The same task becomes a focused sheet on compact screens, with actions always reachable."
      >
        <div className="save-review__responsive-contract">
          <article>
            <span>Desktop</span>
            <strong>560px focused dialog</strong>
            <p>
              Project rows remain compact and the destination action stays in
              the footer.
            </p>
          </article>
          <article>
            <span>Mobile</span>
            <strong>Full-width bottom sheet</strong>
            <p>
              One-column content, 16px gutters, and stacked actions prevent
              truncation.
            </p>
          </article>
          <article>
            <span>Navigation</span>
            <strong>Return context preserved</strong>
            <p>
              Done closes the dialog; View project opens the saved destination.
            </p>
          </article>
        </div>
      </ReviewSection>

      <AstryxModal
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        purpose="form"
        width={560}
        padding={0}
        className="save-review__live-dialog"
        aria-label="Save screen to project"
      >
        {step === "choose" ? (
          <ChooseProjectSurface
            selectedProject={selectedProject}
            onSelect={setSelectedProject}
            onCreate={() => setStep("create")}
            onSave={() => setStep("saved")}
            onClose={() => setDialogOpen(false)}
          />
        ) : null}
        {step === "create" ? (
          <CreateProjectSurface
            name={newProjectName}
            onNameChange={setNewProjectName}
            onBack={() => setStep("choose")}
            onCreate={() => setStep("saved")}
          />
        ) : null}
        {step === "saved" ? (
          <ResultSurface kind="saved" onClose={() => setDialogOpen(false)} />
        ) : null}
        {step === "error" ? (
          <ResultSurface
            kind="error"
            onRetry={() => setStep("choose")}
            onClose={() => setDialogOpen(false)}
          />
        ) : null}
      </AstryxModal>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <SaveToProjectReview />,
};
