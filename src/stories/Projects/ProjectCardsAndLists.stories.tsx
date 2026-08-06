import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { ResearchProjectSummary } from "../../researchProject.ts";
import {
  ProjectCard,
  type ProjectActions,
} from "../../vitrine/components/ProjectsPage.tsx";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "../../vitrine/styles.css";
import "../../vitrine/referenceDiscovery.css";
import "../../vitrine/projectsWorkspace.css";
import "../../vitrine/productTypography.css";
import "../../vitrine/productSpacing.css";
import "../../vitrine/productShape.css";
import "../../vitrine/productIconography.css";
import "../../vitrine/productMotion.css";
import "../../vitrine/productResponsive.css";
import "./ProjectCardsAndLists.css";

const meta = {
  title: "Projects/Component system/02 Project Cards and Lists",
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "Visual review of the production Projects list and project-card component, including ownership, permissions, actions, and responsive behavior.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const projects: ResearchProjectSummary[] = [
  {
    id: "c203b1e8-5489-47db-a58f-d4dbba644eaf",
    title: "Checkout redesign",
    icon: "sparkle",
    question: "Reduce checkout abandonment without adding friction.",
    platformFilter: "web",
    pinned: true,
    revision: 7,
    evidenceCount: 18,
    synthesisState: "current",
    updatedAt: "2026-08-03T09:00:00.000Z",
    access: { role: "owner", source: "personal", canManage: true },
  },
  {
    id: "606864ca-4665-49ec-b418-7c6741027dc3",
    title: "Mobile onboarding",
    icon: "grid",
    question: "Help new customers reach their first useful result faster.",
    platformFilter: "ios",
    pinned: false,
    revision: 4,
    evidenceCount: 11,
    synthesisState: "stale",
    updatedAt: "2026-07-30T09:00:00.000Z",
    organization: { id: 8, name: "Product design", role: "member" },
    access: { role: "editor", source: "team", canManage: false },
  },
  {
    id: "fbe2f698-a299-4c57-b10c-7dc9d754a99f",
    title: "Settings patterns",
    icon: "book",
    question: "Compare permission and account-management patterns.",
    platformFilter: "all",
    pinned: false,
    revision: 2,
    evidenceCount: 6,
    synthesisState: "none",
    updatedAt: "2026-07-24T09:00:00.000Z",
    organization: { id: 8, name: "Product design", role: "member" },
    access: { role: "viewer", source: "direct", canManage: false },
  },
];

const actions: ProjectActions = {
  open: () => undefined,
  create: async () => undefined,
  rename: async () => undefined,
  setPinned: async () => undefined,
  duplicate: async () => undefined,
  remove: async () => undefined,
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
    <section className="project-card-review__section">
      <header className="project-card-review__section-header">
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

function ProductionCard({ project }: { project: ResearchProjectSummary }) {
  return (
    <ProjectCard
      project={project}
      actions={actions}
      onRename={() => undefined}
      onDelete={() => undefined}
      onShare={() => undefined}
    />
  );
}

function ProjectCardsAndListsReview() {
  return (
    <main className="project-card-review projects-workspace">
      <header className="project-card-review__intro">
        <div>
          <p className="project-card-review__eyebrow">
            Vitrines · Projects component system
          </p>
          <h1>Project Cards &amp; Lists</h1>
          <p className="project-card-review__lede">
            Review the real production project card across ownership, access,
            actions, and responsive layouts before applying further changes.
          </p>
        </div>
        <span className="project-card-review__status">
          Visual review · Approved
        </span>
      </header>

      <ReviewSection
        index="01"
        title="Production project grid"
        description="The live card hierarchy stays consistent across personal and Team projects."
      >
        <div className="project-card-review__grid projects-workspace__grid">
          {projects.map((project) => (
            <ProductionCard key={project.id} project={project} />
          ))}
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Ownership and access"
        description="Personal owner, Team editor, and direct viewer permissions change actions without changing the card footprint."
      >
        <div className="project-card-review__access-grid">
          {projects.map((project, index) => (
            <article key={project.id}>
              <span className="project-card-review__specimen-label">
                {index === 0
                  ? "Personal owner"
                  : index === 1
                    ? "Team editor"
                    : "Direct viewer"}
              </span>
              <ProductionCard project={project} />
            </article>
          ))}
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Card actions"
        description="Pin and contextual actions remain over the preview; the menu opens locally without shifting the grid."
      >
        <div className="project-card-review__interaction">
          <ProductionCard project={projects[0]} />
          <div className="project-card-review__contract">
            <strong>Interaction contract</strong>
            <ol>
              <li>Open the card from its preview or identity area.</li>
              <li>Use the pin action without navigating.</li>
              <li>
                Open More actions for Share, Rename, Duplicate, or Delete.
              </li>
              <li>Escape returns focus to the menu trigger.</li>
            </ol>
          </div>
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="The same production card moves from three columns to two and then one; content order and actions stay unchanged."
      >
        <div className="project-card-review__responsive-grid">
          <article>
            <span>Desktop · 981+</span>
            <strong>Three-column grid</strong>
          </article>
          <article>
            <span>Tablet · 701–980</span>
            <strong>Two-column grid</strong>
          </article>
          <article>
            <span>Mobile · 700 and below</span>
            <strong>Single-column list</strong>
          </article>
        </div>
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <ProjectCardsAndListsReview />,
};
