import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceHeader, WorkspaceRail } from './components/WorkspaceChrome.tsx';

test('renders the shared workspace rail as one group of buttons', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      workspace={{ label: 'Switch Team', initial: 'P', expanded: false, onSelect: () => undefined }}
      primaryLabel="Workspace"
      primaryActions={[{ label: 'Projects', icon: <span>P</span>, active: true }]}
      settings={{ label: 'Account settings', icon: <span>S</span> }}
    />,
  );

  assert.match(html, /aria-label="Workspace navigation"/);
  assert.match(html, /aria-label="Workspace"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /class="projects-workspace__desktop-footer"/);
  // Every row navigates through onSelect — no <a href> rows to style separately.
  assert.doesNotMatch(html, /<a [^>]*class="projects-workspace__desktop/);
  assert.doesNotMatch(html, /projects-workspace__desktop-destination/);
});

/*
 * The rail rows are <button>s, so the product label role (14px/600 !important)
 * used to win over the rail's own 13px/500 scale on every nav row. Both the
 * application-surface and the Admin copy of that rule must exclude the rail.
 */
test('lets the rail keep its own row type instead of the product label role', () => {
  const typography = readFileSync(new URL('./productTypography.css', import.meta.url), 'utf8');
  const labelRules = typography.match(
    /[^}]*:is\(button[^{]*\{[^}]*--vitrine-type-label\)\s*!important[^}]*\}/g,
  ) ?? [];

  assert.equal(labelRules.length, 1, 'expected one Admin label rule');
  for (const rule of labelRules) {
    assert.match(rule, /\.projects-workspace__desktop-rail \*/);
    assert.match(rule, /\.projects-team-drawer \*/);
  }
  assert.match(
    typography,
    /:where\(button[^{]*\.projects-workspace__desktop-rail \*,\s*\.projects-team-drawer \*/s,
  );
});

test('renders project and Settings headers through the same component', () => {
  const menu = { label: 'Open menu', expanded: false, icon: <span>M</span>, onSelect: () => undefined };
  const projects = renderToStaticMarkup(
    <WorkspaceHeader variant="projects" menu={menu} onBrandSelect={() => undefined} actions={<button>Profile</button>}>
      <label>Search</label>
    </WorkspaceHeader>,
  );
  const settings = renderToStaticMarkup(
    <WorkspaceHeader variant="settings" menu={menu} onBrandSelect={() => undefined} actions={<button>Profile</button>} />,
  );

  assert.match(projects, /class="projects-workspace__context-bar"/);
  assert.match(projects, /class="projects-workspace__header-actions"/);
  assert.match(settings, /<header class="settings-workspace__header">/);
  assert.match(settings, /class="settings-workspace__header-actions"/);
  assert.match(settings, /aria-label="Vitrines Projects"/);
});
