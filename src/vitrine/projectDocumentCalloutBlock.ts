import {
  BlockComponent,
  BlockViewExtension,
  type ExtensionType,
} from "@blocksuite/block-std";
import { css, html, nothing } from "lit";
import { literal } from "lit/static-html.js";

import {
  PROJECT_DOCUMENT_CALLOUT_FLAVOUR,
  type ProjectDocumentCalloutBlockModel,
} from "./projectDocumentCallout.ts";

const calloutTones = {
  blue: {
    background: "#edf5ff",
    border: "#cbdffd",
  },
  gray: {
    background: "#f5f6f8",
    border: "#dde1e7",
  },
  green: {
    background: "#edf8f1",
    border: "#c9e8d3",
  },
  yellow: {
    background: "#fff8db",
    border: "#f0df9e",
  },
  red: {
    background: "#fff0ee",
    border: "#f2cbc6",
  },
} as const;

type CalloutTone = keyof typeof calloutTones;

export class ProjectDocumentCalloutBlockComponent extends BlockComponent<ProjectDocumentCalloutBlockModel> {
  static override styles = css`
    :host {
      display: block;
      margin: 10px 0;
    }

    .astryx-callout {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
      box-sizing: border-box;
      width: 100%;
      padding: 14px 14px 14px 12px;
      border: 1px solid var(--astryx-callout-border);
      border-radius: 10px;
      background: var(--astryx-callout-background);
      color: var(--affine-text-primary-color, #182230);
    }

    .astryx-callout__icon {
      width: 34px;
      height: 34px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      font: inherit;
      font-size: 22px;
      text-align: center;
    }

    input.astryx-callout__icon:not(:disabled):focus {
      background: rgb(255 255 255 / 65%);
      outline: 2px solid rgb(43 115 230 / 28%);
    }

    .astryx-callout__text {
      width: 100%;
      min-height: 34px;
      resize: vertical;
      box-sizing: border-box;
      padding: 6px 2px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 15px;
      line-height: 1.55;
      outline: none;
    }

    .astryx-callout__text::placeholder {
      color: var(--affine-placeholder-color, #98a2b3);
    }

    .astryx-callout__actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .astryx-callout:hover .astryx-callout__actions,
    .astryx-callout:focus-within .astryx-callout__actions {
      opacity: 1;
    }

    .astryx-callout__actions select,
    .astryx-callout__actions button {
      min-height: 28px;
      border: 1px solid rgb(16 24 40 / 12%);
      border-radius: 7px;
      background: rgb(255 255 255 / 72%);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }

    .astryx-callout__actions button {
      padding: 4px 8px;
      color: #b42318;
    }
  `;

  private _updateText(value: string) {
    const text = this.model.text;
    if (!text || this.doc.readonly || text.toString() === value) return;
    this.doc.captureSync();
    if (value) {
      text.replace(0, text.length, value);
    } else {
      text.clear();
    }
  }

  private _updateIcon(value: string) {
    if (this.doc.readonly || value === this.model.icon) return;
    this.doc.captureSync();
    this.doc.updateBlock(this.model, { icon: value || "💡" });
  }

  private _updateTone(value: string) {
    if (
      this.doc.readonly ||
      !(value in calloutTones) ||
      value === this.model.tone
    ) {
      return;
    }
    this.doc.captureSync();
    this.doc.updateBlock(this.model, { tone: value });
  }

  override renderBlock() {
    const tone =
      calloutTones[this.model.tone as CalloutTone] ??
      calloutTones.blue!;
    const readOnly = this.doc.readonly;
    return html`
      <section
        class="astryx-callout"
        contenteditable="false"
        aria-label="Callout"
        style=${`--astryx-callout-background:${tone.background};--astryx-callout-border:${tone.border}`}
      >
        <input
          class="astryx-callout__icon"
          aria-label="Callout icon"
          maxlength="4"
          .value=${this.model.icon ?? "💡"}
          ?disabled=${readOnly}
          @input=${(event: InputEvent) =>
            this._updateIcon(
              (event.currentTarget as HTMLInputElement).value,
            )}
        />
        <textarea
          class="astryx-callout__text"
          aria-label="Callout text"
          placeholder="Type something that should stand out…"
          .value=${this.model.text?.toString() ?? ""}
          ?disabled=${readOnly}
          @input=${(event: InputEvent) =>
            this._updateText(
              (event.currentTarget as HTMLTextAreaElement).value,
            )}
        ></textarea>
        ${readOnly
          ? nothing
          : html`
              <div class="astryx-callout__actions">
                <select
                  aria-label="Callout color"
                  .value=${this.model.tone ?? "blue"}
                  @change=${(event: Event) =>
                    this._updateTone(
                      (event.currentTarget as HTMLSelectElement).value,
                    )}
                >
                  ${Object.keys(calloutTones).map(
                    (toneName) =>
                      html`<option value=${toneName}>${toneName}</option>`,
                  )}
                </select>
                <button
                  type="button"
                  @click=${() => {
                    this.doc.captureSync();
                    this.doc.deleteBlock(this.model);
                  }}
                >
                  Delete
                </button>
              </div>
            `}
      </section>
    `;
  }
}

export const ProjectDocumentCalloutBlockSpec: ExtensionType[] = [
  BlockViewExtension(
    PROJECT_DOCUMENT_CALLOUT_FLAVOUR,
    literal`astryx-callout`,
  ),
];

export function registerProjectDocumentCalloutBlock(
  registry: Pick<CustomElementRegistry, "define" | "get"> = customElements,
): void {
  if (!registry.get("astryx-callout")) {
    registry.define(
      "astryx-callout",
      ProjectDocumentCalloutBlockComponent,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "astryx-callout": ProjectDocumentCalloutBlockComponent;
  }
}
