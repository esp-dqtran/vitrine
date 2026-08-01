import {
  BlockComponent,
  BlockViewExtension,
  type ExtensionType,
} from "@blocksuite/block-std";
import { css, html, nothing } from "lit";
import { literal } from "lit/static-html.js";

import {
  PROJECT_DOCUMENT_EMBED_FLAVOUR,
  type ProjectDocumentEmbedBlockModel,
  projectDocumentEmbedUrl,
} from "./projectDocumentEmbed.ts";

export class ProjectDocumentEmbedBlockComponent extends BlockComponent<ProjectDocumentEmbedBlockModel> {
  static override styles = css`
    :host {
      display: block;
      margin: 12px 0;
    }

    .astryx-embed {
      overflow: hidden;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 10px;
      background: var(--affine-background-primary-color, #fff);
      color: var(--affine-text-primary-color, #182230);
    }

    .astryx-embed__idle {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 16px;
      background: var(--affine-background-secondary-color, #f7f8fa);
    }

    .astryx-embed__idle label {
      grid-column: 1 / -1;
      font-size: 13px;
      font-weight: 600;
    }

    .astryx-embed__idle input,
    .astryx-embed__caption {
      box-sizing: border-box;
      width: 100%;
      min-height: 36px;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 8px;
      background: var(--affine-background-primary-color, #fff);
      color: inherit;
      font: inherit;
    }

    .astryx-embed__idle input {
      padding: 7px 10px;
    }

    .astryx-embed button,
    .astryx-embed a {
      min-height: 32px;
      box-sizing: border-box;
      padding: 6px 10px;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 7px;
      background: var(--affine-background-primary-color, #fff);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 18px;
      text-decoration: none;
    }

    .astryx-embed__submit {
      border-color: #1e62d0 !important;
      background: #1e62d0 !important;
      color: #fff !important;
    }

    .astryx-embed__error {
      grid-column: 1 / -1;
      margin: 0;
      color: #b42318;
      font-size: 12px;
    }

    .astryx-embed__frame {
      display: block;
      width: 100%;
      border: 0;
      background: #f5f6f8;
    }

    .astryx-embed__toolbar {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 8px;
      border-top: 1px solid var(--affine-divider-color, #d9dee8);
    }

    .astryx-embed__title {
      min-width: 0;
      margin-right: auto;
      overflow: hidden;
      font-size: 13px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .astryx-embed__caption {
      min-height: 34px;
      padding: 7px 10px;
      border-width: 1px 0 0;
      border-radius: 0;
    }

    .astryx-embed__readonly-caption {
      padding: 8px 10px;
      border-top: 1px solid var(--affine-divider-color, #d9dee8);
      color: var(--affine-text-secondary-color, #667085);
      font-size: 12px;
    }

    .astryx-embed__delete {
      color: #b42318 !important;
    }
  `;

  private _error = "";

  private get _urlInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>(
      ".astryx-embed__url",
    );
  }

  override firstUpdated() {
    if (!this.model.url && !this.doc.readonly) {
      this._urlInput?.focus();
    }
  }

  private _saveUrl(candidate: string) {
    if (this.doc.readonly) return;
    const url = projectDocumentEmbedUrl(candidate);
    if (!url) {
      this._error =
        "Enter an HTTPS page that allows embedding. AFFiNE workspace URLs are excluded.";
      this.requestUpdate();
      return;
    }
    this._error = "";
    this.doc.captureSync();
    this.doc.updateBlock(this.model, {
      url: url.toString(),
      iframeUrl: url.toString(),
      title: url.hostname,
    });
  }

  private _updateCaption(value: string) {
    if (this.doc.readonly || value === this.model.caption) return;
    this.doc.captureSync();
    this.doc.updateBlock(this.model, { caption: value });
  }

  override renderBlock() {
    const embedUrl = projectDocumentEmbedUrl(
      this.model.iframeUrl || this.model.url,
    );
    const readOnly = this.doc.readonly;

    if (!embedUrl) {
      return html`
        <section
          class="astryx-embed"
          contenteditable="false"
          aria-label="Embed"
        >
          ${readOnly
            ? html`
                <div class="astryx-embed__idle">
                  <span>This embedded page is unavailable.</span>
                </div>
              `
            : html`
                <form
                  class="astryx-embed__idle"
                  @submit=${(event: SubmitEvent) => {
                    event.preventDefault();
                    this._saveUrl(this._urlInput?.value ?? "");
                  }}
                >
                  <label for="embed-url-${this.model.id}">
                    Embed a web page
                  </label>
                  <input
                    id="embed-url-${this.model.id}"
                    class="astryx-embed__url"
                    aria-label="Embed URL"
                    inputmode="url"
                    placeholder="https://…"
                  />
                  <button
                    class="astryx-embed__submit"
                    type="submit"
                  >
                    Embed
                  </button>
                  ${this._error
                    ? html`<p class="astryx-embed__error" role="alert">
                        ${this._error}
                      </p>`
                    : nothing}
                </form>
              `}
        </section>
      `;
    }

    return html`
      <section
        class="astryx-embed"
        contenteditable="false"
        aria-label="Embedded web page"
      >
        <iframe
          class="astryx-embed__frame"
          title=${this.model.title || embedUrl.hostname}
          src=${embedUrl.toString()}
          height=${String(this.model.height || 400)}
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts"
          allowfullscreen
        ></iframe>
        <div class="astryx-embed__toolbar">
          <span class="astryx-embed__title">
            ${this.model.title || embedUrl.hostname}
          </span>
          <a
            href=${this.model.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </a>
          ${readOnly
            ? nothing
            : html`
                <button
                  type="button"
                  @click=${() => {
                    this.doc.captureSync();
                    this.doc.updateBlock(this.model, {
                      url: "",
                      iframeUrl: "",
                      title: "",
                    });
                  }}
                >
                  Change
                </button>
                <button
                  class="astryx-embed__delete"
                  type="button"
                  @click=${() => {
                    this.doc.captureSync();
                    this.doc.deleteBlock(this.model);
                  }}
                >
                  Delete
                </button>
              `}
        </div>
        ${readOnly
          ? this.model.caption
            ? html`<div class="astryx-embed__readonly-caption">
                ${this.model.caption}
              </div>`
            : nothing
          : html`
              <input
                class="astryx-embed__caption"
                aria-label="Embed caption"
                placeholder="Add a caption…"
                .value=${this.model.caption ?? ""}
                @input=${(event: InputEvent) =>
                  this._updateCaption(
                    (event.currentTarget as HTMLInputElement).value,
                  )}
              />
            `}
      </section>
    `;
  }
}

export const ProjectDocumentEmbedBlockSpec: ExtensionType[] = [
  BlockViewExtension(
    PROJECT_DOCUMENT_EMBED_FLAVOUR,
    literal`astryx-embed-iframe`,
  ),
];

export function registerProjectDocumentEmbedBlock(
  registry: Pick<CustomElementRegistry, "define" | "get"> = customElements,
): void {
  if (!registry.get("astryx-embed-iframe")) {
    registry.define(
      "astryx-embed-iframe",
      ProjectDocumentEmbedBlockComponent,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "astryx-embed-iframe": ProjectDocumentEmbedBlockComponent;
  }
}
