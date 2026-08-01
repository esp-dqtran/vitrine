import {
  BlockModel,
  Text,
  defineBlockSchema,
} from "@blocksuite/store";
import type {} from "@blocksuite/affine-block-surface/effects";

export const PROJECT_DOCUMENT_CALLOUT_FLAVOUR =
  "affine:callout" as const;

export interface ProjectDocumentCalloutBlockProps {
  text: Text;
  icon: string;
  tone: string;
}

export class ProjectDocumentCalloutBlockModel extends BlockModel<ProjectDocumentCalloutBlockProps> {}

export const ProjectDocumentCalloutBlockSchema = defineBlockSchema({
  flavour: PROJECT_DOCUMENT_CALLOUT_FLAVOUR,
  props: (): ProjectDocumentCalloutBlockProps => ({
    text: new Text(""),
    icon: "💡",
    tone: "blue",
  }),
  metadata: {
    role: "content",
    version: 1,
    parent: ["affine:note"],
    children: [],
  },
  toModel: () => new ProjectDocumentCalloutBlockModel(),
});

declare global {
  namespace BlockSuite {
    interface BlockModels {
      "affine:callout": ProjectDocumentCalloutBlockModel;
    }
  }
}

export function createProjectDocumentCalloutProps(
  text = "",
): ProjectDocumentCalloutBlockProps {
  return {
    text: new Text(text),
    icon: "💡",
    tone: "blue",
  };
}
