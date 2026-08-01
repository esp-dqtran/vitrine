import type { Template, TemplateManager } from "@blocksuite/blocks";
import { DocCollection, Job, Text, type Doc } from "@blocksuite/store";

type CanvasTemplateDefinition = {
  id: string;
  name: string;
  category: "Product planning" | "Delivery";
  accent: string;
  cards: readonly {
    title: string;
    items: readonly string[];
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};

type TemplatePanelHost = {
  templates: TemplateManager;
};

type CanvasTemplateState = {
  activeDoc?: Doc;
  cache: WeakMap<object, Template[]>;
  manager: TemplateManager;
};

const canvasTemplateDefinitions: readonly CanvasTemplateDefinition[] = [
  {
    id: "user-story-map",
    name: "User Story Map",
    category: "Product planning",
    accent: "#1e96eb",
    cards: [
      {
        title: "Discover",
        items: ["Identify the user", "Capture the job to be done"],
        x: 0,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Decide",
        items: ["Define the happy path", "Agree on acceptance criteria"],
        x: 400,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Deliver",
        items: ["Slice the first release", "Measure the outcome"],
        x: 800,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Release 1",
        items: ["Must-have stories", "Dependencies and risks"],
        x: 0,
        y: 270,
        width: 560,
        height: 230,
      },
      {
        title: "Later",
        items: ["Follow-up stories", "Open questions"],
        x: 600,
        y: 270,
        width: 560,
        height: 230,
      },
    ],
  },
  {
    id: "product-discovery-board",
    name: "Product Discovery Board",
    category: "Product planning",
    accent: "#7c3aed",
    cards: [
      {
        title: "Problem",
        items: ["Who experiences it?", "What evidence do we have?"],
        x: 0,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Outcome",
        items: ["User behavior to change", "Success signal"],
        x: 400,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Assumptions",
        items: ["Value assumption", "Usability assumption"],
        x: 800,
        y: 0,
        width: 360,
        height: 230,
      },
      {
        title: "Experiments",
        items: ["Fastest test", "Evidence threshold"],
        x: 0,
        y: 270,
        width: 560,
        height: 230,
      },
      {
        title: "Decision",
        items: ["What we learned", "Next step and owner"],
        x: 600,
        y: 270,
        width: 560,
        height: 230,
      },
    ],
  },
  {
    id: "release-plan",
    name: "Release Plan",
    category: "Delivery",
    accent: "#059669",
    cards: [
      {
        title: "Now",
        items: ["Committed scope", "Owner and due date", "Known blockers"],
        x: 0,
        y: 0,
        width: 360,
        height: 270,
      },
      {
        title: "Next",
        items: ["Candidate scope", "Dependencies", "Validation needed"],
        x: 400,
        y: 0,
        width: 360,
        height: 270,
      },
      {
        title: "Later",
        items: ["Future opportunities", "Unresolved questions"],
        x: 800,
        y: 0,
        width: 360,
        height: 270,
      },
      {
        title: "Release readiness",
        items: ["Acceptance complete", "Analytics ready", "Rollout plan"],
        x: 0,
        y: 310,
        width: 560,
        height: 250,
      },
      {
        title: "Risks and decisions",
        items: ["Risk, impact, mitigation", "Decision, owner, date"],
        x: 600,
        y: 310,
        width: 560,
        height: 250,
      },
    ],
  },
] as const;

function templatePreview(definition: CanvasTemplateDefinition): string {
  const cards = definition.cards
    .map((card) => {
      const x = 12 + (card.x / 1160) * 220;
      const y = 16 + (card.y / 560) * 112;
      const width = (card.width / 1160) * 220;
      const height = (card.height / 560) * 112;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#17191d" stroke="#3b3f46"/><rect x="${x}" y="${y}" width="4" height="${height}" rx="2" fill="${definition.accent}"/><rect x="${x + 11}" y="${y + 11}" width="${Math.max(24, width * 0.45)}" height="4" rx="2" fill="#f4f5f7"/><rect x="${x + 11}" y="${y + 23}" width="${Math.max(20, width * 0.68)}" height="3" rx="1.5" fill="#8e949e"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 144" role="img" aria-label="${definition.name} preview"><rect width="244" height="144" rx="10" fill="#0f1012"/>${cards}</svg>`;
}

function buildTemplates(doc: Doc): Template[] {
  const collection = new DocCollection({ schema: doc.collection.schema });
  collection.meta.initialize();
  try {
    return canvasTemplateDefinitions.map((definition) => {
      const templateDoc = collection.createDoc({
        id: `astryx-canvas-template-${definition.id}`,
      });
      templateDoc.load();
      collection.setDocMeta(templateDoc.id, { title: definition.name });
      const pageId = templateDoc.addBlock("affine:page", {});
      templateDoc.addBlock("affine:surface", {}, pageId);
      for (const card of definition.cards) {
        const noteId = templateDoc.addBlock(
          "affine:note",
          { xywh: `[${card.x},${card.y},${card.width},${card.height}]` },
          pageId,
        );
        templateDoc.addBlock(
          "affine:paragraph",
          { type: "h2", text: new Text(card.title) },
          noteId,
        );
        for (const item of card.items) {
          templateDoc.addBlock(
            "affine:list",
            { type: "bulleted", text: new Text(item) },
            noteId,
          );
        }
      }
      const content = new Job({ collection }).docToSnapshot(templateDoc);
      if (!content) {
        throw new Error(`Unable to create ${definition.name} template`);
      }
      return {
        name: definition.name,
        content,
        preview: templatePreview(definition),
        type: "template",
      };
    });
  } finally {
    collection.dispose();
  }
}

function createTemplateManager(state: CanvasTemplateState): TemplateManager {
  const templates = () => {
    if (!state.activeDoc) return [];
    const schema = state.activeDoc.collection.schema;
    const cached = state.cache.get(schema);
    if (cached) return cached;
    const next = buildTemplates(state.activeDoc);
    state.cache.set(schema, next);
    return next;
  };
  return {
    categories: () => [
      ...new Set(canvasTemplateDefinitions.map(({ category }) => category)),
    ],
    list: (category) =>
      templates().filter(
        (template) =>
          canvasTemplateDefinitions.find(
            (definition) => definition.name === template.name,
          )?.category === category,
      ),
    search: (keyword, category) => {
      const normalized = keyword.trim().toLocaleLowerCase();
      return templates().filter((template) => {
        const definition = canvasTemplateDefinitions.find(
          (candidate) => candidate.name === template.name,
        );
        return (
          (!category || definition?.category === category) &&
          (!normalized ||
            template.name?.toLocaleLowerCase().includes(normalized))
        );
      });
    },
  };
}

const globalTemplateState = globalThis as typeof globalThis & {
  __astryxProjectDocumentCanvasTemplates?: CanvasTemplateState;
};

const state =
  globalTemplateState.__astryxProjectDocumentCanvasTemplates ??
  ({} as CanvasTemplateState);
state.cache ??= new WeakMap<object, Template[]>();
state.manager ??= createTemplateManager(state);
globalTemplateState.__astryxProjectDocumentCanvasTemplates = state;

export function configureProjectDocumentCanvasTemplates(
  panelHost: TemplatePanelHost,
  doc: Doc,
): () => void {
  state.activeDoc = doc;
  panelHost.templates.extend?.(state.manager);
  return () => {
    if (state.activeDoc === doc) state.activeDoc = undefined;
  };
}
