import {
  BlockComponent,
  BlockViewExtension,
  type ExtensionType,
} from "@blocksuite/block-std";
import { Text, nanoid } from "@blocksuite/store";
import { css, html, nothing } from "lit";
import { literal } from "lit/static-html.js";

import {
  PROJECT_DOCUMENT_TABLE_FLAVOUR,
  type ProjectDocumentTableBlockModel,
  type ProjectDocumentTableCell,
  type ProjectDocumentTableColumn,
  type ProjectDocumentTableRow,
  moveProjectDocumentTableId,
  orderedProjectDocumentTableColumns,
  orderedProjectDocumentTableRecord,
  orderedProjectDocumentTableRows,
} from "./projectDocumentTable.ts";

function nextOrder(items: readonly { order: string }[]): string {
  return String(items.length).padStart(6, "0");
}

function cloneCells(
  cells: Record<string, ProjectDocumentTableCell>,
  include: (key: string) => boolean = () => true,
): Record<string, ProjectDocumentTableCell> {
  return Object.fromEntries(
    Object.entries(cells)
      .filter(([key]) => include(key))
      .map(([key, cell]) => [key, { text: new Text(cell.text.toString()) }]),
  );
}

const tableBackgroundColors = [
  { name: "None", value: undefined },
  { name: "Gray", value: "#f2f4f7" },
  { name: "Blue", value: "#eaf3ff" },
  { name: "Green", value: "#eaf8f0" },
  { name: "Yellow", value: "#fff7d6" },
  { name: "Red", value: "#fff0ee" },
] as const;

export class ProjectDocumentTableBlockComponent extends BlockComponent<ProjectDocumentTableBlockModel> {
  static override styles = css`
    :host {
      display: block;
      margin: 12px 0;
    }

    .astryx-simple-table {
      position: relative;
      width: 100%;
      color: var(--affine-text-primary-color, #111827);
    }

    .astryx-simple-table__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
      margin-bottom: 6px;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .astryx-simple-table:hover .astryx-simple-table__actions,
    .astryx-simple-table:focus-within .astryx-simple-table__actions {
      opacity: 1;
    }

    .astryx-simple-table__actions button {
      min-height: 28px;
      padding: 4px 9px;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 7px;
      background: var(--affine-background-primary-color, #fff);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }

    .astryx-simple-table__actions button:hover {
      background: var(--affine-hover-color, #f3f5f8);
    }

    .astryx-simple-table__actions button[data-danger="true"] {
      color: #b42318;
    }

    .astryx-simple-table__context-menu {
      position: absolute;
      z-index: 20;
      top: 36px;
      right: 0;
      display: grid;
      box-sizing: border-box;
      width: 250px;
      padding: 8px;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 10px;
      background: var(--affine-background-primary-color, #fff);
      box-shadow: 0 10px 30px rgb(16 24 40 / 16%);
    }

    .astryx-simple-table__context-title {
      padding: 6px 8px;
      color: var(--affine-text-secondary-color, #667085);
      font-size: 12px;
      font-weight: 600;
    }

    .astryx-simple-table__context-menu > button {
      min-height: 34px;
      padding: 7px 9px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      text-align: left;
    }

    .astryx-simple-table__context-menu > button:hover {
      background: var(--affine-hover-color, #f3f5f8);
    }

    .astryx-simple-table__context-menu > button[data-danger="true"] {
      color: #b42318;
    }

    .astryx-simple-table__context-menu > button:disabled {
      cursor: default;
      opacity: 0.45;
    }

    .astryx-simple-table__color-picker {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px 10px;
      border-bottom: 1px solid var(--affine-divider-color, #d9dee8);
      margin-bottom: 4px;
    }

    .astryx-simple-table__color-label {
      align-self: center;
      color: var(--affine-text-secondary-color, #667085);
      font-size: 12px;
    }

    .astryx-simple-table__actions
      button.astryx-simple-table__color-swatch,
    .astryx-simple-table__context-menu
      button.astryx-simple-table__color-swatch {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      min-height: 24px;
      padding: 0;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 50%;
      background: var(--table-swatch, transparent);
    }

    .astryx-simple-table__actions
      button.astryx-simple-table__color-swatch[data-active="true"],
    .astryx-simple-table__context-menu
      button.astryx-simple-table__color-swatch[data-active="true"] {
      box-shadow:
        0 0 0 2px var(--affine-background-primary-color, #fff),
        0 0 0 4px #2383e2;
    }

    .astryx-simple-table__viewport {
      box-sizing: border-box;
      width: 100%;
      padding: 18px 0 0 18px;
      overflow: auto;
    }

    table {
      width: max-content;
      min-width: 100%;
      border-spacing: 0;
      border-collapse: separate;
      table-layout: fixed;
    }

    td {
      position: relative;
      min-width: 120px;
      padding: 0;
      border-right: 1px solid var(--affine-divider-color, #d9dee8);
      border-bottom: 1px solid var(--affine-divider-color, #d9dee8);
      background: var(--affine-background-primary-color, #fff);
    }

    tr:first-child td {
      border-top: 1px solid var(--affine-divider-color, #d9dee8);
      background: var(--affine-background-secondary-color, #f8fafc);
    }

    td:first-child {
      border-left: 1px solid var(--affine-divider-color, #d9dee8);
    }

    tr:first-child td:first-child {
      border-top-left-radius: 8px;
    }

    tr:first-child td:last-child {
      border-top-right-radius: 8px;
    }

    tr:last-child td:first-child {
      border-bottom-left-radius: 8px;
    }

    tr:last-child td:last-child {
      border-bottom-right-radius: 8px;
    }

    input {
      box-sizing: border-box;
      width: 100%;
      min-height: 42px;
      padding: 9px 11px;
      border: 0;
      outline: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 14px;
    }

    tr:first-child input {
      font-weight: 600;
    }

    input:focus {
      box-shadow: inset 0 0 0 2px #2383e2;
    }

    input:disabled {
      cursor: default;
      opacity: 1;
      -webkit-text-fill-color: currentColor;
    }

    .astryx-simple-table__handle {
      position: absolute;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 5px;
      background: var(--affine-background-primary-color, #fff);
      color: var(--affine-text-secondary-color, #667085);
      cursor: grab;
      font: inherit;
      font-size: 14px;
      line-height: 1;
      opacity: 0;
      transition:
        opacity 100ms ease,
        background 100ms ease;
    }

    .astryx-simple-table__column-handle {
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
    }

    .astryx-simple-table__row-handle {
      top: 50%;
      left: -18px;
      transform: translateY(-50%) rotate(90deg);
    }

    tr:first-child td:hover .astryx-simple-table__column-handle,
    tr:hover td:first-child .astryx-simple-table__row-handle,
    .astryx-simple-table__handle:focus-visible,
    .astryx-simple-table__handle[data-selected="true"] {
      opacity: 1;
    }

    .astryx-simple-table__handle:hover,
    .astryx-simple-table__handle[data-selected="true"] {
      background: var(--affine-hover-color, #eef4ff);
      color: #1565c0;
    }

    td[data-row-selected="true"],
    td[data-column-selected="true"] {
      box-shadow: inset 0 0 0 2px #2383e2;
    }

    tr:first-child td[data-column-selected="true"] {
      box-shadow: inset 0 0 0 2px #2383e2;
    }

    .astryx-simple-table__resize {
      position: absolute;
      z-index: 3;
      top: 0;
      right: -4px;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      opacity: 0;
    }

    tr:first-child td:hover .astryx-simple-table__resize,
    .astryx-simple-table__resize:focus-visible {
      opacity: 1;
    }

    .astryx-simple-table__resize::after {
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: 3px;
      width: 2px;
      border-radius: 2px;
      background: #2383e2;
      content: "";
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.contentEditable = "false";
  }

  private _selectedRowId?: string;
  private _selectedColumnId?: string;
  private _draggedRowId?: string;
  private _draggedColumnId?: string;

  private _selectRow(rowId: string) {
    this._selectedRowId =
      this._selectedRowId === rowId ? undefined : rowId;
    this._selectedColumnId = undefined;
    this.requestUpdate();
  }

  private _selectColumn(columnId: string) {
    this._selectedColumnId =
      this._selectedColumnId === columnId ? undefined : columnId;
    this._selectedRowId = undefined;
    this.requestUpdate();
  }

  private _replaceRows(
    orderedIds: readonly string[],
    rows: Record<string, ProjectDocumentTableRow>,
    cells = this.model.cells,
  ) {
    this.doc.captureSync();
    this.doc.updateBlock(this.model, {
      rows: orderedProjectDocumentTableRecord(rows, orderedIds),
      cells,
    });
  }

  private _replaceColumns(
    orderedIds: readonly string[],
    columns: Record<string, ProjectDocumentTableColumn>,
    cells = this.model.cells,
  ) {
    this.doc.captureSync();
    this.doc.updateBlock(this.model, {
      columns: orderedProjectDocumentTableRecord(columns, orderedIds),
      cells,
    });
  }

  private _insertRow(index: number) {
    if (this.doc.readonly) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    const columns = orderedProjectDocumentTableColumns(this.model);
    const rowId = nanoid();
    const cells = cloneCells(this.model.cells);
    columns.forEach((column) => {
      cells[`${rowId}:${column.columnId}`] = { text: new Text() };
    });
    const rowIds = rows.map((row) => row.rowId);
    rowIds.splice(Math.max(0, Math.min(index, rowIds.length)), 0, rowId);
    this._selectedRowId = rowId;
    this._selectedColumnId = undefined;
    this._replaceRows(
      rowIds,
      {
        ...this.model.rows,
        [rowId]: { rowId, order: nextOrder(rows) },
      },
      cells,
    );
  }

  private _insertColumn(index: number) {
    if (this.doc.readonly) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    const columns = orderedProjectDocumentTableColumns(this.model);
    const columnId = nanoid();
    const cells = cloneCells(this.model.cells);
    rows.forEach((row) => {
      cells[`${row.rowId}:${columnId}`] = { text: new Text() };
    });
    const columnIds = columns.map((column) => column.columnId);
    columnIds.splice(
      Math.max(0, Math.min(index, columnIds.length)),
      0,
      columnId,
    );
    this._selectedColumnId = columnId;
    this._selectedRowId = undefined;
    this._replaceColumns(
      columnIds,
      {
        ...this.model.columns,
        [columnId]: {
          columnId,
          order: nextOrder(columns),
        },
      },
      cells,
    );
  }

  private _addRow = () => {
    const rows = orderedProjectDocumentTableRows(this.model);
    const selectedIndex = rows.findIndex(
      (row) => row.rowId === this._selectedRowId,
    );
    this._insertRow(selectedIndex < 0 ? rows.length : selectedIndex + 1);
  };

  private _addColumn = () => {
    const columns = orderedProjectDocumentTableColumns(this.model);
    const selectedIndex = columns.findIndex(
      (column) => column.columnId === this._selectedColumnId,
    );
    this._insertColumn(
      selectedIndex < 0 ? columns.length : selectedIndex + 1,
    );
  };

  private _removeRow(rowId = this._selectedRowId) {
    if (this.doc.readonly) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    if (rows.length <= 1 || !rowId) return;
    const removed = rows.find((row) => row.rowId === rowId);
    if (!removed) return;
    const { [removed.rowId]: _removed, ...remainingRows } = this.model.rows;
    this._selectedRowId = undefined;
    this._replaceRows(
      rows
        .filter((row) => row.rowId !== removed.rowId)
        .map((row) => row.rowId),
      remainingRows,
      cloneCells(
        this.model.cells,
        (key) => !key.startsWith(`${removed.rowId}:`),
      ),
    );
  }

  private _removeColumn(columnId = this._selectedColumnId) {
    if (this.doc.readonly) return;
    const columns = orderedProjectDocumentTableColumns(this.model);
    if (columns.length <= 1 || !columnId) return;
    const removed = columns.find((column) => column.columnId === columnId);
    if (!removed) return;
    const { [removed.columnId]: _removed, ...remainingColumns } =
      this.model.columns;
    this._selectedColumnId = undefined;
    this._replaceColumns(
      columns
        .filter((column) => column.columnId !== removed.columnId)
        .map((column) => column.columnId),
      remainingColumns,
      cloneCells(
        this.model.cells,
        (key) => !key.endsWith(`:${removed.columnId}`),
      ),
    );
  }

  private _moveRow(rowId: string, targetIndex: number) {
    if (this.doc.readonly) return;
    const ids = orderedProjectDocumentTableRows(this.model).map(
      (row) => row.rowId,
    );
    this._replaceRows(
      moveProjectDocumentTableId(ids, rowId, targetIndex),
      this.model.rows,
    );
  }

  private _moveColumn(columnId: string, targetIndex: number) {
    if (this.doc.readonly) return;
    const ids = orderedProjectDocumentTableColumns(this.model).map(
      (column) => column.columnId,
    );
    this._replaceColumns(
      moveProjectDocumentTableId(ids, columnId, targetIndex),
      this.model.columns,
    );
  }

  private _moveSelectedRow(offset: number) {
    if (!this._selectedRowId) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    const index = rows.findIndex(
      (row) => row.rowId === this._selectedRowId,
    );
    if (index < 0) return;
    this._moveRow(this._selectedRowId, index + offset);
  }

  private _moveSelectedColumn(offset: number) {
    if (!this._selectedColumnId) return;
    const columns = orderedProjectDocumentTableColumns(this.model);
    const index = columns.findIndex(
      (column) => column.columnId === this._selectedColumnId,
    );
    if (index < 0) return;
    this._moveColumn(this._selectedColumnId, index + offset);
  }

  private _duplicateRow() {
    if (this.doc.readonly || !this._selectedRowId) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    const sourceIndex = rows.findIndex(
      (row) => row.rowId === this._selectedRowId,
    );
    if (sourceIndex < 0) return;
    const sourceRow = rows[sourceIndex]!;
    const columns = orderedProjectDocumentTableColumns(this.model);
    const rowId = nanoid();
    const cells = cloneCells(this.model.cells);
    for (const column of columns) {
      const source =
        this.model.cells[
          `${this._selectedRowId}:${column.columnId}`
        ]?.text.toString() ?? "";
      cells[`${rowId}:${column.columnId}`] = { text: new Text(source) };
    }
    const rowIds = rows.map((row) => row.rowId);
    rowIds.splice(sourceIndex + 1, 0, rowId);
    this._selectedRowId = rowId;
    this._replaceRows(
      rowIds,
      {
        ...this.model.rows,
        [rowId]: {
          rowId,
          order: nextOrder(rows),
          backgroundColor: sourceRow.backgroundColor,
        },
      },
      cells,
    );
  }

  private _duplicateColumn() {
    if (this.doc.readonly || !this._selectedColumnId) return;
    const columns = orderedProjectDocumentTableColumns(this.model);
    const sourceIndex = columns.findIndex(
      (column) => column.columnId === this._selectedColumnId,
    );
    if (sourceIndex < 0) return;
    const rows = orderedProjectDocumentTableRows(this.model);
    const sourceColumn = columns[sourceIndex]!;
    const columnId = nanoid();
    const cells = cloneCells(this.model.cells);
    for (const row of rows) {
      const source =
        this.model.cells[
          `${row.rowId}:${sourceColumn.columnId}`
        ]?.text.toString() ?? "";
      cells[`${row.rowId}:${columnId}`] = { text: new Text(source) };
    }
    const columnIds = columns.map((column) => column.columnId);
    columnIds.splice(sourceIndex + 1, 0, columnId);
    this._selectedColumnId = columnId;
    this._replaceColumns(
      columnIds,
      {
        ...this.model.columns,
        [columnId]: {
          ...sourceColumn,
          columnId,
          order: nextOrder(columns),
        },
      },
      cells,
    );
  }

  private _clearSelectedRow() {
    if (this.doc.readonly || !this._selectedRowId) return;
    const cells = cloneCells(
      this.model.cells,
      (key) => !key.startsWith(`${this._selectedRowId}:`),
    );
    for (const column of orderedProjectDocumentTableColumns(this.model)) {
      cells[`${this._selectedRowId}:${column.columnId}`] = {
        text: new Text(),
      };
    }
    this.doc.captureSync();
    this.doc.updateBlock(this.model, { cells });
  }

  private _clearSelectedColumn() {
    if (this.doc.readonly || !this._selectedColumnId) return;
    const cells = cloneCells(
      this.model.cells,
      (key) => !key.endsWith(`:${this._selectedColumnId}`),
    );
    for (const row of orderedProjectDocumentTableRows(this.model)) {
      cells[`${row.rowId}:${this._selectedColumnId}`] = {
        text: new Text(),
      };
    }
    this.doc.captureSync();
    this.doc.updateBlock(this.model, { cells });
  }

  private _setSelectedBackground(backgroundColor?: string) {
    if (this.doc.readonly) return;
    if (this._selectedRowId) {
      const row = this.model.rows[this._selectedRowId];
      if (!row) return;
      const rows = orderedProjectDocumentTableRows(this.model);
      this._replaceRows(
        rows.map((item) => item.rowId),
        {
          ...this.model.rows,
          [row.rowId]: {
            ...row,
            ...(backgroundColor
              ? { backgroundColor }
              : { backgroundColor: undefined }),
          },
        },
      );
      return;
    }
    if (this._selectedColumnId) {
      const column = this.model.columns[this._selectedColumnId];
      if (!column) return;
      const columns = orderedProjectDocumentTableColumns(this.model);
      this._replaceColumns(
        columns.map((item) => item.columnId),
        {
          ...this.model.columns,
          [column.columnId]: {
            ...column,
            ...(backgroundColor
              ? { backgroundColor }
              : { backgroundColor: undefined }),
          },
        },
      );
    }
  }

  private _resizeColumn(
    column: ProjectDocumentTableColumn,
    event: PointerEvent,
  ) {
    if (this.doc.readonly) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const cell = (event.currentTarget as HTMLElement).closest("td");
    const startWidth =
      column.width ?? cell?.getBoundingClientRect().width ?? 160;
    let width = startWidth;
    const move = (next: PointerEvent) => {
      width = Math.max(120, Math.min(520, startWidth + next.clientX - startX));
      const col = this.renderRoot.querySelector<HTMLElement>(
        `[data-table-column="${column.columnId}"]`,
      );
      if (col) col.style.width = `${width}px`;
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      const columns = orderedProjectDocumentTableColumns(this.model);
      this._replaceColumns(
        columns.map((item) => item.columnId),
        {
          ...this.model.columns,
          [column.columnId]: {
            ...column,
            width: Math.round(width),
          },
        },
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  private _resizeColumnByKeyboard(
    column: ProjectDocumentTableColumn,
    event: KeyboardEvent,
  ) {
    if (
      this.doc.readonly ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    event.preventDefault();
    const columns = orderedProjectDocumentTableColumns(this.model);
    const width = Math.max(
      120,
      Math.min(
        520,
        (column.width ?? 160) + (event.key === "ArrowRight" ? 16 : -16),
      ),
    );
    this._replaceColumns(
      columns.map((item) => item.columnId),
      {
        ...this.model.columns,
        [column.columnId]: {
          ...column,
          width,
        },
      },
    );
  }

  private _renderContextMenu(
    rows: readonly ProjectDocumentTableRow[],
    columns: readonly ProjectDocumentTableColumn[],
  ) {
    if (!this._selectedRowId && !this._selectedColumnId) return nothing;
    const selectedColor = this._selectedRowId
      ? this.model.rows[this._selectedRowId]?.backgroundColor
      : this._selectedColumnId
        ? this.model.columns[this._selectedColumnId]?.backgroundColor
        : undefined;
    return html`
      <div
        class="astryx-simple-table__context-menu"
        role="menu"
        aria-label=${this._selectedRowId ? "Row actions" : "Column actions"}
      >
        <div class="astryx-simple-table__context-title">
          ${this._selectedRowId ? "Row actions" : "Column actions"}
        </div>
        <div class="astryx-simple-table__color-picker">
          <span class="astryx-simple-table__color-label">Background</span>
          ${tableBackgroundColors.map(
            (color) => html`
              <button
                class="astryx-simple-table__color-swatch"
                type="button"
                aria-label=${`Set background ${color.name}`}
                title=${color.name}
                data-active=${String(selectedColor === color.value)}
                style=${`--table-swatch:${
                  color.value ??
                  "linear-gradient(135deg, transparent 45%, #b42318 46%, #b42318 54%, transparent 55%)"
                }`}
                @click=${() => this._setSelectedBackground(color.value)}
              ></button>
            `,
          )}
        </div>
        ${this._selectedRowId
          ? html`
              <button
                type="button"
                role="menuitem"
                @click=${() => {
                  const index = rows.findIndex(
                    (row) => row.rowId === this._selectedRowId,
                  );
                  this._insertRow(Math.max(0, index));
                }}
              >
                Insert above
              </button>
              <button type="button" role="menuitem" @click=${this._addRow}>
                Insert below
              </button>
              <button
                type="button"
                role="menuitem"
                ?disabled=${rows[0]?.rowId === this._selectedRowId}
                @click=${() => this._moveSelectedRow(-1)}
              >
                Move up
              </button>
              <button
                type="button"
                role="menuitem"
                ?disabled=${rows.at(-1)?.rowId === this._selectedRowId}
                @click=${() => this._moveSelectedRow(1)}
              >
                Move down
              </button>
              <button
                type="button"
                role="menuitem"
                @click=${this._duplicateRow}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                @click=${this._clearSelectedRow}
              >
                Clear row contents
              </button>
              <button
                type="button"
                role="menuitem"
                data-danger="true"
                ?disabled=${rows.length <= 1}
                @click=${() => this._removeRow()}
              >
                Delete
              </button>
            `
          : html`
              <button
                type="button"
                role="menuitem"
                @click=${() => {
                  const index = columns.findIndex(
                    (column) =>
                      column.columnId === this._selectedColumnId,
                  );
                  this._insertColumn(Math.max(0, index));
                }}
              >
                Insert left
              </button>
              <button type="button" role="menuitem" @click=${this._addColumn}>
                Insert right
              </button>
              <button
                type="button"
                role="menuitem"
                ?disabled=${columns[0]?.columnId === this._selectedColumnId}
                @click=${() => this._moveSelectedColumn(-1)}
              >
                Move left
              </button>
              <button
                type="button"
                role="menuitem"
                ?disabled=${columns.at(-1)?.columnId ===
                this._selectedColumnId}
                @click=${() => this._moveSelectedColumn(1)}
              >
                Move right
              </button>
              <button
                type="button"
                role="menuitem"
                @click=${this._duplicateColumn}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                @click=${this._clearSelectedColumn}
              >
                Clear column contents
              </button>
              <button
                type="button"
                role="menuitem"
                data-danger="true"
                ?disabled=${columns.length <= 1}
                @click=${() => this._removeColumn()}
              >
                Delete
              </button>
            `}
      </div>
    `;
  }

  private _deleteTable = () => {
    if (this.doc.readonly) return;
    this.doc.captureSync();
    this.doc.deleteBlock(this.model);
  };

  private _updateCell(key: string, value: string) {
    if (this.doc.readonly) return;
    const text = this.model.cells[key]?.text;
    if (!text || text.toString() === value) return;
    if (value) {
      text.replace(0, text.length, value);
    } else {
      text.clear();
    }
  }

  override renderBlock() {
    const rows = orderedProjectDocumentTableRows(this.model);
    const columns = orderedProjectDocumentTableColumns(this.model);
    const readOnly = this.doc.readonly;
    return html`
      <div
        class="astryx-simple-table"
        contenteditable="false"
        data-readonly=${String(readOnly)}
      >
        ${readOnly
          ? nothing
          : html`
              <div class="astryx-simple-table__actions">
                <button type="button" @click=${this._addRow}>Add row</button>
                <button type="button" @click=${this._addColumn}>
                  Add column
                </button>
                <button
                  type="button"
                  data-danger="true"
                  @click=${this._deleteTable}
                >
                  Delete table
                </button>
              </div>
              ${this._renderContextMenu(rows, columns)}
            `}
        <div class="astryx-simple-table__viewport">
          <table aria-label="Simple table">
            <colgroup>
              ${columns.map(
                (column) => html`
                  <col
                    data-table-column=${column.columnId}
                    style=${`width:${column.width ?? 160}px`}
                  />
                `,
              )}
            </colgroup>
            <tbody>
              ${rows.map(
                (row, rowIndex) => html`
                  <tr
                    data-row-id=${row.rowId}
                    @dragover=${(event: DragEvent) => {
                      if (this._draggedRowId) event.preventDefault();
                    }}
                    @drop=${(event: DragEvent) => {
                      if (!this._draggedRowId) return;
                      event.preventDefault();
                      this._moveRow(this._draggedRowId, rowIndex);
                      this._draggedRowId = undefined;
                    }}
                  >
                    ${columns.map((column, columnIndex) => {
                      const key = `${row.rowId}:${column.columnId}`;
                      const value =
                        this.model.cells[key]?.text.toString() ?? "";
                      return html`
                        <td
                          data-row-id=${row.rowId}
                          data-column-id=${column.columnId}
                          data-row-selected=${String(
                            this._selectedRowId === row.rowId,
                          )}
                          data-column-selected=${String(
                            this._selectedColumnId === column.columnId,
                          )}
                          style=${`background:${
                            column.backgroundColor ??
                            row.backgroundColor ??
                            (rowIndex === 0
                              ? "var(--affine-background-secondary-color, #f8fafc)"
                              : "var(--affine-background-primary-color, #fff)")
                          }`}
                          @dragover=${(event: DragEvent) => {
                            if (this._draggedColumnId) event.preventDefault();
                          }}
                          @drop=${(event: DragEvent) => {
                            if (!this._draggedColumnId) return;
                            event.preventDefault();
                            event.stopPropagation();
                            this._moveColumn(
                              this._draggedColumnId,
                              columnIndex,
                            );
                            this._draggedColumnId = undefined;
                          }}
                        >
                          ${!readOnly && rowIndex === 0
                            ? html`
                                <button
                                  class="astryx-simple-table__handle astryx-simple-table__column-handle"
                                  type="button"
                                  aria-label=${`Select column ${
                                    columnIndex + 1
                                  }`}
                                  title="Select or drag column"
                                  data-testid="drag-column-handle"
                                  data-drag-column-id=${column.columnId}
                                  data-selected=${String(
                                    this._selectedColumnId === column.columnId,
                                  )}
                                  .draggable=${true}
                                  @click=${() =>
                                    this._selectColumn(column.columnId)}
                                  @dragstart=${(event: DragEvent) => {
                                    this._draggedColumnId = column.columnId;
                                    event.dataTransfer?.setData(
                                      "text/plain",
                                      column.columnId,
                                    );
                                  }}
                                  @dragend=${() => {
                                    this._draggedColumnId = undefined;
                                  }}
                                >
                                  ⋮
                                </button>
                                <div
                                  class="astryx-simple-table__resize"
                                  role="separator"
                                  aria-orientation="vertical"
                                  aria-label=${`Resize column ${
                                    columnIndex + 1
                                  }`}
                                  tabindex="0"
                                  data-width-adjust-column-id=${column.columnId}
                                  @pointerdown=${(event: PointerEvent) =>
                                    this._resizeColumn(column, event)}
                                  @keydown=${(event: KeyboardEvent) =>
                                    this._resizeColumnByKeyboard(column, event)}
                                ></div>
                              `
                            : nothing}
                          ${!readOnly && columnIndex === 0
                            ? html`
                                <button
                                  class="astryx-simple-table__handle astryx-simple-table__row-handle"
                                  type="button"
                                  aria-label=${`Select row ${rowIndex + 1}`}
                                  title="Select or drag row"
                                  data-testid="drag-row-handle"
                                  data-drag-row-id=${row.rowId}
                                  data-selected=${String(
                                    this._selectedRowId === row.rowId,
                                  )}
                                  .draggable=${true}
                                  @click=${() => this._selectRow(row.rowId)}
                                  @dragstart=${(event: DragEvent) => {
                                    this._draggedRowId = row.rowId;
                                    event.dataTransfer?.setData(
                                      "text/plain",
                                      row.rowId,
                                    );
                                  }}
                                  @dragend=${() => {
                                    this._draggedRowId = undefined;
                                  }}
                                >
                                  ⋮
                                </button>
                              `
                            : nothing}
                          <input
                            type="text"
                            aria-label=${`Row ${rowIndex + 1}, column ${
                              columnIndex + 1
                            }`}
                            .value=${value}
                            ?disabled=${readOnly}
                            @input=${(event: InputEvent) =>
                              this._updateCell(
                                key,
                                (event.currentTarget as HTMLInputElement).value,
                              )}
                          />
                        </td>
                      `;
                    })}
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

export const ProjectDocumentTableBlockSpec: ExtensionType[] = [
  BlockViewExtension(
    PROJECT_DOCUMENT_TABLE_FLAVOUR,
    literal`affine-table`,
  ),
];

export function registerProjectDocumentTableBlock(
  registry: Pick<CustomElementRegistry, "define" | "get"> = customElements,
): void {
  if (!registry.get("affine-table")) {
    registry.define("affine-table", ProjectDocumentTableBlockComponent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "affine-table": ProjectDocumentTableBlockComponent;
  }
}
