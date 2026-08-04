import { useMemo, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Table,
  paginateData,
  pixel,
  proportional,
  useTablePagination,
  useTableSelection,
  useTableSelectionState,
  useTableSortable,
  useTableSortableState,
  type TableColumn,
} from '@astryxdesign/core';
import '../../vitrine/styles.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productTables.css';
import './TablesAndDataGrids.css';

const meta = {
  title: 'Components/Tables and Data Grids/Visual review',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Vitrines table standard uses the shared Table primitive with Apps data to review hierarchy, sorting, selection, pagination, density, loading, empty, error, and responsive overflow before production rollout.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type AppStatus = 'In progress' | 'Complete' | 'Needs attention';

type AppRow = Record<string, unknown> & {
  id: string;
  app: string;
  category: string;
  platform: string;
  screens: number;
  analyzed: string;
  updated: string;
  updatedValue: number;
  status: AppStatus;
};

const appRows: AppRow[] = [
  {
    id: 'aboard',
    app: 'Aboard',
    category: 'Business, Jobs & Recruitment',
    platform: 'Web',
    screens: 624,
    analyzed: '0 / 624',
    updated: 'Jul 24, 2026',
    updatedValue: 20260724,
    status: 'In progress',
  },
  {
    id: 'linear',
    app: 'Linear',
    category: 'Productivity',
    platform: 'Web',
    screens: 389,
    analyzed: '389 / 389',
    updated: 'Jul 23, 2026',
    updatedValue: 20260723,
    status: 'Complete',
  },
  {
    id: 'figma',
    app: 'Figma',
    category: 'Design tools',
    platform: 'Web',
    screens: 276,
    analyzed: '214 / 276',
    updated: 'Jul 21, 2026',
    updatedValue: 20260721,
    status: 'In progress',
  },
  {
    id: 'notion',
    app: 'Notion',
    category: 'Productivity',
    platform: 'Web',
    screens: 241,
    analyzed: '241 / 241',
    updated: 'Jul 20, 2026',
    updatedValue: 20260720,
    status: 'Complete',
  },
  {
    id: 'slack',
    app: 'Slack',
    category: 'Communication',
    platform: 'Web',
    screens: 198,
    analyzed: '76 / 198',
    updated: 'Jul 18, 2026',
    updatedValue: 20260718,
    status: 'Needs attention',
  },
  {
    id: 'airtable',
    app: 'Airtable',
    category: 'Collaboration',
    platform: 'Web',
    screens: 174,
    analyzed: '174 / 174',
    updated: 'Jul 17, 2026',
    updatedValue: 20260717,
    status: 'Complete',
  },
  {
    id: 'framer',
    app: 'Framer',
    category: 'Design tools',
    platform: 'Web',
    screens: 132,
    analyzed: '88 / 132',
    updated: 'Jul 15, 2026',
    updatedValue: 20260715,
    status: 'In progress',
  },
  {
    id: 'loom',
    app: 'Loom',
    category: 'Communication',
    platform: 'Web',
    screens: 96,
    analyzed: '96 / 96',
    updated: 'Jul 12, 2026',
    updatedValue: 20260712,
    status: 'Complete',
  },
];

function ReviewSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="table-review__section">
      <header className="table-review__section-header">
        <span>{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function statusVariant(status: AppStatus): 'neutral' | 'success' | 'error' {
  if (status === 'Complete') return 'success';
  if (status === 'Needs attention') return 'error';
  return 'neutral';
}

function ProductionTable() {
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState(new Set(['aboard']));
  const [lastOpened, setLastOpened] = useState('');
  const pageSize = 5;

  const { sortedData, sortConfig } = useTableSortableState<AppRow>({
    data: appRows,
    defaultSort: [{ sortKey: 'screens', direction: 'descending' }],
    comparators: {
      screens: (a, b) => a.screens - b.screens,
      updatedValue: (a, b) => a.updatedValue - b.updatedValue,
    },
    allowUnsortedState: false,
  });
  const pageData = paginateData(sortedData, page, pageSize);
  const { selectionConfig } = useTableSelectionState({
    data: pageData,
    idKey: 'id',
    selectedKeys,
    setSelectedKeys,
  });
  const selection = useTableSelection(selectionConfig);
  const sortable = useTableSortable<AppRow>(sortConfig);
  const pagination = useTablePagination<AppRow>({
    page,
    onPageChange: setPage,
    totalItems: sortedData.length,
    pageSize,
    position: 'below',
    align: 'end',
    label: 'Apps table pagination',
  });

  const columns = useMemo<TableColumn<AppRow>[]>(
    () => [
      {
        key: 'app',
        header: 'App',
        width: proportional(1.5),
        sortable: true,
        renderCell: (row) => (
          <span className="table-review__identity">
            <Avatar name={row.app} size="small" />
            <span>
              <strong>{row.app}</strong>
              <small>{row.category}</small>
            </span>
          </span>
        ),
      },
      {
        key: 'platform',
        header: 'Platform',
        width: pixel(108),
      },
      {
        key: 'screens',
        header: 'Screens',
        width: pixel(112),
        align: 'end',
        sortable: true,
      },
      {
        key: 'analyzed',
        header: 'Analyzed',
        width: pixel(132),
        align: 'end',
      },
      {
        key: 'status',
        header: 'Status',
        width: pixel(152),
        renderCell: (row) => (
          <Badge label={row.status} variant={statusVariant(row.status)} />
        ),
      },
      {
        key: 'updated',
        header: 'Last updated',
        width: pixel(150),
        sortable: { sortKey: 'updatedValue' },
      },
      {
        key: 'action',
        header: '',
        width: pixel(92),
        align: 'end',
        resizable: false,
        renderCell: (row) => (
          <Button
            label="Open"
            size="sm"
            variant="secondary"
            clickAction={() => setLastOpened(row.app)}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="table-review__production-frame">
      <div className="table-review__toolbar">
        <div>
          <strong>Apps</strong>
          <span>{appRows.length} captured references</span>
        </div>
        <span aria-live="polite">
          {selectedKeys.size} selected{lastOpened ? ` · Opened ${lastOpened}` : ''}
        </span>
      </div>
      <Table<AppRow>
        aria-label="Apps data table"
        data={pageData}
        columns={columns}
        idKey="id"
        density="balanced"
        dividers="rows"
        hasHover
        textOverflow="truncate"
        plugins={{ selection, sortable, pagination }}
      />
    </div>
  );
}

const loadingRows = Array.from({ length: 4 }, (_, index) => ({ id: `loading-${index}` }));
const loadingColumns: TableColumn<Record<string, unknown>>[] = [
  {
    key: 'app',
    header: 'App',
    width: proportional(1.5),
    renderCell: () => <span className="table-review__skeleton table-review__skeleton--identity" />,
  },
  {
    key: 'platform',
    header: 'Platform',
    width: proportional(0.7),
    renderCell: () => <span className="table-review__skeleton table-review__skeleton--short" />,
  },
  {
    key: 'screens',
    header: 'Screens',
    width: proportional(0.7),
    renderCell: () => <span className="table-review__skeleton table-review__skeleton--short" />,
  },
  {
    key: 'status',
    header: 'Status',
    width: proportional(0.9),
    renderCell: () => <span className="table-review__skeleton table-review__skeleton--status" />,
  },
];

const stateColumns: TableColumn<AppRow>[] = [
  { key: 'app', header: 'App', width: proportional(1.5) },
  { key: 'screens', header: 'Screens', width: proportional(0.5), align: 'end' },
  { key: 'status', header: 'Status', width: proportional(0.8) },
];

const recoveryColumns: TableColumn<AppRow>[] = [
  { key: 'app', header: 'Records', width: proportional(1) },
];

function TablesAndDataGridsReview() {
  return (
    <main className="table-review">
      <header className="table-review__intro">
        <div>
          <p className="table-review__eyebrow">Vitrines · Component system</p>
          <h1>Tables &amp; Data Grids</h1>
          <p className="table-review__lede">
            Structured records stay readable, comparable, and actionable across dense desktop and compact screens.
          </p>
        </div>
        <span className="table-review__status">Visual review · Apps pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Production pilot"
        description="Apps data establishes the row hierarchy, numeric alignment, sorting, multi-row selection, actions, and pagination contract."
      >
        <ProductionTable />
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Density and hierarchy"
        description="Balanced is the default for product work; compact is reserved for scanning larger record sets without shrinking interactive text."
      >
        <div className="table-review__density-grid">
          <article className="table-review__card">
            <header>
              <strong>Balanced</strong>
              <span>Default product density</span>
            </header>
            <Table<AppRow>
              aria-label="Balanced table density"
              data={appRows.slice(0, 3)}
              columns={stateColumns}
              idKey="id"
              density="balanced"
              hasHover
            />
          </article>
          <article className="table-review__card">
            <header>
              <strong>Compact</strong>
              <span>High-volume scanning</span>
            </header>
            <Table<AppRow>
              aria-label="Compact table density"
              data={appRows.slice(0, 4)}
              columns={stateColumns}
              idKey="id"
              density="compact"
              dividers="rows"
              hasHover
            />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Loading and recovery states"
        description="Loading preserves column geometry; empty and error states replace the table body with one clear next step."
      >
        <div className="table-review__state-grid">
          <article className="table-review__card table-review__card--loading" aria-busy="true">
            <header>
              <strong>Loading</strong>
              <span>Preserve the table footprint</span>
            </header>
            <Table<Record<string, unknown>>
              aria-label="Loading apps table"
              data={loadingRows}
              columns={loadingColumns}
              idKey="id"
              density="balanced"
            />
          </article>
          <article className="table-review__card">
            <header>
              <strong>Empty</strong>
              <span>No matching records</span>
            </header>
            <Table<AppRow>
              aria-label="Empty apps table"
              data={[]}
              columns={recoveryColumns}
              emptyState={
                <EmptyState
                  title="No apps match these filters"
                  description="Clear one or more filters to see captured references."
                  isCompact
                />
              }
            />
          </article>
          <article className="table-review__card">
            <header>
              <strong>Error</strong>
              <span>Keep recovery near the data</span>
            </header>
            <Table<AppRow>
              aria-label="Apps table error"
              data={[]}
              columns={recoveryColumns}
              emptyState={
                <div role="alert" className="table-review__error-state">
                  <strong>Apps could not be loaded</strong>
                  <span>Your current filters are preserved.</span>
                  <Button label="Try again" variant="primary" />
                </div>
              }
            />
          </article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="The table remains a table: keep the leading identity visible, allow horizontal review, and never compress text or controls below their usable width."
      >
        <div className="table-review__responsive-contract">
          <div>
            <span>Wide</span>
            <strong>Full comparison</strong>
            <p>Identity, status, metrics, dates, and actions remain visible.</p>
          </div>
          <div>
            <span>Compact</span>
            <strong>Scrollable columns</strong>
            <p>The table scrolls inside its frame while the page stays stable.</p>
          </div>
          <div>
            <span>Mobile</span>
            <strong>Identity first</strong>
            <p>Lead with the app and preserve minimum column and control widths.</p>
          </div>
        </div>
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <TablesAndDataGridsReview />,
};
