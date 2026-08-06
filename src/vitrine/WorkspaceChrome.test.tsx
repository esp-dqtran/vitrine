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

test('marks a disclosing row as one and leaves leaves alone', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      primaryLabel="Projects"
      primaryActions={[
        {
          label: 'Projects',
          icon: <span>F</span>,
          expanded: true,
          children: [{ label: 'Hi', icon: <span>H</span>, active: true }],
        },
        { label: 'Collections', icon: <span>C</span> },
      ]}
      settings={{ label: 'Settings', icon: <span>S</span> }}
      onBrandSelect={() => undefined}
    />,
  );

  // Only rows that disclose something get the caret and aria-expanded; a leaf
  // with a caret would promise a fold that is not there.
  assert.equal(html.match(/projects-workspace__desktop-row-caret/g)?.length, 1);
  assert.equal(html.match(/aria-expanded/g)?.length, 1);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /projects-workspace__desktop-workspace/);

  // The caret is its own control — it folds the branch, it does not follow the
  // row's destination — so it must be a sibling of the row button, not inside it.
  assert.match(
    html,
    /<button type="button" class="projects-workspace__desktop-row-caret"[\s\S]*?<\/button><button type="button"/,
  );
  assert.match(html, /aria-label="Collapse Projects"/);

  /*
   * The flex rule that lets a row's label take the leftover width must name the
   * destination button. Positional (`> button:first-child`) it landed on the
   * caret once that moved ahead of the row, and `flex: 1 1 auto; min-width: 0`
   * on a 20px control beside a button that will not shrink below its content
   * squeezed the caret out of sight.
   */
  const css = readFileSync(new URL('./projectsWorkspace.css', import.meta.url), 'utf8');
  assert.match(html, /class="projects-workspace__desktop-row-link/);
  assert.match(
    css,
    /\.projects-workspace__desktop-row-line > \.projects-workspace__desktop-row-link\s*\{[^}]*flex:\s*1 1 auto;/s,
  );
  assert.doesNotMatch(css, /\.projects-workspace__desktop-row-line > button:first-child/);
});
