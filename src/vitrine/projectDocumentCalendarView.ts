import {
  ShadowlessElement,
} from "@blocksuite/block-std";
import {
  databaseBlockColumns,
  DatabaseBlockComponent,
  type DatabaseBlockDataSource,
} from "@blocksuite/blocks";
import {
  BaseCellRenderer,
  createIcon,
  createUniComponentFromWebComponent,
  createFromBaseCellRenderer,
  getTagColor,
  propertyType,
  renderUniLit,
  t,
  viewType,
  type BasicViewDataType,
  type DataViewInstance,
  type DataViewProps,
  type PropertyMetaConfig,
  type ViewMeta,
} from "@blocksuite/data-view";
import {
  TableSingleView,
  type TableViewData,
} from "@blocksuite/data-view/view-presets";
import { widgetPresets } from "@blocksuite/data-view/widget-presets";
import { SignalWatcher } from "@blocksuite/global/utils";
import { css, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

type ProjectDocumentCalendarViewData = BasicViewDataType<
  "calendar",
  Omit<TableViewData, "id" | "mode" | "name"> & {
    datePropertyId?: string;
  }
>;

export interface ProjectDocumentDatabaseMember {
  id: string;
  email: string;
}

export interface ProjectDocumentDatabaseOptions {
  docId: string;
  currentUserId?: string;
  members?: readonly ProjectDocumentDatabaseMember[];
}

function renamedPropertyMeta(
  base: PropertyMetaConfig<any, any, any>,
  type: string,
  name: string,
): PropertyMetaConfig<any, any, any> {
  return {
    type,
    config: {
      ...base.config,
      name,
    },
    create: (propertyName, data) => ({
      ...base.create(propertyName, data),
      type,
    }),
    renderer: {
      ...base.renderer,
      type,
    },
  };
}

const createdTimePropertyMeta = renamedPropertyMeta(
  databaseBlockColumns.dateColumnConfig,
  "created-time",
  "Created Time",
);

interface ProjectDocumentAttachmentValue {
  sourceId?: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

function attachmentValue(
  value: unknown,
): ProjectDocumentAttachmentValue | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") return undefined;
  return {
    sourceId:
      typeof record.sourceId === "string" ? record.sourceId : undefined,
    name: record.name,
    type:
      typeof record.type === "string"
        ? record.type
        : "application/octet-stream",
    size: typeof record.size === "number" ? record.size : 0,
    url: typeof record.url === "string" ? record.url : undefined,
  };
}

const attachmentPropertyModel = propertyType("attachment").modelConfig<
  ProjectDocumentAttachmentValue,
  Record<string, never>
>({
  name: "Attachment",
  type: () => t.string.instance(),
  defaultData: () => ({}),
  cellToString: ({ value }) => value?.name ?? "",
  cellFromString: ({ value }) => {
    const url = value.trim();
    return {
      value: url
        ? {
            name: url,
            type: "text/uri-list",
            size: 0,
            url,
          }
        : undefined,
    };
  },
  cellToJson: ({ value }) =>
    value
      ? {
          sourceId: value.sourceId ?? null,
          name: value.name,
          type: value.type,
          size: value.size,
          url: value.url ?? null,
        }
      : null,
  cellFromJson: ({ value }) => attachmentValue(value),
  isEmpty: ({ value }) => !value?.name,
});

function readableFileSize(size: number): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

class ProjectDocumentAttachmentCell extends BaseCellRenderer<
  ProjectDocumentAttachmentValue,
  Record<string, never>
> {
  static override styles = css`
    .astryx-database-attachment {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      width: 100%;
      border: 0;
      background: transparent;
      color: var(--affine-text-primary-color, #172033);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      text-align: left;
    }

    .astryx-database-attachment__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .astryx-database-attachment__size {
      flex: 0 0 auto;
      color: var(--affine-text-secondary-color, #667085);
      font-size: 11px;
    }
  `;

  private _download = async (): Promise<void> => {
    const value = this.value;
    if (!value) return;
    if (value.url) {
      window.open(value.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!value.sourceId) return;
    const source = this.view.manager.dataSource as DatabaseBlockDataSource;
    const blob = await source.doc.blobSync.get(value.sourceId);
    if (!blob) return;
    const url = URL.createObjectURL(
      new Blob([blob], {
        type: value.type || "application/octet-stream",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = value.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  override render() {
    if (!this.value) return nothing;
    return html`
      <button
        class="astryx-database-attachment"
        type="button"
        title=${`Download ${this.value.name}`}
        @click=${this._download}
      >
        <span aria-hidden="true">📎</span>
        <span class="astryx-database-attachment__name">
          ${this.value.name}
        </span>
        ${this.value.size
          ? html`
              <span class="astryx-database-attachment__size">
                ${readableFileSize(this.value.size)}
              </span>
            `
          : nothing}
      </button>
    `;
  }
}

class ProjectDocumentAttachmentCellEditing extends BaseCellRenderer<
  ProjectDocumentAttachmentValue,
  Record<string, never>
> {
  static override styles = css`
    .astryx-database-attachment-picker {
      box-sizing: border-box;
      display: block;
      width: 100%;
      padding: 5px;
      color: var(--affine-text-primary-color, #172033);
      font: inherit;
      font-size: 11px;
    }
  `;

  private _upload = async (event: Event): Promise<void> => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const source = this.view.manager.dataSource as DatabaseBlockDataSource;
    const sourceId = await source.doc.blobSync.set(file);
    this.onChange({
      sourceId,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    });
    this.selectCurrentCell(false);
  };

  override render() {
    return html`
      <input
        class="astryx-database-attachment-picker"
        type="file"
        aria-label="Choose attachment"
        @change=${this._upload}
      />
    `;
  }
}

const attachmentPropertyMeta =
  attachmentPropertyModel.createPropertyMeta({
    icon: createIcon("AttachmentIcon"),
    cellRenderer: {
      view: createFromBaseCellRenderer(
        ProjectDocumentAttachmentCell,
      ),
      edit: createFromBaseCellRenderer(
        ProjectDocumentAttachmentCellEditing,
      ),
    },
  });
const memberPropertyMeta = renamedPropertyMeta(
  databaseBlockColumns.selectColumnConfig,
  "member",
  "Member",
);
const createdByPropertyMeta = renamedPropertyMeta(
  databaseBlockColumns.selectColumnConfig,
  "created-by",
  "Created By",
);
const projectPropertyMetas: PropertyMetaConfig<any, any, any>[] = [
  createdTimePropertyMeta,
  attachmentPropertyMeta,
  memberPropertyMeta,
  createdByPropertyMeta,
];
const projectPropertyMetaByType = new Map(
  projectPropertyMetas.map((meta) => [meta.type, meta]),
);

const calendarViewType = viewType("calendar");

class ProjectDocumentCalendarSingleView extends TableSingleView {
  override get type(): string {
    return "calendar";
  }

  get datePropertyId(): string | undefined {
    return (
      this.data$.value as ProjectDocumentCalendarViewData | undefined
    )?.datePropertyId;
  }

  setDatePropertyId(datePropertyId: string): void {
    this.dataUpdate(() => ({ datePropertyId }) as Partial<TableViewData>);
  }
}

const calendarViewModel =
  calendarViewType.createModel<ProjectDocumentCalendarViewData>({
    defaultName: "Calendar View",
    dataViewManager: ProjectDocumentCalendarSingleView,
    defaultData: (viewManager) => {
      let datePropertyId = viewManager.dataSource.properties$.value.find(
        (id) => viewManager.dataSource.propertyTypeGet(id) === "date",
      );
      if (!datePropertyId) {
        datePropertyId = viewManager.dataSource.propertyAdd("end", "date");
        viewManager.dataSource.propertyNameSet(datePropertyId, "Date");
      }
      return {
        columns: viewManager.dataSource.properties$.value.map((id) => ({
          id,
          width: 200,
          hide: false,
        })),
        filter: {
          type: "group",
          op: "and",
          conditions: [],
        },
        groupProperties: [],
        header: {
          titleColumn: viewManager.dataSource.properties$.value.find(
            (id) =>
              viewManager.dataSource.propertyTypeGet(id) === "title",
          ),
          iconColumn: "type",
        },
        datePropertyId,
      };
    },
  });

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromCellValue(value: unknown): Date | undefined {
  const time =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(time)) return undefined;
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

class ProjectDocumentCalendarViewElement extends SignalWatcher(
  ShadowlessElement,
) {
  static override properties = {
    props: { attribute: false },
  };

  static override styles = css`
    astryx-database-calendar {
      display: block;
      color: var(--affine-text-primary-color, #172033);
    }

    .astryx-calendar {
      min-width: 720px;
      overflow: hidden;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 12px;
      background: var(--affine-background-primary-color, #fff);
    }

    .astryx-calendar__controls {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--affine-divider-color, #d9dee8);
    }

    .astryx-calendar__month {
      min-width: 150px;
      margin-right: auto;
      font-size: 14px;
      font-weight: 650;
    }

    .astryx-calendar__controls button,
    .astryx-calendar__controls select,
    .astryx-calendar__undated button {
      min-height: 30px;
      padding: 5px 9px;
      border: 1px solid var(--affine-divider-color, #d9dee8);
      border-radius: 7px;
      background: var(--affine-background-primary-color, #fff);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }

    .astryx-calendar__controls button:hover,
    .astryx-calendar__controls select:hover,
    .astryx-calendar__undated button:hover {
      background: var(--affine-hover-color, #f3f5f8);
    }

    .astryx-calendar__weekdays,
    .astryx-calendar__grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(100px, 1fr));
    }

    .astryx-calendar__weekday {
      padding: 7px 8px;
      border-right: 1px solid var(--affine-divider-color, #d9dee8);
      border-bottom: 1px solid var(--affine-divider-color, #d9dee8);
      color: var(--affine-text-secondary-color, #667085);
      font-size: 11px;
      font-weight: 650;
      text-align: center;
      text-transform: uppercase;
    }

    .astryx-calendar__weekday:last-child {
      border-right: 0;
    }

    .astryx-calendar__day {
      position: relative;
      box-sizing: border-box;
      min-height: 112px;
      padding: 7px;
      border-right: 1px solid var(--affine-divider-color, #d9dee8);
      border-bottom: 1px solid var(--affine-divider-color, #d9dee8);
      background: var(--affine-background-primary-color, #fff);
    }

    .astryx-calendar__day:nth-child(7n) {
      border-right: 0;
    }

    .astryx-calendar__day:nth-last-child(-n + 7) {
      border-bottom: 0;
    }

    .astryx-calendar__day[data-outside="true"] {
      background: var(--affine-background-secondary-color, #f8fafc);
      color: var(--affine-text-secondary-color, #98a2b3);
    }

    .astryx-calendar__day[data-drop-target="true"] {
      box-shadow: inset 0 0 0 2px #2383e2;
    }

    .astryx-calendar__date {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      font-size: 12px;
    }

    .astryx-calendar__date[data-today="true"] {
      background: #2383e2;
      color: #fff;
      font-weight: 700;
    }

    .astryx-calendar__add {
      position: absolute;
      top: 7px;
      right: 7px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--affine-text-secondary-color, #667085);
      cursor: pointer;
      opacity: 0;
    }

    .astryx-calendar__day:hover .astryx-calendar__add,
    .astryx-calendar__add:focus-visible {
      opacity: 1;
    }

    .astryx-calendar__add:hover {
      background: var(--affine-hover-color, #f3f5f8);
    }

    .astryx-calendar__records {
      display: grid;
      gap: 4px;
      margin-top: 5px;
    }

    .astryx-calendar__record {
      width: 100%;
      padding: 5px 7px;
      overflow: hidden;
      border: 1px solid #d9e8fb;
      border-radius: 6px;
      background: #eef6ff;
      color: #174a7c;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      line-height: 1.25;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .astryx-calendar__record:hover {
      border-color: #8ebcf0;
      background: #e3f0ff;
    }

    .astryx-calendar__undated {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 10px 12px;
      border-top: 1px solid var(--affine-divider-color, #d9dee8);
      color: var(--affine-text-secondary-color, #667085);
      font-size: 12px;
    }

    .astryx-calendar__undated-label {
      margin-right: 3px;
      font-weight: 650;
    }

    .astryx-calendar__empty {
      padding: 22px;
      border: 1px dashed var(--affine-divider-color, #d9dee8);
      border-radius: 10px;
      color: var(--affine-text-secondary-color, #667085);
      font-size: 13px;
      text-align: center;
    }
  `;

  declare props: DataViewProps<ProjectDocumentCalendarSingleView>;

  private _cursor = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );

  private _draggedRowId?: string;

  get expose(): DataViewInstance<ProjectDocumentCalendarSingleView> {
    return {
      addRow: () => this._addRecord(new Date()),
      clearSelection: () => undefined,
      focusFirstCell: () => {
        this.querySelector<HTMLElement>(
          ".astryx-calendar__record, .astryx-calendar__add",
        )?.focus();
      },
      view: this.props.view,
      eventTrace: this.props.eventTrace,
    };
  }

  private _addRecord(date: Date): string | undefined {
    if (this.props.view.readonly$.value) return undefined;
    const propertyId = this.props.view.datePropertyId;
    if (!propertyId) return undefined;
    const rowId = this.props.view.rowAdd("end");
    this.props.view.cellValueSet(
      rowId,
      propertyId,
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime(),
    );
    (
      this.props.dataViewEle as typeof this.props.dataViewEle & {
        openDetailPanel(data: {
          view: ProjectDocumentCalendarSingleView;
          rowId: string;
        }): void;
      }
    ).openDetailPanel({
      view: this.props.view,
      rowId,
    });
    return rowId;
  }

  private _openRecord(rowId: string): void {
    (
      this.props.dataViewEle as typeof this.props.dataViewEle & {
        openDetailPanel(data: {
          view: ProjectDocumentCalendarSingleView;
          rowId: string;
        }): void;
      }
    ).openDetailPanel({
      view: this.props.view,
      rowId,
    });
  }

  private _moveRecord(rowId: string, date: Date): void {
    const propertyId = this.props.view.datePropertyId;
    if (!propertyId || this.props.view.readonly$.value) return;
    this.props.view.cellValueSet(
      rowId,
      propertyId,
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime(),
    );
  }

  private _setMonth(offset: number): void {
    this._cursor = new Date(
      this._cursor.getFullYear(),
      this._cursor.getMonth() + offset,
      1,
    );
    this.requestUpdate();
  }

  private _setToday(): void {
    const now = new Date();
    this._cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.requestUpdate();
  }

  private _renderRecord(rowId: string) {
    const titlePropertyId =
      this.props.view.mainProperties$.value.titleColumn ??
      this.props.view.propertyIds$.value.find(
        (id) => this.props.view.propertyTypeGet(id) === "title",
      );
    const title = titlePropertyId
      ? this.props.view.cellStringValueGet(rowId, titlePropertyId)
      : "";
    return html`
      <button
        class="astryx-calendar__record"
        type="button"
        title=${title || "Untitled"}
        draggable=${String(!this.props.view.readonly$.value)}
        @dragstart=${(event: DragEvent) => {
          this._draggedRowId = rowId;
          event.dataTransfer?.setData("text/plain", rowId);
        }}
        @dragend=${() => {
          this._draggedRowId = undefined;
        }}
        @click=${() => this._openRecord(rowId)}
      >
        ${title || "Untitled"}
      </button>
    `;
  }

  override render() {
    const view = this.props.view;
    const dateProperties = view.propertiesWithoutFilter$.value.filter(
      (id) => view.propertyTypeGet(id) === "date",
    );
    const datePropertyId = view.datePropertyId;
    const readOnly = view.readonly$.value;

    if (!datePropertyId) {
      return html`
        ${renderUniLit(this.props.headerWidget, {
          dataViewInstance: this.expose,
        })}
        <div class="astryx-calendar__empty">
          This calendar needs a date property.
          ${readOnly
            ? nothing
            : html`
                <button
                  type="button"
                  @click=${() => {
                    const id = view.propertyAdd("end", "date");
                    view.propertyNameSet(id, "Date");
                    view.setDatePropertyId(id);
                  }}
                >
                  Create date property
                </button>
              `}
        </div>
      `;
    }

    const rowsByDate = new Map<string, string[]>();
    const undatedRows: string[] = [];
    for (const rowId of view.rows$.value) {
      const date = dateFromCellValue(
        view.cellValueGet(rowId, datePropertyId),
      );
      if (!date) {
        undatedRows.push(rowId);
        continue;
      }
      const key = localDateKey(date);
      rowsByDate.set(key, [...(rowsByDate.get(key) ?? []), rowId]);
    }

    const days = monthGrid(this._cursor);
    const today = localDateKey(new Date());
    const monthLabel = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(this._cursor);

    return html`
      ${renderUniLit(this.props.headerWidget, {
        dataViewInstance: this.expose,
      })}
      <div class="astryx-calendar" data-view-mode="calendar">
        <div class="astryx-calendar__controls">
          <div class="astryx-calendar__month">${monthLabel}</div>
          <select
            aria-label="Calendar date property"
            .value=${datePropertyId}
            ?disabled=${readOnly}
            @change=${(event: Event) =>
              view.setDatePropertyId(
                (event.currentTarget as HTMLSelectElement).value,
              )}
          >
            ${dateProperties.map(
              (propertyId) => html`
                <option value=${propertyId}>
                  ${view.propertyNameGet(propertyId) || "Date"}
                </option>
              `,
            )}
          </select>
          <button
            type="button"
            aria-label="Previous month"
            @click=${() => this._setMonth(-1)}
          >
            ‹
          </button>
          <button type="button" @click=${this._setToday}>Today</button>
          <button
            type="button"
            aria-label="Next month"
            @click=${() => this._setMonth(1)}
          >
            ›
          </button>
        </div>
        <div class="astryx-calendar__weekdays">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
            (day) => html`
              <div class="astryx-calendar__weekday">${day}</div>
            `,
          )}
        </div>
        <div class="astryx-calendar__grid">
          ${repeat(
            days,
            (date) => localDateKey(date),
            (date) => {
              const key = localDateKey(date);
              const rows = rowsByDate.get(key) ?? [];
              return html`
                <div
                  class="astryx-calendar__day"
                  data-date=${key}
                  data-outside=${String(
                    date.getMonth() !== this._cursor.getMonth(),
                  )}
                  @dragover=${(event: DragEvent) => {
                    if (this._draggedRowId) event.preventDefault();
                  }}
                  @drop=${(event: DragEvent) => {
                    if (!this._draggedRowId) return;
                    event.preventDefault();
                    this._moveRecord(this._draggedRowId, date);
                    this._draggedRowId = undefined;
                  }}
                >
                  <span
                    class="astryx-calendar__date"
                    data-today=${String(key === today)}
                  >
                    ${date.getDate()}
                  </span>
                  ${readOnly
                    ? nothing
                    : html`
                        <button
                          class="astryx-calendar__add"
                          type="button"
                          aria-label=${`Add record on ${key}`}
                          @click=${() => this._addRecord(date)}
                        >
                          +
                        </button>
                      `}
                  <div class="astryx-calendar__records">
                    ${rows.map((rowId) => this._renderRecord(rowId))}
                  </div>
                </div>
              `;
            },
          )}
        </div>
        ${undatedRows.length
          ? html`
              <div class="astryx-calendar__undated">
                <span class="astryx-calendar__undated-label">
                  No date
                </span>
                ${undatedRows.map((rowId) => this._renderRecord(rowId))}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

const calendarViewMeta = calendarViewModel.createMeta({
  view: createUniComponentFromWebComponent(
    ProjectDocumentCalendarViewElement,
  ),
  icon: createIcon("DateTimeIcon"),
});

const configuredDataSources = new WeakSet<DatabaseBlockDataSource>();
const configuredDatabaseBlocks = new WeakSet<DatabaseBlockComponent>();
const databaseOptionsByDocId = new Map<
  string,
  ProjectDocumentDatabaseOptions
>();
let calendarViewInstalled = false;

function memberSelectData(
  options: ProjectDocumentDatabaseOptions | undefined,
): {
  options: Array<{ id: string; value: string; color: string }>;
} {
  return {
    options: (options?.members ?? []).map((member) => ({
      id: member.id,
      value: member.email,
      color: getTagColor(),
    })),
  };
}

function configureDatabaseBlock(
  block: DatabaseBlockComponent,
  source: DatabaseBlockDataSource,
): void {
  if (!configuredDatabaseBlocks.has(block)) {
    const commonTools = [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ];
    block.toolsWidget = widgetPresets.createTools({
      table: commonTools,
      kanban: commonTools,
      calendar: commonTools,
    });
    configuredDatabaseBlocks.add(block);
  }

  if (configuredDataSources.has(source)) return;
  const databaseOptions = databaseOptionsByDocId.get(block.model.doc.id);
  source.viewMetas = [...source.viewMetas, calendarViewMeta];
  const defaultViewMetaGet = source.viewMetaGet.bind(source);
  source.viewMetaGet = (type: string): ViewMeta =>
    type === "calendar" ? calendarViewMeta : defaultViewMetaGet(type);

  const defaultPropertyMetas = source.propertyMetas;
  Object.defineProperty(source, "propertyMetas", {
    configurable: true,
    value: [...defaultPropertyMetas, ...projectPropertyMetas],
  });
  const defaultPropertyMetaGet = source.propertyMetaGet.bind(source);
  source.propertyMetaGet = (type: string): PropertyMetaConfig =>
    (projectPropertyMetaByType.get(type) as
      | PropertyMetaConfig
      | undefined) ?? defaultPropertyMetaGet(type);

  const defaultPropertyAdd = source.propertyAdd.bind(source);
  source.propertyAdd = (position, type): string => {
    const meta = type ? projectPropertyMetaByType.get(type) : undefined;
    if (!meta) return defaultPropertyAdd(position, type);

    const data =
      type === "member" || type === "created-by"
        ? memberSelectData(databaseOptions)
        : undefined;
    const propertyId = block.service.addColumn(
      block.model,
      position,
      meta.create(meta.config.name, data),
    );
    block.service.applyColumnUpdate(block.model);
    if (type === "created-time") {
      block.model.children.forEach((row) => {
        source.cellValueChange(row.id, propertyId, Date.now());
      });
    }
    if (type === "created-by" && databaseOptions?.currentUserId) {
      block.model.children.forEach((row) => {
        source.cellValueChange(
          row.id,
          propertyId,
          databaseOptions.currentUserId,
        );
      });
    }
    return propertyId;
  };

  const defaultPropertyReadonlyGet =
    source.propertyReadonlyGet.bind(source);
  source.propertyReadonlyGet = (propertyId: string): boolean => {
    const type = source.propertyTypeGet(propertyId);
    return type === "created-time" || type === "created-by"
      ? true
      : defaultPropertyReadonlyGet(propertyId);
  };

  const defaultPropertyTypeSet = source.propertyTypeSet.bind(source);
  source.propertyTypeSet = (propertyId: string, toType: string): void => {
    const meta = projectPropertyMetaByType.get(toType);
    if (!meta) {
      defaultPropertyTypeSet(propertyId, toType);
      return;
    }
    const current = block.model.columns.find(
      (column) => column.id === propertyId,
    );
    if (!current) return;
    const data =
      toType === "member" || toType === "created-by"
        ? memberSelectData(databaseOptions)
        : undefined;
    source.doc.captureSync();
    source.doc.transact(() => {
      block.model.columns = block.model.columns.map((column) =>
        column.id === propertyId
          ? {
              ...meta.create(column.name, data),
              id: propertyId,
            }
          : column,
      );
    });
    block.service.applyColumnUpdate(block.model);
    block.model.children.forEach((row) => {
      const value =
        toType === "created-time"
          ? Date.now()
          : toType === "created-by"
            ? databaseOptions?.currentUserId
            : undefined;
      source.cellValueChange(row.id, propertyId, value);
    });
  };

  const defaultRowAdd = source.rowAdd.bind(source);
  source.rowAdd = (position): string => {
    const rowId = defaultRowAdd(position);
    block.model.columns.forEach((column) => {
      if (column.type === "created-time") {
        source.cellValueChange(rowId, column.id, Date.now());
      }
      if (
        column.type === "created-by" &&
        databaseOptions?.currentUserId
      ) {
        source.cellValueChange(
          rowId,
          column.id,
          databaseOptions.currentUserId,
        );
      }
    });
    return rowId;
  };

  block.model.columns.forEach((column) => {
    if (column.type !== "member" && column.type !== "created-by") return;
    source.propertyDataSet(column.id, memberSelectData(databaseOptions));
  });
  configuredDataSources.add(source);
}

function installProjectDocumentCalendarView(): void {
  if (calendarViewInstalled) return;
  const descriptor = Object.getOwnPropertyDescriptor(
    DatabaseBlockComponent.prototype,
    "dataSource",
  );
  const defaultDataSourceGet = descriptor?.get as
    | ((this: DatabaseBlockComponent) => DatabaseBlockDataSource)
    | undefined;
  if (!descriptor || !defaultDataSourceGet) {
    throw new Error("BlockSuite database data source is unavailable");
  }

  Object.defineProperty(DatabaseBlockComponent.prototype, "dataSource", {
    ...descriptor,
    get(this: DatabaseBlockComponent): DatabaseBlockDataSource {
      const source = defaultDataSourceGet.call(this);
      configureDatabaseBlock(this, source);
      return source;
    },
  });
  calendarViewInstalled = true;
}

export function registerProjectDocumentDatabaseBlock(
  registry: Pick<CustomElementRegistry, "define" | "get"> = customElements,
  options?: ProjectDocumentDatabaseOptions,
): void {
  if (options) databaseOptionsByDocId.set(options.docId, options);
  installProjectDocumentCalendarView();
  if (!registry.get("astryx-database-calendar")) {
    registry.define(
      "astryx-database-calendar",
      ProjectDocumentCalendarViewElement,
    );
  }
  if (!registry.get("astryx-database-attachment-cell")) {
    registry.define(
      "astryx-database-attachment-cell",
      ProjectDocumentAttachmentCell,
    );
  }
  if (!registry.get("astryx-database-attachment-cell-editing")) {
    registry.define(
      "astryx-database-attachment-cell-editing",
      ProjectDocumentAttachmentCellEditing,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "astryx-database-calendar": ProjectDocumentCalendarViewElement;
    "astryx-database-attachment-cell": ProjectDocumentAttachmentCell;
    "astryx-database-attachment-cell-editing": ProjectDocumentAttachmentCellEditing;
  }
}
