import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/vitrine/main.tsx', 'utf8');
const css = readFileSync('src/vitrine/productTables.css', 'utf8');
const settings = readFileSync('src/vitrine/components/SettingsWorkspacePage.tsx', 'utf8');
const projects = readFileSync('src/vitrine/components/ProjectsPage.tsx', 'utf8');
const users = readFileSync('src/vitrine/components/UserDirectory.tsx', 'utf8');
const comparison = readFileSync('src/vitrine/components/InspirationComparison.tsx', 'utf8');

test('loads the production table contract after the data-display layer', () => {
  assert.match(
    main,
    /import '\.\/productDataDisplay\.css';\nimport '\.\/productTables\.css';/,
  );
});

test('maps every production record table and data grid to the shared contract', () => {
  assert.match(settings, /settings-workspace__subscription-table product-data-table/);
  assert.match(projects, /team-people__list product-data-table/);
  assert.match(users, /admin-users-list product-data-grid/);
  assert.match(comparison, /inspiration-comparison-table product-data-table/);
});

test('preserves semantic table roles for the custom team-member grid', () => {
  assert.match(projects, /className="team-people__list product-data-table"[\s\S]*role="table"/);
  assert.match(projects, /team-people__list-heading" role="row"/);
  assert.match(projects, /role="columnheader"/);
  assert.match(projects, /team-people__member"[\s\S]*?key=\{member\.userId\}[\s\S]*?role="row"/);
  assert.match(projects, /team-people__member-profile" role="cell"/);
});

test('shares surface hierarchy hover and responsive behavior without raw colors', () => {
  assert.match(css, /\[data-comp="table-scroll-wrapper"\]/);
  assert.match(css, /min-width: 720px/);
  assert.match(css, /\.product-data-table \[role="columnheader"\][\s\S]*font-size: 14px/);
  assert.match(css, /team-people__member-profile > span:last-child[\s\S]*font-size: 16px/);
  assert.match(css, /admin-users-member-copy strong[\s\S]*font-size: 16px/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
});

test('does not restyle galleries evidence or reconstructed third-party specimens', () => {
  assert.doesNotMatch(
    css,
    /\.(?:discovery-card|screen-grid-card|flow-workspace|document-flow|project-canvas|ds-sample-market)/,
  );
});
