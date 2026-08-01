import {
  BlockViewIdentifier,
  type ExtensionType,
} from "@blocksuite/block-std";
import {
  ListBlockComponent,
  ParagraphBlockComponent,
} from "@blocksuite/blocks";
import { html } from "lit";
import { literal } from "lit/static-html.js";

export type ProjectDocumentTextAlignment = "left" | "center" | "right";

type AlignableBlockModel = {
  textAlign?: ProjectDocumentTextAlignment;
};

function blockTextAlignment(
  model: AlignableBlockModel,
): ProjectDocumentTextAlignment {
  return model.textAlign === "center" || model.textAlign === "right"
    ? model.textAlign
    : "left";
}

export class ProjectDocumentParagraphBlockComponent extends ParagraphBlockComponent {
  override renderBlock() {
    return html`
      <div
        class="astryx-aligned-text-block"
        style=${`text-align:${blockTextAlignment(
          this.model as typeof this.model & AlignableBlockModel,
        )}`}
      >
        ${super.renderBlock()}
      </div>
    `;
  }
}

export class ProjectDocumentListBlockComponent extends ListBlockComponent {
  override renderBlock() {
    return html`
      <div
        class="astryx-aligned-text-block"
        style=${`text-align:${blockTextAlignment(
          this.model as typeof this.model & AlignableBlockModel,
        )}`}
      >
        ${super.renderBlock()}
      </div>
    `;
  }
}

export const ProjectDocumentTextAlignmentBlockSpec: ExtensionType[] = [
  {
    setup: (container) => {
      container.override(
        BlockViewIdentifier("affine:paragraph"),
        () => literal`astryx-aligned-paragraph`,
      );
    },
  },
  {
    setup: (container) => {
      container.override(
        BlockViewIdentifier("affine:list"),
        () => literal`astryx-aligned-list`,
      );
    },
  },
];

export function registerProjectDocumentTextAlignmentBlocks(
  registry: Pick<CustomElementRegistry, "define" | "get"> = customElements,
): void {
  if (!registry.get("astryx-aligned-paragraph")) {
    registry.define(
      "astryx-aligned-paragraph",
      ProjectDocumentParagraphBlockComponent,
    );
  }
  if (!registry.get("astryx-aligned-list")) {
    registry.define(
      "astryx-aligned-list",
      ProjectDocumentListBlockComponent,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "astryx-aligned-paragraph": ProjectDocumentParagraphBlockComponent;
    "astryx-aligned-list": ProjectDocumentListBlockComponent;
  }
}
