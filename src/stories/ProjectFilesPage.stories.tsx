import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProjectFilesPage } from "../vitrine/components/ProjectFilesPage.tsx";
import "../vitrine/styles.css";
import "../vitrine/projectsWorkspace.css";

const PROJECT_ID = "d4fa4c04-c96a-45b4-9c5e-7eef08a59e12";
const originalFetch = globalThis.fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const previewFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith(`/api/research-projects/${PROJECT_ID}`)) {
    if (init?.method === "PATCH") {
      const input = JSON.parse(String(init.body)) as {
        title: string;
        icon: string;
      };
      return json({
        id: PROJECT_ID,
        title: input.title,
        icon: input.icon,
        question: "Make checkout feel faster and easier to trust.",
        platformFilter: "all",
        pinned: false,
        constraints: "",
        decision: "",
        rationale: "",
        openQuestions: "",
        revision: 4,
        lanes: [],
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-08-03T08:00:00.000Z",
      });
    }
    return json({
      id: PROJECT_ID,
      title: "Checkout redesign",
      icon: "initial",
      question: "Make checkout feel faster and easier to trust.",
      platformFilter: "all",
      pinned: false,
      constraints: "",
      decision: "",
      rationale: "",
      openQuestions: "",
      revision: 3,
      lanes: [],
      createdAt: "2026-07-28T08:00:00.000Z",
      updatedAt: "2026-08-02T08:00:00.000Z",
    });
  }
  if (url.endsWith(`/api/research-projects/${PROJECT_ID}/canvases`)) {
    if (init?.method === "POST") {
      return json(
        {
          id: "77777777-7777-4777-8777-777777777777",
          projectId: PROJECT_ID,
          title: "Untitled canvas",
          snapshot: null,
          revision: 1,
          createdAt: "2026-08-02T08:00:00.000Z",
          updatedAt: "2026-08-02T08:00:00.000Z",
        },
        201,
      );
    }
    return json([
      {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: PROJECT_ID,
        title: "Checkout flow exploration",
        revision: 8,
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-08-02T08:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        projectId: PROJECT_ID,
        title: "Competitor patterns",
        revision: 3,
        createdAt: "2026-07-30T08:00:00.000Z",
        updatedAt: "2026-08-01T08:00:00.000Z",
      },
    ]);
  }
  if (url.endsWith(`/api/research-projects/${PROJECT_ID}/documents`)) {
    return json([
      {
        id: 41,
        projectId: PROJECT_ID,
        title: "Product brief",
        icon: "document",
        isFavorite: true,
        pageWidth: "standard",
        collaborationDocumentId: "33333333-3333-4333-8333-333333333333",
        role: "editor",
        createdAt: "2026-07-29T08:00:00.000Z",
        updatedAt: "2026-08-02T07:30:00.000Z",
      },
      {
        id: 42,
        projectId: PROJECT_ID,
        title: "Research synthesis",
        icon: "idea",
        isFavorite: false,
        pageWidth: "standard",
        collaborationDocumentId: "44444444-4444-4444-8444-444444444444",
        role: "editor",
        createdAt: "2026-07-30T08:00:00.000Z",
        updatedAt: "2026-08-01T11:00:00.000Z",
      },
    ]);
  }
  return originalFetch(input, init);
};

const meta = {
  title: "Projects/Project files",
  component: ProjectFilesPage,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: "100vh",
          margin: -24,
          colorScheme: "dark",
        }}
      >
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    globalThis.fetch = previewFetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  },
} satisfies Meta<typeof ProjectFilesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Canvas: Story = {
  args: { projectId: PROJECT_ID, area: "canvas" },
};
export const Documents: Story = {
  args: { projectId: PROJECT_ID, area: "documents" },
};

export const Settings: Story = {
  args: { projectId: PROJECT_ID, area: "settings" },
};
