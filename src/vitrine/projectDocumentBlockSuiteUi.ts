import { ColorScheme } from "@blocksuite/affine-model";
import { OverrideThemeExtension } from "@blocksuite/affine-shared/services";
import { signal } from "@preact/signals-core";

const projectDocumentCanvasAppTheme = signal(ColorScheme.Dark);
const projectDocumentCanvasSurfaceTheme = signal(ColorScheme.Light);

/**
 * BlockSuite renders Canvas chrome from the app theme and Canvas content from
 * the edgeless theme. Keep the document surface light while using Astryx's dark
 * component treatment for toolbars, menus, and toggles.
 */
export const ProjectDocumentCanvasThemeExtension = OverrideThemeExtension({
  getAppTheme: () => projectDocumentCanvasAppTheme,
  getEdgelessTheme: () => projectDocumentCanvasSurfaceTheme,
});

const toolbarLabels: Readonly<Record<string, string>> = {
  "edgeless-default-tool-button": "Select",
  "edgeless-frame-tool-button": "Frame",
  "edgeless-connector-tool-button": "Connector",
  "edgeless-link-tool-button": "Link",
  "edgeless-note-tool-button": "Note",
  "edgeless-note-senior-button": "Note",
  "edgeless-brush-tool-button": "Brush",
  "edgeless-eraser-tool-button": "Eraser",
  "edgeless-shape-tool-button": "Shape",
  "edgeless-text-tool-button": "Text",
  "edgeless-mindmap-tool-button": "Mind map",
  "edgeless-template-button": "Templates",
  "edgeless-lasso-tool-button": "Lasso",
  "edgeless-present-button": "Present",
  "edgeless-frame-order-button": "Frame order",
  "edgeless-navigator-setting-button": "Presentation settings",
  "zoom-bar-toggle-button": "Zoom controls",
};

const zoomToolbarLabels = ["Fit to screen", "Zoom out", "Zoom in"] as const;
const focusStyleMarker = "data-astryx-project-document-focus";
const integrationStyleMarker = "data-astryx-project-document-integration";
const canvasToolbarControlSelector =
  "edgeless-toolbar-button, edgeless-tool-icon-button";
const blockDragHandleSelector = ".affine-drag-handle-container";
const editorDropdownControlSelector = ".paragraph-button-icon, .highlight-icon";
const editorMenuActionSelector = "editor-menu-action:not([disabled])";
const blockSuitePopoverSurfaceSelector = [
  "link-popup",
  "reference-popup",
  "reference-alias-popup",
  "affine-linked-doc-popover",
  "affine-mobile-linked-doc-menu",
  "date-picker",
  "affine-multi-tag-select",
].join(", ");
const enhancedSurfaceSelector = [
  "inner-slash-menu",
  "editor-toolbar",
  "editor-menu-content",
  "editor-menu-action",
  ".highligh-panel-heading",
  "affine-menu",
  "affine-format-bar-widget",
  "affine-drag-handle-widget",
  blockSuitePopoverSurfaceSelector,
].join(", ");
const databaseDropdownControlSelector = [
  ".database-view-button",
  ".affine-database-filter-button",
  ".affine-database-sort-button",
  ".affine-database-toolbar-item.more-action",
  ".affine-select-cell-container",
].join(", ");
const accessibleControlSelector = [
  canvasToolbarControlSelector,
  "editor-icon-button",
  "editor-menu-action",
  "affine-menu-button",
  "icon-button",
  ".tag-delete-icon",
  ".select-option-icon",
  blockDragHandleSelector,
  databaseDropdownControlSelector,
].join(", ");
const blockSuitePortalSelector = [
  "affine-slash-menu",
  "affine-menu",
  blockSuitePopoverSurfaceSelector,
].join(", ");
const emptyParagraphPlaceholderSelector =
  ".affine-paragraph-placeholder.visible";
const formatToggleIds = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

export function projectDocumentToolbarLabel(
  hostTagName: string,
  tooltip?: unknown,
  siblingIndex = -1,
): string | undefined {
  const normalized = hostTagName.toLocaleLowerCase();
  if (normalized === "edgeless-zoom-toolbar") {
    return zoomToolbarLabels[siblingIndex];
  }
  if (
    typeof tooltip === "string" &&
    tooltip.trim() &&
    tooltip.trim().toLocaleLowerCase() !== "others"
  ) {
    return tooltip.trim();
  }
  const standardLabel = toolbarLabels[normalized];
  if (standardLabel) return standardLabel;
  return undefined;
}

type AccessibleControl = HTMLElement & {
  active?: boolean;
  disabled?: boolean;
  hover?: boolean | string;
  text?: unknown;
  tooltip?: unknown;
};

type DecoratedControl = {
  ariaDisabled: string | null;
  ariaExpanded: string | null;
  ariaHasPopup: string | null;
  ariaLabel: string | null;
  ariaPressed: string | null;
  ariaRoleDescription: string | null;
  ariaSelected: string | null;
  focusStyle?: HTMLStyleElement;
  keydown: (event: KeyboardEvent) => void;
  role: string | null;
  tabIndex: string | null;
  title: string | null;
};

type EnhancedSurface = {
  ariaLevel?: string | null;
  ariaLabel: string | null;
  maxHeight?: string;
  noResults?: HTMLElement;
  role: string | null;
  style?: HTMLStyleElement;
  tabIndex: string | null;
  transform?: string;
};

type DecoratedPopupPart = {
  ariaActiveDescendant: string | null;
  ariaAutocomplete: string | null;
  ariaControls: string | null;
  ariaCurrent: string | null;
  ariaExpanded: string | null;
  ariaLabel: string | null;
  ariaSelected: string | null;
  id: string | null;
  role: string | null;
  tabIndex: string | null;
};

type DecoratedEmptyParagraph = {
  ariaHidden: string | null;
  editor: HTMLElement;
  editorAriaPlaceholder: string | null;
};

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

export function projectDocumentBlockSuiteControlLabel(
  control: Pick<AccessibleControl, "text" | "tooltip"> & {
    ariaLabel?: unknown;
    className?: unknown;
    textContent?: unknown;
  },
  hostTagName = "",
  siblingIndex = -1,
): string | undefined {
  const classNames =
    typeof control.className === "string"
      ? new Set(control.className.split(/\s+/).filter(Boolean))
      : new Set<string>();
  if (classNames.has("affine-drag-handle-container")) {
    return "Select or drag block";
  }
  if (classNames.has("paragraph-button-icon")) return "Text style";
  if (classNames.has("highlight-icon")) return "Highlight color";
  if (classNames.has("affine-confirm-button")) return "Apply link";
  if (classNames.has("tag-delete-icon")) return "Remove value";
  if (classNames.has("select-option-icon")) return "Edit value";
  if (classNames.has("affine-database-filter-button")) return "Filter database";
  if (classNames.has("affine-database-sort-button")) return "Sort database";
  if (
    classNames.has("affine-database-toolbar-item") &&
    classNames.has("more-action")
  ) {
    return "More database actions";
  }
  if (classNames.has("affine-select-cell-container")) {
    const value =
      typeof control.textContent === "string" ? control.textContent.trim() : "";
    return value ? `Select value: ${value}` : "Select database value";
  }
  if (classNames.has("database-view-button")) {
    const view =
      typeof control.textContent === "string" ? control.textContent.trim() : "";
    if (classNames.has("selected")) {
      return view ? `${view} settings` : "Database view settings";
    }
    if (classNames.has("dv-icon-16") && !view) return "Add database view";
    return view ? `Switch to ${view}` : "Database view";
  }
  if (typeof control.ariaLabel === "string" && control.ariaLabel.trim()) {
    return control.ariaLabel.trim();
  }

  const toolbarLabel = projectDocumentToolbarLabel(
    hostTagName,
    control.tooltip,
    siblingIndex,
  );
  if (toolbarLabel) return toolbarLabel;
  if (typeof control.tooltip === "string" && control.tooltip.trim()) {
    return control.tooltip.trim();
  }
  if (typeof control.text === "string" && control.text.trim()) {
    return control.text.trim();
  }
  if (typeof control.textContent === "string" && control.textContent.trim()) {
    return control.textContent.trim();
  }
  return undefined;
}

export function installProjectDocumentBlockSuiteAccessibility(
  editor: HTMLElement,
): () => void {
  const decorated = new Map<AccessibleControl, DecoratedControl>();
  const decoratedEmptyParagraphs = new Map<
    HTMLElement,
    DecoratedEmptyParagraph
  >();
  const decoratedPopupParts = new Map<HTMLElement, DecoratedPopupPart>();
  const enhancedSurfaces = new Map<HTMLElement, EnhancedSurface>();
  const observers = new Map<Node, MutationObserver>();
  const animationFrames = new Set<number>();
  let popupPartSequence = 0;
  let active = true;

  const scheduleFrame = (callback: () => void) => {
    const handle = window.requestAnimationFrame(() => {
      animationFrames.delete(handle);
      if (active) callback();
    });
    animationFrames.add(handle);
  };

  const decoratePopupPart = (
    element: HTMLElement,
    attributes: Partial<Record<keyof DecoratedPopupPart, string | null>>,
  ) => {
    if (!decoratedPopupParts.has(element)) {
      decoratedPopupParts.set(element, {
        ariaActiveDescendant: element.getAttribute("aria-activedescendant"),
        ariaAutocomplete: element.getAttribute("aria-autocomplete"),
        ariaControls: element.getAttribute("aria-controls"),
        ariaCurrent: element.getAttribute("aria-current"),
        ariaExpanded: element.getAttribute("aria-expanded"),
        ariaLabel: element.getAttribute("aria-label"),
        ariaSelected: element.getAttribute("aria-selected"),
        id: element.getAttribute("id"),
        role: element.getAttribute("role"),
        tabIndex: element.getAttribute("tabindex"),
      });
    }
    const attributeNames: Record<keyof DecoratedPopupPart, string> = {
      ariaActiveDescendant: "aria-activedescendant",
      ariaAutocomplete: "aria-autocomplete",
      ariaControls: "aria-controls",
      ariaCurrent: "aria-current",
      ariaExpanded: "aria-expanded",
      ariaLabel: "aria-label",
      ariaSelected: "aria-selected",
      id: "id",
      role: "role",
      tabIndex: "tabindex",
    };
    Object.entries(attributes).forEach(([key, value]) =>
      restoreAttribute(
        element,
        attributeNames[key as keyof DecoratedPopupPart],
        value,
      ),
    );
  };

  const syncDatePickerParts = (picker: HTMLElement) => {
    const root = picker.shadowRoot;
    if (!root) return;
    const grid = root.querySelector<HTMLElement>(".date-picker-weeks");
    if (grid) decoratePopupPart(grid, { role: "grid" });
    root.querySelectorAll<HTMLElement>(".date-picker-week").forEach((week) =>
      decoratePopupPart(week, {
        role: "row",
      }),
    );
    root
      .querySelectorAll<HTMLElement>(".days-header .date-cell")
      .forEach((heading) =>
        decoratePopupPart(heading, {
          role: "columnheader",
        }),
      );
    root
      .querySelectorAll<HTMLElement>("button.date-cell[data-date]")
      .forEach((cell) => {
        const [year, month, day] = (cell.dataset.date ?? "")
          .match(/^(\d+)-(\d+)-(\d+)/)
          ?.slice(1)
          .map(Number) ?? [0, 0, 0];
        const date = new Date(year, month, day);
        const label =
          year && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat(undefined, {
                day: "numeric",
                month: "long",
                weekday: "long",
                year: "numeric",
              }).format(date)
            : cell.getAttribute("aria-label");
        decoratePopupPart(cell, {
          ariaCurrent: cell.classList.contains("date-cell--today")
            ? "date"
            : null,
          ariaLabel: label,
          ariaSelected: String(cell.classList.contains("date-cell--selected")),
          role: "gridcell",
        });
      });
  };

  const syncLinkPopupParts = (popup: HTMLElement) => {
    const type = (popup as HTMLElement & { type?: string }).type;
    popup.setAttribute(
      "aria-label",
      type === "edit"
        ? "Edit link"
        : type === "view"
          ? "Link options"
          : "Add link",
    );
    const root = popup.shadowRoot;
    if (!root) return;
    const textInput = root.querySelector<HTMLElement>("#text-input");
    const linkInput = root.querySelector<HTMLElement>("#link-input");
    if (textInput) decoratePopupPart(textInput, { ariaLabel: "Link text" });
    if (linkInput) decoratePopupPart(linkInput, { ariaLabel: "Link URL" });
  };

  const syncMultiTagSelectParts = (select: HTMLElement) => {
    const input = select.querySelector<HTMLElement>(".tag-select-input");
    const list = select.querySelector<HTMLElement>(".select-options-container");
    if (!input || !list) return;
    if (!list.id) {
      popupPartSequence += 1;
      decoratePopupPart(list, {
        id: `astryx-value-options-${popupPartSequence}`,
      });
    }
    decoratePopupPart(list, {
      ariaLabel: "Available values",
      role: "listbox",
    });
    const selected = select.querySelector<HTMLElement>(
      ".select-option.selected",
    );
    select.querySelectorAll<HTMLElement>(".select-option").forEach((option) => {
      if (!option.id) {
        popupPartSequence += 1;
        decoratePopupPart(option, {
          id: `astryx-value-option-${popupPartSequence}`,
        });
      }
      decoratePopupPart(option, {
        ariaSelected: String(option.classList.contains("selected")),
        role: "option",
      });
    });
    decoratePopupPart(input, {
      ariaActiveDescendant: selected?.id || null,
      ariaAutocomplete: "list",
      ariaControls: list.id,
      ariaExpanded: "true",
      ariaLabel: "Search or create a value",
      role: "combobox",
    });
  };

  const dropdownPanelForControl = (
    control: AccessibleControl,
  ): HTMLElement | null =>
    control
      .closest(".paragraph-button, .highlight-button")
      ?.querySelector<HTMLElement>("editor-menu-content") ?? null;

  const editorMenuPanelForControl = (
    control: AccessibleControl,
  ): HTMLElement | null => {
    const root = control.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    if (!root.host.matches("editor-menu-button")) return null;
    return root.querySelector<HTMLElement>("editor-menu-content");
  };

  const dropdownControlForPanel = (
    panel: HTMLElement,
  ): AccessibleControl | null => {
    const root = panel.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    const selector = panel.classList.contains("paragraph-panel")
      ? ".paragraph-button-icon"
      : ".highlight-icon";
    return root.querySelector<AccessibleControl>(selector);
  };

  const closeEditorDropdown = (panel: HTMLElement, restoreFocus = true) => {
    panel.style.display = "none";
    const trigger = dropdownControlForPanel(panel);
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  };

  const openEditorDropdown = (control: AccessibleControl) => {
    const reference = control.closest<HTMLElement>(
      ".paragraph-button, .highlight-button",
    );
    const panel = dropdownPanelForControl(control);
    if (!reference || !panel) return;

    reference.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        composed: true,
      }),
    );
    control.setAttribute("aria-expanded", "true");

    scheduleFrame(() =>
      scheduleFrame(() => {
        const firstAction = panel.querySelector<HTMLElement>(
          editorMenuActionSelector,
        );
        firstAction?.focus({ preventScroll: true });
      }),
    );
  };

  const openEditorMenu = (control: AccessibleControl) => {
    const panel = editorMenuPanelForControl(control);
    if (!panel) return;
    if (!panel.hasAttribute("data-show")) control.click();
    scheduleFrame(() => {
      const firstAction = (
        panel.getRootNode() as ShadowRoot
      ).host.querySelector<HTMLElement>(editorMenuActionSelector);
      firstAction?.focus({ preventScroll: true });
    });
  };

  const moveEditorMenuFocus = (
    control: AccessibleControl,
    key: "ArrowDown" | "ArrowUp" | "Home" | "End",
  ) => {
    const panel = control.closest<HTMLElement>("editor-menu-content");
    if (!panel) return false;
    const actions = [
      ...panel.querySelectorAll<AccessibleControl>(editorMenuActionSelector),
    ];
    if (!actions.length) return false;
    const currentIndex = Math.max(0, actions.indexOf(control));
    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? actions.length - 1
          : key === "ArrowDown"
            ? (currentIndex + 1) % actions.length
            : (currentIndex - 1 + actions.length) % actions.length;
    actions[nextIndex]?.focus({ preventScroll: true });
    return true;
  };

  const syncState = (control: AccessibleControl) => {
    const isCanvasToolbarControl = control.matches(
      canvasToolbarControlSelector,
    );
    const isFormatToggle =
      control.matches("editor-icon-button") &&
      formatToggleIds.has(control.dataset.testid ?? "");
    if (
      typeof control.active === "boolean" &&
      (isCanvasToolbarControl || isFormatToggle)
    ) {
      const pressed = String(control.active);
      if (control.getAttribute("aria-pressed") !== pressed) {
        control.setAttribute("aria-pressed", pressed);
      }
    }
    if (control.getRootNode() instanceof ShadowRoot) {
      const rootHost = (control.getRootNode() as ShadowRoot).host;
      if (rootHost.matches("inner-slash-menu")) {
        const selected = control.hover === true || control.hover === "true";
        if (control.getAttribute("aria-selected") !== String(selected)) {
          control.setAttribute("aria-selected", String(selected));
        }
      }
    }
    if (typeof control.disabled === "boolean") {
      const disabled = String(control.disabled);
      if (control.getAttribute("aria-disabled") !== disabled) {
        control.setAttribute("aria-disabled", disabled);
      }
    }
    if (control.matches(editorDropdownControlSelector)) {
      const panel = dropdownPanelForControl(control);
      const expanded =
        panel !== null && window.getComputedStyle(panel).display !== "none";
      control.setAttribute("aria-haspopup", "menu");
      control.setAttribute("aria-expanded", String(expanded));
    }
    const editorMenuPanel = editorMenuPanelForControl(control);
    if (editorMenuPanel) {
      control.setAttribute("aria-haspopup", "menu");
      control.setAttribute(
        "aria-expanded",
        String(editorMenuPanel.hasAttribute("data-show")),
      );
    }
    if (control.matches(databaseDropdownControlSelector)) {
      const label = projectDocumentBlockSuiteControlLabel({
        ariaLabel: "",
        className: control.className,
        text: control.text,
        textContent: control.textContent,
        tooltip: control.tooltip,
      });
      if (label) control.setAttribute("aria-label", label);
      const opensMenu = control.matches(
        ".database-view-button.selected, .affine-database-filter-button, .affine-database-sort-button, .affine-database-toolbar-item.more-action, .affine-select-cell-container",
      );
      if (opensMenu) control.setAttribute("aria-haspopup", "menu");
      else control.removeAttribute("aria-haspopup");
    }
    if (control.matches(".select-option-icon")) {
      control.setAttribute("aria-haspopup", "menu");
    }
  };

  const decorate = (control: AccessibleControl) => {
    if (decorated.has(control)) {
      syncState(control);
      return;
    }
    const root = control.getRootNode();
    const rootHost = root instanceof ShadowRoot ? root.host : undefined;
    const siblings =
      root instanceof ShadowRoot
        ? [...root.querySelectorAll(accessibleControlSelector)]
        : [];
    const label = projectDocumentBlockSuiteControlLabel(
      {
        ariaLabel: control.getAttribute("aria-label"),
        className: control.className,
        text: control.text,
        textContent: control.textContent,
        tooltip: control.tooltip,
      },
      rootHost?.tagName ?? "",
      siblings.indexOf(control),
    );
    if (!label) return;

    const previous: DecoratedControl = {
      ariaDisabled: control.getAttribute("aria-disabled"),
      ariaExpanded: control.getAttribute("aria-expanded"),
      ariaHasPopup: control.getAttribute("aria-haspopup"),
      ariaLabel: control.getAttribute("aria-label"),
      ariaPressed: control.getAttribute("aria-pressed"),
      ariaRoleDescription: control.getAttribute("aria-roledescription"),
      ariaSelected: control.getAttribute("aria-selected"),
      tabIndex: control.getAttribute("tabindex"),
      title: control.getAttribute("title"),
      role: control.getAttribute("role"),
      keydown: (event) => {
        if (
          control.matches("editor-menu-action") &&
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
          moveEditorMenuFocus(
            control,
            event.key as "ArrowDown" | "ArrowUp" | "Home" | "End",
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (control.matches("editor-menu-action") && event.key === "Escape") {
          const panel = control.closest<HTMLElement>("editor-menu-content");
          if (panel) {
            event.preventDefault();
            event.stopPropagation();
            closeEditorDropdown(panel);
            return;
          }
        }
        if (
          control.matches(editorDropdownControlSelector) &&
          ["Enter", " ", "ArrowDown"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          openEditorDropdown(control);
          return;
        }
        if (editorMenuPanelForControl(control) && event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          openEditorMenu(control);
          return;
        }
        if ((event.key === "Enter" || event.key === " ") && !control.disabled) {
          event.preventDefault();
          control.click();
        }
      },
    };

    control.setAttribute("aria-label", label);
    if (rootHost?.matches("inner-slash-menu")) {
      control.setAttribute("role", "option");
    } else if (control.matches("editor-menu-action, affine-menu-button")) {
      control.setAttribute("role", "menuitem");
    } else if (control.matches(databaseDropdownControlSelector)) {
      control.setAttribute("role", "button");
    } else if (control.matches(".tag-delete-icon, .select-option-icon")) {
      control.setAttribute("role", "button");
    } else if (control.matches(blockDragHandleSelector)) {
      control.setAttribute("role", "button");
      control.setAttribute("aria-roledescription", "drag handle");
      control.setAttribute("title", label);
    }
    control.tabIndex = 0;
    control.addEventListener("keydown", previous.keydown);
    syncState(control);

    if (
      control.shadowRoot &&
      !control.shadowRoot.querySelector(`[${focusStyleMarker}]`)
    ) {
      const focusStyle = document.createElement("style");
      focusStyle.setAttribute(focusStyleMarker, "");
      focusStyle.textContent = `
        :host(:focus-visible) {
          outline: 2px solid var(--color-accent, #1e96eb);
          outline-offset: 2px;
          border-radius: var(--radius-element, 8px);
        }
      `;
      control.shadowRoot.append(focusStyle);
      previous.focusStyle = focusStyle;
    }

    decorated.set(control, previous);
  };

  const syncSurface = (element: HTMLElement) => {
    const existing = enhancedSurfaces.get(element);
    if (existing) {
      if (element.matches("inner-slash-menu")) {
        const renderedMenu =
          element.shadowRoot?.querySelector<HTMLElement>(".slash-menu");
        if (renderedMenu) {
          existing.transform = renderedMenu.style.transform;
          existing.maxHeight = renderedMenu.style.maxHeight;
        }
        const root = element.getRootNode();
        const isMainSlashMenu =
          root instanceof ShadowRoot && root.host.matches("affine-slash-menu");
        const shouldShowNoResults = isMainSlashMenu && !renderedMenu;
        if (shouldShowNoResults && !existing.noResults?.isConnected) {
          const noResults = document.createElement("div");
          noResults.className = "astryx-slash-menu-empty";
          noResults.setAttribute("role", "status");
          noResults.textContent = "No matching blocks. Try another command.";
          element.shadowRoot?.append(noResults);
          existing.noResults = noResults;
        } else if (!shouldShowNoResults && existing.noResults) {
          existing.noResults.remove();
          existing.noResults = undefined;
        }
        if (existing.noResults) {
          if (existing.transform) {
            existing.noResults.style.transform = existing.transform;
          }
          if (existing.maxHeight) {
            existing.noResults.style.maxHeight = existing.maxHeight;
          }
        }
      }
      if (element.matches("link-popup")) syncLinkPopupParts(element);
      if (element.matches("date-picker")) syncDatePickerParts(element);
      if (element.matches("affine-multi-tag-select")) {
        syncMultiTagSelectParts(element);
      }
      return;
    }

    const previous: EnhancedSurface = {
      ariaLevel: element.getAttribute("aria-level"),
      ariaLabel: element.getAttribute("aria-label"),
      role: element.getAttribute("role"),
      tabIndex: element.getAttribute("tabindex"),
    };
    let css = "";

    if (element.matches("inner-slash-menu")) {
      element.setAttribute("role", "listbox");
      element.setAttribute("aria-label", "Insert block");
      element.tabIndex = -1;
      css = `
        .slash-menu {
          width: min(320px, calc(100vw - 24px)) !important;
          box-sizing: border-box !important;
          padding: 6px !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }

        .slash-menu-group-name {
          padding: 8px 10px 4px !important;
          color: var(--color-text-secondary, #a3a3a3) !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }

        .slash-menu-item {
          min-height: 48px !important;
          padding: 6px 8px !important;
          border-radius: var(--radius-element, 8px) !important;
        }

        .slash-menu-item[hover="true"] {
          outline: 2px solid var(--color-accent, #1e96eb);
          outline-offset: -2px;
          background: var(--color-overlay-hover, rgba(255, 255, 255, 0.08));
        }

        .slash-menu-item-icon {
          border-color: var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-element, 8px) !important;
          background: var(--color-background-body, #1f2022) !important;
        }

        .astryx-slash-menu-empty {
          position: fixed;
          box-sizing: border-box;
          width: min(320px, calc(100vw - 24px));
          padding: 14px 16px;
          border: 1px solid var(--color-border-emphasized, #444);
          border-radius: var(--radius-container, 12px);
          color: var(--color-text-secondary, #a3a3a3);
          background: var(--color-background-popover, #28292c);
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32));
          font: 500 13px/1.4 var(--font-family-body, sans-serif);
        }
      `;
    } else if (element.matches("editor-toolbar")) {
      element.setAttribute("role", "toolbar");
      element.setAttribute("aria-label", "Text formatting");
      css = `
        :host {
          min-height: 40px !important;
          height: 40px !important;
          box-sizing: border-box !important;
          padding: 4px !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }
      `;
    } else if (element.matches("editor-menu-content")) {
      const menuLabel = element.classList.contains("paragraph-panel")
        ? "Text style options"
        : element.classList.contains("highlight-panel")
          ? "Text color and background options"
          : "Editor options";
      element.setAttribute("aria-label", menuLabel);
      css = `
        :host([data-show]) {
          box-sizing: border-box !important;
          max-width: calc(100vw - 24px) !important;
          max-height: min(520px, calc(100dvh - 24px)) !important;
          overflow: auto !important;
          overscroll-behavior: contain !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }
      `;
    } else if (element.matches("editor-menu-action")) {
      css = `
        :host {
          min-height: 36px !important;
          box-sizing: border-box !important;
          padding: 6px 10px !important;
          border-radius: var(--radius-element, 8px) !important;
          color: var(--color-text-secondary, #a3a3a3) !important;
          font: 500 14px/20px var(--font-family-body, sans-serif) !important;
          transition:
            color 120ms ease,
            background-color 120ms ease !important;
        }

        :host(:hover),
        :host(:focus-visible),
        :host([data-selected]) {
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-overlay-hover, rgba(255, 255, 255, 0.08)) !important;
        }

        :host(:focus-visible) {
          outline: 2px solid var(--color-accent, #1e96eb) !important;
          outline-offset: -2px !important;
        }

        :host([disabled]) {
          color: var(--color-text-disabled, #737373) !important;
          opacity: 0.64;
        }

        :host(:hover.delete),
        :host(:focus-visible.delete) {
          color: var(--color-error, #ff4d67) !important;
          background: var(--color-error-muted, rgba(255, 77, 103, 0.12)) !important;
        }

        :host(:hover.delete) ::slotted(svg),
        :host(:focus-visible.delete) ::slotted(svg) {
          color: var(--color-error, #ff4d67) !important;
        }
      `;
    } else if (element.matches(".highligh-panel-heading")) {
      element.setAttribute("role", "heading");
      element.setAttribute("aria-level", "3");
    } else if (element.matches("link-popup")) {
      element.setAttribute("role", "dialog");
      syncLinkPopupParts(element);
      css = `
        .affine-link-popover-container {
          box-sizing: border-box !important;
          max-width: calc(100vw - 24px) !important;
        }

        .affine-link-popover.create,
        .affine-link-edit-popover {
          box-sizing: border-box !important;
          width: min(360px, calc(100vw - 24px)) !important;
          padding: 8px !important;
          gap: 8px !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }

        .affine-link-popover-input,
        .affine-edit-area {
          min-height: 36px !important;
          box-sizing: border-box !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-element, 8px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-body, #1f2022) !important;
        }

        .affine-link-popover-input {
          min-width: 0 !important;
          width: 100% !important;
          padding: 6px 10px !important;
        }

        .affine-edit-area {
          width: 100% !important;
          padding: 6px 10px !important;
        }

        .affine-link-popover-input:focus,
        .affine-edit-area:focus-within {
          border-color: var(--color-accent, #1e96eb) !important;
          box-shadow: 0 0 0 2px var(--color-accent-muted, rgba(30, 150, 235, 0.18)) !important;
          outline: none !important;
        }

        .affine-link-preview {
          color: var(--color-accent, #1e96eb) !important;
        }
      `;
    } else if (element.matches("reference-popup")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Linked document options");
    } else if (element.matches("reference-alias-popup")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Edit linked document title");
    } else if (element.matches("affine-linked-doc-popover")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Link a document");
      css = `
        .linked-doc-popover {
          box-sizing: border-box !important;
          width: min(320px, calc(100vw - 24px)) !important;
          max-height: min(420px, calc(100dvh - 24px)) !important;
          padding: 6px !important;
          gap: 2px !important;
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }

        .linked-doc-popover .group-title {
          min-height: 24px !important;
          padding: 6px 10px 2px !important;
          color: var(--color-text-secondary, #a3a3a3) !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }

        .linked-doc-popover icon-button {
          min-height: 36px !important;
          box-sizing: border-box !important;
          padding: 6px 10px !important;
          border-radius: var(--radius-element, 8px) !important;
        }
      `;
    } else if (element.matches("affine-mobile-linked-doc-menu")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Linked document options");
    } else if (element.matches("date-picker")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Choose date");
      css = `
        .popup.date-picker {
          border: 1px solid var(--color-border-emphasized, #444) !important;
          border-radius: var(--radius-container, 12px) !important;
          color: var(--color-text-primary, #f5f5f5) !important;
          background: var(--color-background-popover, #28292c) !important;
          box-shadow: 0 18px 52px var(--color-shadow, rgba(0, 0, 0, 0.32)) !important;
        }

        .interactive {
          border-radius: var(--radius-element, 8px) !important;
        }

        .interactive:focus-visible {
          outline: 2px solid var(--color-accent, #1e96eb) !important;
          outline-offset: 1px !important;
        }

        .date-picker-header__date {
          min-height: 32px !important;
          padding: 4px 6px !important;
        }

        .date-picker-small-action {
          width: 32px !important;
          height: 32px !important;
        }

        .days-header > div {
          color: var(--color-text-secondary, #a3a3a3) !important;
        }
      `;
      syncDatePickerParts(element);
    } else if (element.matches("affine-multi-tag-select")) {
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-label", "Select database value");
      syncMultiTagSelectParts(element);
    } else if (element.matches("affine-menu")) {
      element.setAttribute("role", "menu");
      element.setAttribute("aria-label", "Editor options");
    } else if (element.matches("affine-format-bar-widget")) {
      css = `
        editor-menu-content > div[data-orientation="vertical"] {
          box-sizing: border-box;
          min-width: 220px;
          padding: 6px !important;
        }

        .highligh-panel-heading {
          min-height: 24px;
          box-sizing: border-box;
          align-items: center;
          padding: 6px 10px 2px !important;
          color: var(--color-text-secondary, #a3a3a3) !important;
          font: 600 12px/16px var(--font-family-body, sans-serif);
        }
      `;
    } else if (element.matches("affine-drag-handle-widget")) {
      css = `
        .affine-drag-handle-container {
          width: 28px !important;
          min-height: 24px !important;
          align-items: center !important;
          border-radius: var(--radius-element, 8px) !important;
          color: var(--color-icon-secondary, #64748b) !important;
          opacity: 0.64;
          transition:
            opacity 120ms ease,
            background-color 120ms ease !important;
        }

        .affine-drag-handle-container:hover,
        .affine-drag-handle-container:focus-visible {
          color: var(--color-icon-primary, #334155) !important;
          background: var(--color-overlay-hover, rgba(15, 23, 42, 0.06)) !important;
          opacity: 1;
        }

        .affine-drag-handle-container:focus-visible {
          outline: 2px solid var(--color-accent, #1e96eb);
          outline-offset: 2px;
        }

        .affine-drag-handle-grabber {
          width: 16px !important;
          min-width: 16px !important;
          height: 18px !important;
          border-radius: 4px !important;
          color: inherit !important;
          background-color: transparent !important;
          background-image: radial-gradient(
            circle,
            currentColor 1.25px,
            transparent 1.5px
          ) !important;
          background-position: 1px 1px !important;
          background-size: 6px 6px !important;
          transition: none !important;
        }
      `;
    }

    if (css && element.shadowRoot) {
      const style = document.createElement("style");
      style.setAttribute(integrationStyleMarker, "");
      style.textContent = css;
      element.shadowRoot.append(style);
      previous.style = style;
    }
    enhancedSurfaces.set(element, previous);
    syncSurface(element);
  };

  const syncEmptyParagraphs = (root: ParentNode) => {
    root
      .querySelectorAll<HTMLElement>(emptyParagraphPlaceholderSelector)
      .forEach((placeholder) => {
        const text = placeholder.textContent?.trim() || "Type / for commands";
        const existing = decoratedEmptyParagraphs.get(placeholder);
        if (existing) {
          if (existing.editor.getAttribute("aria-placeholder") !== text) {
            existing.editor.setAttribute("aria-placeholder", text);
          }
          return;
        }
        const inlineEditor =
          placeholder.parentElement?.querySelector<HTMLElement>(
            '.inline-editor[contenteditable="true"]',
          );
        if (!inlineEditor) return;
        decoratedEmptyParagraphs.set(placeholder, {
          ariaHidden: placeholder.getAttribute("aria-hidden"),
          editor: inlineEditor,
          editorAriaPlaceholder: inlineEditor.getAttribute("aria-placeholder"),
        });
        placeholder.setAttribute("aria-hidden", "true");
        inlineEditor.setAttribute("aria-placeholder", text);
      });

    decoratedEmptyParagraphs.forEach((previous, placeholder) => {
      if (
        placeholder.isConnected &&
        placeholder.matches(emptyParagraphPlaceholderSelector)
      ) {
        return;
      }
      restoreAttribute(
        previous.editor,
        "aria-placeholder",
        previous.editorAriaPlaceholder,
      );
      restoreAttribute(placeholder, "aria-hidden", previous.ariaHidden);
      decoratedEmptyParagraphs.delete(placeholder);
    });
  };

  const scan = (root: ParentNode) => {
    if (!active) return;
    if (
      root instanceof ShadowRoot &&
      root.host.matches(enhancedSurfaceSelector)
    ) {
      syncSurface(root.host);
    }
    if (
      root instanceof ShadowRoot &&
      root.host.matches(accessibleControlSelector)
    ) {
      decorate(root.host as AccessibleControl);
    }
    root
      .querySelectorAll<AccessibleControl>(accessibleControlSelector)
      .forEach(decorate);
    root.querySelectorAll<HTMLElement>("*").forEach((element) => {
      if (element.matches(enhancedSurfaceSelector)) {
        syncSurface(element);
      }
      if (element.shadowRoot) observe(element.shadowRoot);
    });
    syncEmptyParagraphs(root);
    decoratedPopupParts.forEach((_, element) => {
      if (!element.isConnected) decoratedPopupParts.delete(element);
    });
  };

  const observe = (root: ParentNode & Node) => {
    if (!active || observers.has(root)) return;
    const observer = new MutationObserver(() => scan(root));
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    observers.set(root, observer);
    scan(root);
  };

  const observePortal = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(blockSuitePortalSelector)) {
      observe(node);
      if (node.shadowRoot) observe(node.shadowRoot);
    }
    node
      .querySelectorAll<HTMLElement>(blockSuitePortalSelector)
      .forEach((portal) => {
        observe(portal);
        if (portal.shadowRoot) observe(portal.shadowRoot);
      });
  };
  const portalObserver = new MutationObserver((records) => {
    records.forEach((record) =>
      record.addedNodes.forEach((node) => observePortal(node)),
    );
  });
  portalObserver.observe(document.body, { childList: true, subtree: true });
  document
    .querySelectorAll<HTMLElement>(blockSuitePortalSelector)
    .forEach((portal) => {
      observe(portal);
      if (portal.shadowRoot) observe(portal.shadowRoot);
    });

  observe(editor);
  for (let frame = 0; frame < 4; frame += 1) {
    const handle = window.requestAnimationFrame(() => {
      animationFrames.delete(handle);
      scan(editor);
    });
    animationFrames.add(handle);
  }

  return () => {
    active = false;
    portalObserver.disconnect();
    animationFrames.forEach((handle) => window.cancelAnimationFrame(handle));
    observers.forEach((observer) => observer.disconnect());
    decorated.forEach((previous, control) => {
      control.removeEventListener("keydown", previous.keydown);
      restoreAttribute(control, "aria-label", previous.ariaLabel);
      restoreAttribute(control, "aria-expanded", previous.ariaExpanded);
      restoreAttribute(control, "aria-haspopup", previous.ariaHasPopup);
      restoreAttribute(control, "aria-pressed", previous.ariaPressed);
      restoreAttribute(
        control,
        "aria-roledescription",
        previous.ariaRoleDescription,
      );
      restoreAttribute(control, "aria-disabled", previous.ariaDisabled);
      restoreAttribute(control, "aria-selected", previous.ariaSelected);
      restoreAttribute(control, "role", previous.role);
      restoreAttribute(control, "tabindex", previous.tabIndex);
      restoreAttribute(control, "title", previous.title);
      previous.focusStyle?.remove();
    });
    enhancedSurfaces.forEach((previous, element) => {
      restoreAttribute(element, "aria-level", previous.ariaLevel ?? null);
      restoreAttribute(element, "aria-label", previous.ariaLabel);
      restoreAttribute(element, "role", previous.role);
      restoreAttribute(element, "tabindex", previous.tabIndex);
      previous.noResults?.remove();
      previous.style?.remove();
    });
    decoratedEmptyParagraphs.forEach((previous, placeholder) => {
      restoreAttribute(
        previous.editor,
        "aria-placeholder",
        previous.editorAriaPlaceholder,
      );
      restoreAttribute(placeholder, "aria-hidden", previous.ariaHidden);
    });
    decoratedPopupParts.forEach((previous, element) => {
      restoreAttribute(
        element,
        "aria-activedescendant",
        previous.ariaActiveDescendant,
      );
      restoreAttribute(element, "aria-autocomplete", previous.ariaAutocomplete);
      restoreAttribute(element, "aria-controls", previous.ariaControls);
      restoreAttribute(element, "aria-current", previous.ariaCurrent);
      restoreAttribute(element, "aria-expanded", previous.ariaExpanded);
      restoreAttribute(element, "aria-label", previous.ariaLabel);
      restoreAttribute(element, "aria-selected", previous.ariaSelected);
      restoreAttribute(element, "id", previous.id);
      restoreAttribute(element, "role", previous.role);
      restoreAttribute(element, "tabindex", previous.tabIndex);
    });
    animationFrames.clear();
    observers.clear();
    decorated.clear();
    decoratedEmptyParagraphs.clear();
    decoratedPopupParts.clear();
    enhancedSurfaces.clear();
  };
}
