import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { ResearchProjectSummary } from "../researchProject.ts";
import {
  ResearchProjectsView,
  type ProjectActions,
} from "../vitrine/components/ResearchProjectsPage.tsx";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "../vitrine/styles.css";
import "../vitrine/referenceDiscovery.css";
import "../vitrine/projectsWorkspace.css";
import "../vitrine/components/AstryxDropdown.css";
import "../vitrine/components/AstryxModal.css";
import "../vitrine/productTypography.css";
import "../vitrine/productSpacing.css";
import "../vitrine/productShape.css";
import "../vitrine/productIconography.css";
import "../vitrine/productMotion.css";
import "../vitrine/productResponsive.css";
import "../vitrine/productDataDisplay.css";
import "../vitrine/productForms.css";

const initialProjects: ResearchProjectSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Checkout redesign",
    icon: "grid",
    question: "Make checkout faster and easier to trust.",
    platformFilter: "web",
    pinned: true,
    revision: 8,
    evidenceCount: 24,
    synthesisState: "current",
    updatedAt: "2026-08-04T08:30:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Mobile onboarding",
    icon: "sparkle",
    question: "Reduce the time from signup to the first useful action.",
    platformFilter: "ios",
    pinned: false,
    revision: 4,
    evidenceCount: 12,
    synthesisState: "stale",
    updatedAt: "2026-08-03T11:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Billing evidence",
    icon: "book",
    question: "Clarify upgrade, invoice, and cancellation decisions.",
    platformFilter: "web",
    pinned: false,
    revision: 3,
    evidenceCount: 9,
    synthesisState: "none",
    updatedAt: "2026-07-30T09:15:00.000Z",
  },
];

function ProjectsListScenario({
  state = "populated",
}: {
  state?: "populated" | "empty" | "loading" | "error";
}) {
  const [projects, setProjects] = useState(
    state === "populated" ? initialProjects : [],
  );

  const actions = useMemo<ProjectActions>(
    () => ({
      open: () => undefined,
      create: async (input) => {
        setProjects((current) => [
          {
            id: crypto.randomUUID(),
            title: input.title,
            icon: "initial",
            question: input.question,
            platformFilter: input.platformFilter,
            pinned: false,
            revision: 1,
            evidenceCount: 0,
            synthesisState: "none",
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);
      },
      rename: async (project, title) => {
        setProjects((current) =>
          current.map((item) =>
            item.id === project.id ? { ...item, title } : item,
          ),
        );
      },
      setPinned: async (project, pinned) => {
        setProjects((current) =>
          current.map((item) =>
            item.id === project.id ? { ...item, pinned } : item,
          ),
        );
      },
      duplicate: async (projectId) => {
        setProjects((current) => {
          const project = current.find((item) => item.id === projectId);
          if (!project) return current;
          return [
            {
              ...project,
              id: crypto.randomUUID(),
              title: `${project.title} copy`,
              pinned: false,
              updatedAt: new Date().toISOString(),
            },
            ...current,
          ];
        });
      },
      remove: async (projectId) => {
        setProjects((current) =>
          current.filter((project) => project.id !== projectId),
        );
      },
    }),
    [],
  );

  return (
    <ResearchProjectsView
      projects={projects}
      loading={state === "loading"}
      error={state === "error" ? "Projects could not be loaded." : ""}
      actions={actions}
    />
  );
}

const meta = {
  title: "Projects/Page 01 · Projects list",
  component: ProjectsListScenario,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "Page-by-page Vitrines design-system review using the real Projects list component. Review the populated page first, then verify empty, loading, error, and responsive states before production changes are approved.",
      },
    },
  },
} satisfies Meta<typeof ProjectsListScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VisualReview: Story = {
  args: { state: "populated" },
};

export const Empty: Story = {
  args: { state: "empty" },
};

export const Loading: Story = {
  args: { state: "loading" },
};

export const Error: Story = {
  args: { state: "error" },
};
