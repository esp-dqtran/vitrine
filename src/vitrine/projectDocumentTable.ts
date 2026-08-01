import {
  BlockModel,
  Text,
  defineBlockSchema,
  nanoid,
} from "@blocksuite/store";

export const PROJECT_DOCUMENT_TABLE_FLAVOUR = "affine:table" as const;

export interface ProjectDocumentTableRow {
  rowId: string;
  order: string;
  backgroundColor?: string;
}

export interface ProjectDocumentTableColumn {
  columnId: string;
  order: string;
  backgroundColor?: string;
  width?: number;
}

export interface ProjectDocumentTableCell {
  text: Text;
}

export interface ProjectDocumentTableBlockProps {
  rows: Record<string, ProjectDocumentTableRow>;
  columns: Record<string, ProjectDocumentTableColumn>;
  cells: Record<string, ProjectDocumentTableCell>;
}

export class ProjectDocumentTableBlockModel extends BlockModel<ProjectDocumentTableBlockProps> {}

export const ProjectDocumentTableBlockSchema = defineBlockSchema({
  flavour: PROJECT_DOCUMENT_TABLE_FLAVOUR,
  props: (): ProjectDocumentTableBlockProps => ({
    rows: {},
    columns: {},
    cells: {},
  }),
  metadata: {
    role: "content",
    version: 1,
    parent: ["affine:note"],
    children: [],
  },
  toModel: () => new ProjectDocumentTableBlockModel(),
});

declare global {
  namespace BlockSuite {
    interface BlockModels {
      "affine:table": ProjectDocumentTableBlockModel;
    }
  }
}

export const DEFAULT_PROJECT_DOCUMENT_TABLE = [
  ["Column", "", "Expandable"],
  ["Row", "", "Hover here to see table actions"],
] as const;

export function createProjectDocumentTableProps(
  values: readonly (readonly string[])[] = DEFAULT_PROJECT_DOCUMENT_TABLE,
): ProjectDocumentTableBlockProps {
  const width = Math.max(1, ...values.map((row) => row.length));
  const height = Math.max(1, values.length);
  const rows: Record<string, ProjectDocumentTableRow> = {};
  const columns: Record<string, ProjectDocumentTableColumn> = {};
  const cells: Record<string, ProjectDocumentTableCell> = {};
  const rowIds = Array.from({ length: height }, () => nanoid());
  const columnIds = Array.from({ length: width }, () => nanoid());

  rowIds.forEach((rowId, index) => {
    rows[rowId] = {
      rowId,
      order: String(index).padStart(6, "0"),
    };
  });
  columnIds.forEach((columnId, index) => {
    columns[columnId] = {
      columnId,
      order: String(index).padStart(6, "0"),
    };
  });
  rowIds.forEach((rowId, rowIndex) => {
    columnIds.forEach((columnId, columnIndex) => {
      cells[`${rowId}:${columnId}`] = {
        text: new Text(values[rowIndex]?.[columnIndex] ?? ""),
      };
    });
  });

  return { rows, columns, cells };
}

export function orderedProjectDocumentTableRows(
  model: Pick<ProjectDocumentTableBlockModel, "rows">,
): ProjectDocumentTableRow[] {
  return Object.values(model.rows).sort((left, right) =>
    left.order.localeCompare(right.order),
  );
}

export function orderedProjectDocumentTableColumns(
  model: Pick<ProjectDocumentTableBlockModel, "columns">,
): ProjectDocumentTableColumn[] {
  return Object.values(model.columns).sort((left, right) =>
    left.order.localeCompare(right.order),
  );
}

export function orderedProjectDocumentTableRecord<
  T extends { order: string },
>(
  record: Readonly<Record<string, T>>,
  orderedIds: readonly string[],
): Record<string, T> {
  return Object.fromEntries(
    orderedIds.map((id, index) => [
      id,
      {
        ...record[id]!,
        order: String(index).padStart(6, "0"),
      },
    ]),
  );
}

export function moveProjectDocumentTableId(
  orderedIds: readonly string[],
  movedId: string,
  targetIndex: number,
): string[] {
  const currentIndex = orderedIds.indexOf(movedId);
  if (currentIndex < 0) return [...orderedIds];
  const next = [...orderedIds];
  next.splice(currentIndex, 1);
  next.splice(
    Math.max(0, Math.min(targetIndex, next.length)),
    0,
    movedId,
  );
  return next;
}

export function projectDocumentTableValues(
  model: Pick<
    ProjectDocumentTableBlockModel,
    "rows" | "columns" | "cells"
  >,
): string[][] {
  const rows = orderedProjectDocumentTableRows(model);
  const columns = orderedProjectDocumentTableColumns(model);
  return rows.map((row) =>
    columns.map(
      (column) =>
        model.cells[`${row.rowId}:${column.columnId}`]?.text.toString() ?? "",
    ),
  );
}
