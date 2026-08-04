import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const story = readFileSync('src/stories/Components/TablesAndDataGrids.stories.tsx', 'utf8');
const css = readFileSync('src/stories/Components/TablesAndDataGrids.css', 'utf8');

test('builds the table review from the shared production primitive', () => {
  assert.match(story, /title: 'Components\/Tables and Data Grids\/Visual review'/);
  assert.match(story, /<Table<AppRow>/);
  assert.match(story, /title="Production pilot"/);
  assert.match(story, /title="Density and hierarchy"/);
  assert.match(story, /title="Loading and recovery states"/);
  assert.match(story, /title="Responsive contract"/);
});

test('uses Apps data and preserves the approved UI text hierarchy', () => {
  assert.match(story, /app: 'Aboard'/);
  assert.match(story, /category: 'Business, Jobs & Recruitment'/);
  assert.match(story, /screens: 624/);
  assert.match(css, /table-review__identity strong[\s\S]*font-size: 16px/);
  assert.match(css, /table-review__identity small[\s\S]*font-size: 14px/);
});

test('uses table plugins only for interactions the pilot needs', () => {
  assert.match(story, /useTableSelectionState/);
  assert.match(story, /useTableSelection\(/);
  assert.match(story, /useTableSortableState/);
  assert.match(story, /useTableSortable<AppRow>/);
  assert.match(story, /useTablePagination<AppRow>/);
  assert.match(story, /paginateData\(sortedData, page, pageSize\)/);
  assert.match(story, /plugins=\{\{ selection, sortable, pagination \}\}/);
});

test('keeps numeric columns aligned and text columns usable', () => {
  assert.match(story, /key: 'screens'[\s\S]*align: 'end'[\s\S]*sortable: true/);
  assert.match(story, /key: 'analyzed'[\s\S]*align: 'end'/);
  assert.match(story, /textOverflow="truncate"/);
  assert.match(story, /width: proportional\(1\.5\)/);
  assert.match(story, /width: pixel\(112\)/);
});

test('shows loading empty and error inside the table contract', () => {
  assert.match(story, /aria-busy="true"/);
  assert.match(story, /table-review__skeleton/);
  assert.match(story, /title="No apps match these filters"/);
  assert.match(story, /role="alert"/);
  assert.match(story, /Apps could not be loaded/);
  assert.match(story, /label="Try again"/);
  assert.match(story, /const recoveryColumns:[\s\S]*header: 'Records'[\s\S]*width: proportional\(1\)/);
  assert.equal(story.match(/columns=\{recoveryColumns\}/g)?.length, 2);
  assert.match(css, /table-review__state-grid \.table-review__card \[data-comp='table'\][\s\S]*min-width: 0/);
});

test('documents responsive overflow without raw review colors', () => {
  assert.match(css, /min-width: 720px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(story, /Scrollable columns/);
  assert.match(story, /Identity first/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});

test('loads established Vitrines foundation layers before review composition', () => {
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/styles\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productTypography\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productSpacing\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productShape\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productMotion\.css'/);
  assert.match(story, /import '\.\.\/\.\.\/vitrine\/productResponsive\.css'/);
});
