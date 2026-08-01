import { BlockModel, defineBlockSchema } from "@blocksuite/store";
import type {} from "@blocksuite/affine-block-surface/effects";

export const PROJECT_DOCUMENT_EMBED_FLAVOUR =
  "affine:embed-iframe" as const;

export interface ProjectDocumentEmbedBlockProps {
  url: string;
  iframeUrl: string;
  title: string;
  caption: string;
  height: number;
}

export class ProjectDocumentEmbedBlockModel extends BlockModel<ProjectDocumentEmbedBlockProps> {}

export const ProjectDocumentEmbedBlockSchema = defineBlockSchema({
  flavour: PROJECT_DOCUMENT_EMBED_FLAVOUR,
  props: (): ProjectDocumentEmbedBlockProps => ({
    url: "",
    iframeUrl: "",
    title: "",
    caption: "",
    height: 400,
  }),
  metadata: {
    role: "content",
    version: 1,
    parent: ["affine:note"],
    children: [],
  },
  toModel: () => new ProjectDocumentEmbedBlockModel(),
});

declare global {
  namespace BlockSuite {
    interface BlockModels {
      "affine:embed-iframe": ProjectDocumentEmbedBlockModel;
    }
  }
}

export function createProjectDocumentEmbedProps(
  url = "",
): ProjectDocumentEmbedBlockProps {
  return {
    url,
    iframeUrl: url,
    title: "",
    caption: "",
    height: 400,
  };
}

const AFFINE_EMBED_EXCLUDED_DOMAINS = [
  "app.affine.pro",
  "insider.affine.pro",
  "affine.fail",
  "toeverything.app",
  "apple.getaffineapp.com",
] as const;

export function projectDocumentEmbedUrl(
  candidate: string,
): URL | undefined {
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "https:") return undefined;
    const hostname = url.hostname.toLocaleLowerCase();
    if (
      AFFINE_EMBED_EXCLUDED_DOMAINS.some(
        (domain) =>
          hostname === domain || hostname.endsWith(`.${domain}`),
      )
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}
