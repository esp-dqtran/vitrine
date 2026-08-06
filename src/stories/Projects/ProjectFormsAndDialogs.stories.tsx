import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@astryxdesign/core";

import type { ResearchProjectSummary } from "../../researchProject.ts";
import type { TeamSummary } from "../../vitrine/organizationsApi.ts";
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "../../vitrine/components/ProjectsPage.tsx";
import "../../vitrine/styles.css";
import "../../vitrine/projectsWorkspace.css";
import "../../vitrine/components/AstryxModal.css";
import "../../vitrine/productTypography.css";
import "../../vitrine/productSpacing.css";
import "../../vitrine/productShape.css";
import "../../vitrine/productMotion.css";
import "../../vitrine/productForms.css";
import "./ProjectFormsAndDialogs.css";

type DialogState = "create" | "rename" | "delete";

const teams: TeamSummary[] = [
  {
    id: 41,
    name: "Product design",
    slug: "product-design",
    role: "admin",
    memberCount: 8,
  },
];

const project: ResearchProjectSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Checkout redesign",
  icon: "sparkle",
  question: "Reduce checkout abandonment without adding friction.",
  platformFilter: "web",
  pinned: true,
  revision: 8,
  evidenceCount: 24,
  synthesisState: "current",
  updatedAt: "2026-08-04T08:30:00.000Z",
};

function DialogReview({ initialState }: { initialState: DialogState }) {
  const [dialog, setDialog] = useState<DialogState | null>(initialState);
  const [newTitle, setNewTitle] = useState("Checkout follow-up");
  const [scope, setScope] = useState("personal");
  const [renameTitle, setRenameTitle] = useState(project.title);

  return (
    <main className="project-dialog-review projects-workspace">
      <header className="project-dialog-review__intro">
        <p>Vitrines · Projects component system</p>
        <h1>Project Forms &amp; Dialogs</h1>
        <p>
          Review the real production create, rename, and destructive dialog
          components before applying further form changes.
        </p>
        <span>Visual review · Awaiting approval</span>
      </header>

      <section className="project-dialog-review__section">
        <div className="project-dialog-review__section-heading">
          <span>01</span>
          <div>
            <h2>Production dialog states</h2>
            <p>
              Every state uses the same modal surface, form spacing, input
              contract, and action hierarchy as the Projects screen.
            </p>
          </div>
        </div>
        <div className="project-dialog-review__launcher">
          <div>
            <strong>Choose a state to review</strong>
            <p>The selected dialog opens without changing the page layout.</p>
          </div>
          <div className="project-dialog-review__actions">
            <Button
              label="New project"
              variant="primary"
              clickAction={() => setDialog("create")}
            />
            <Button
              label="Rename"
              variant="secondary"
              clickAction={() => setDialog("rename")}
            />
            <Button
              label="Delete"
              variant="destructive"
              clickAction={() => setDialog("delete")}
            />
          </div>
        </div>
      </section>

      <section className="project-dialog-review__section">
        <div className="project-dialog-review__section-heading">
          <span>02</span>
          <div>
            <h2>Form contract</h2>
            <p>
              Labels stay visible, primary actions remain white with black text,
              and destructive emphasis appears only on confirmation.
            </p>
          </div>
        </div>
        <div className="project-dialog-review__contract-grid">
          <article>
            <span>CREATE</span>
            <strong>Name + destination</strong>
            <p>Project name and Personal or Team scope.</p>
          </article>
          <article>
            <span>RENAME</span>
            <strong>One editable value</strong>
            <p>The existing title is selected for a quick replacement.</p>
          </article>
          <article>
            <span>DELETE</span>
            <strong>Explicit consequence</strong>
            <p>The project name and permanent effect remain visible.</p>
          </article>
        </div>
      </section>

      <CreateProjectDialog
        isOpen={dialog === "create"}
        title={newTitle}
        scope={scope}
        teams={teams}
        isCreating={false}
        onTitleChange={setNewTitle}
        onScopeChange={setScope}
        onCancel={() => setDialog(null)}
        onSubmit={() => setDialog(null)}
      />
      <RenameProjectDialog
        project={dialog === "rename" ? project : null}
        title={renameTitle}
        isRenaming={false}
        onTitleChange={setRenameTitle}
        onCancel={() => setDialog(null)}
        onSubmit={() => setDialog(null)}
      />
      <DeleteProjectDialog
        project={dialog === "delete" ? project : null}
        isDeleting={false}
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      />
    </main>
  );
}

const meta = {
  title: "Projects/Component system/03 Project Forms and Dialogs",
  component: DialogReview,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
} satisfies Meta<typeof DialogReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VisualReview: Story = {
  args: { initialState: "create" },
};

export const Rename: Story = {
  args: { initialState: "rename" },
};

export const Delete: Story = {
  args: { initialState: "delete" },
};
