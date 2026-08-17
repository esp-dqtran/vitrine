import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceHeader, WorkspaceRail, WorkspaceShell } from './components/WorkspaceChrome.tsx';
import { projectRailNav } from './components/projectRailNav.tsx';

test('renders the shared workspace rail as one group of buttons', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      workspace={{ label: 'Switch Team', initial: 'P', expanded: false, onSelect: () => undefined }}
      primaryLabel="Workspace"
      primaryHeading="Workspace"
      primaryCollapsible
      primaryActions={[{ label: 'Projects', icon: <span>P</span>, active: true }]}
      settings={{ label: 'Account settings', icon: <span>S</span> }}
      onBrandSelect={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Workspace navigation"/);
  assert.match(html, /aria-label="Workspace"/);
  assert.match(html, /aria-label="Collapse Workspace"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /class="projects-workspace__desktop-footer"/);
  assert.match(
    html,
    /projects-workspace__rail-brand[\s\S]*projects-workspace__desktop-nav[\s\S]*projects-workspace__desktop-footer[\s\S]*projects-workspace__desktop-workspace/,
  );
  assert.match(html, /aria-label="Projects"[^>]*title="Projects"/);
  assert.doesNotMatch(html, /projects-workspace__desktop-workspace-caret/);
  // Every row navigates through onSelect — no <a href> rows to style separately.
  assert.doesNotMatch(html, /<a [^>]*class="projects-workspace__desktop/);
  assert.doesNotMatch(html, /projects-workspace__desktop-destination/);
});

test('can make the Workspace group collapsible without making Projects a disclosure', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      primaryLabel="Workspace"
      primaryHeading="Workspace"
      primaryCollapsible
      primaryActions={[
        { label: 'Projects', icon: <span>P</span>, active: true },
        { label: 'Collections', icon: <span>C</span> },
      ]}
    />,
  );

  assert.match(html, /projects-workspace__desktop-group-toggle/);
  assert.match(html, /aria-label="Collapse Workspace"/);
  assert.doesNotMatch(html, /aria-label="Collapse Projects"/);
});

test('keeps a project tree open without adding nested collapse controls', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      primaryLabel="Workspace"
      primaryHeading="Workspace"
      primaryCollapsible
      primaryActions={[
        {
          label: 'Projects',
          icon: <span>P</span>,
          collapsible: false,
          children: [{ label: 'Hi', icon: <span>H</span> }],
        },
      ]}
    />,
  );

  assert.doesNotMatch(html, /projects-workspace__desktop-row-caret/);
  assert.doesNotMatch(html, /aria-label="Collapse Projects"/);
  assert.match(html, /projects-workspace__desktop-subnav" aria-hidden="false"/);
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

test('renders the shared Projects header above the rail on every workspace route', () => {
  const html = renderToStaticMarkup(
    <WorkspaceShell
      nav={{ primaryLabel: 'Workspace', primaryActions: [] }}
      onBrandSelect={() => undefined}
      headerActions={<button aria-label="Search">Search</button>}
    >
      <p>Project content</p>
    </WorkspaceShell>,
  );

  assert.match(
    html,
    /projects-workspace__context-bar[\s\S]*aria-label="Workspace navigation"[\s\S]*projects-workspace__shell/,
  );
  assert.match(html, /aria-label="Vitrines Projects"/);
  assert.match(html, /aria-label="Hide workspace navigation"/);
  assert.match(html, /aria-label="Search"/);
  assert.doesNotMatch(html, /projects-workspace__rail-brand/);
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
  assert.match(html, /class="projects-workspace__desktop-subnav" aria-hidden="false"/);

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
  assert.match(css, /\.projects-workspace__desktop-subnav\s*\{[^}]*grid-template-rows:\s*0fr;[^}]*opacity:\s*0;/s);
  assert.match(css, /\.projects-workspace__desktop-row\.is-open > \.projects-workspace__desktop-subnav\s*\{[^}]*grid-template-rows:\s*1fr;/s);
});

test('keeps sibling workspace destinations at the root level', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      primaryLabel="Workspace"
      primaryActions={[
        { label: 'Projects', icon: <span>P</span>, children: [{ label: 'Hi', icon: <span>H</span> }] },
        { label: 'Collections', icon: <span>C</span>, children: [{ label: 'Research', icon: <span>R</span> }] },
      ]}
    />,
  );

  const rootRows = html.match(/projects-workspace__desktop-row has-children is-depth-0/g) ?? [];
  assert.equal(rootRows.length, 2);
  assert.equal((html.match(/projects-workspace__desktop-row is-depth-1/g) ?? []).length, 2);
});

test('publishes a flat app rail instead of a project directory', () => {
  const actions = projectRailNav({
    projectsActive: true,
    onOpenProjects: () => undefined,
  });

  assert.deepEqual(actions.map(({ label, active, children }) => ({ label, active, children })), [
    { label: 'Projects', active: true, children: undefined },
    { label: 'Collections', active: false, children: undefined },
  ]);
});

test('mounts the shared rail on every persistent project route', () => {
  const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const routes = /const workspaceChromeRoutes = new Set\(\[([\s\S]*?)\]\);/.exec(appSource);

  assert.ok(routes, 'workspace chrome route allowlist not found');
  for (const route of [
    'projects',
    'projects-workspace',
    'project',
    'project-documents',
    'project-settings',
  ]) {
    assert.match(routes[1], new RegExp(`"${route}"`));
  }

  // These are full-screen editors with their own navigation and tool chrome.
  for (const route of [
    'project-canvas',
    'project-playground',
    'project-document-file',
    'project-document',
  ]) {
    assert.doesNotMatch(routes[1], new RegExp(`"${route}"`));
  }
});

test('uses a compact visual rail for global navigation', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      primaryLabel="Workspace"
      primaryActions={[
        {
          label: 'Projects',
          icon: <span>P</span>,
          active: true,
        },
      ]}
    />,
  );

  assert.match(html, /projects-workspace__desktop-row is-depth-0/);
  assert.doesNotMatch(html, /projects-workspace__desktop-subnav/);

  const css = readFileSync(new URL('./projectsWorkspace.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./components/WorkspaceChrome.tsx', import.meta.url), 'utf8');
  assert.match(source, /matchMedia\('\(max-width: 700px\)'\)/);
  assert.doesNotMatch(source, /matchMedia\('\(max-width: 900px\)'\)/);
  assert.match(css, /--projects-rail-width:\s*72px;/);
  assert.match(css, /--projects-rail-surface:\s*light-dark\(#f8fafb,\s*#151516\);/);
  assert.match(css, /--projects-rail-active:\s*light-dark\(#e9eef2,\s*#34363c\);/);
  assert.match(
    css,
    /\.projects-workspace__context-bar\s*\{[^}]*border-bottom:\s*0;[^}]*background:\s*var\(--projects-rail-surface\);[^}]*color:\s*#fff;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__drawer-trigger\s*\{[^}]*display:\s*none;[\s\S]*?@media \(max-width:\s*700px\)[\s\S]*?\.projects-workspace__drawer-trigger\s*\{[^}]*display:\s*grid;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__main\s*\{[^}]*height:\s*100%;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/s,
  );
  assert.match(
    css,
    /@media \(min-width:\s*701px\)[\s\S]*?\.projects-workspace__desktop-row-link,[\s\S]*?\.projects-workspace \.projects-workspace__desktop-settings\s*\{[^}]*width:\s*48px(?:\s*!important)?;[^}]*min-height:\s*48px(?:\s*!important)?;[^}]*grid-template-rows:\s*1fr(?:\s*!important)?;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-row-link::before,[\s\S]*?\.projects-workspace__desktop-settings::before\s*\{[^}]*width:\s*40px(?:\s*!important)?;[^}]*height:\s*40px(?:\s*!important)?;/s,
  );
  assert.match(
    css,
    /@media \(min-width:\s*701px\)[\s\S]*?\.projects-workspace \.projects-workspace__desktop-settings\s*\{[^}]*width:\s*48px(?:\s*!important)?;[^}]*min-height:\s*48px(?:\s*!important)?;[^}]*grid-template-rows:\s*1fr(?:\s*!important)?;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-row-link::before,[\s\S]*?\.projects-workspace__desktop-settings::before\s*\{[^}]*width:\s*40px(?:\s*!important)?;[^}]*height:\s*40px(?:\s*!important)?;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-row-link\.is-active::before,[\s\S]*?\.projects-workspace__desktop-row-link::before\s*\{[^}]*background:\s*var\(--projects-rail-active\) !important;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-row:not\(\.has-active-descendant\)[\s\S]*?\.projects-workspace__desktop-row-link:not\(\.is-active\):hover::before/,
  );
  assert.doesNotMatch(css, /\.projects-workspace__desktop-subnav-content > \.projects-workspace__desktop-row::before/);
  assert.doesNotMatch(css, /\.projects-workspace__desktop-subnav-content::before/);
  assert.doesNotMatch(css, /box-shadow:\s*inset 2px 0 0 var\(--color-accent\);/);
  assert.match(
    css,
    /\.projects-workspace__desktop-row-link::after,[\s\S]*?\.projects-workspace__desktop-settings::after\s*\{[^}]*display:\s*none !important;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-rail[\s\S]*?\.projects-workspace__desktop-row-link,[\s\S]*?transition:\s*transform 180ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\) !important;/s,
  );
  assert.match(
    css,
    /\.projects-workspace__desktop-rail[\s\S]*?\.projects-workspace__desktop-row-link:active,[\s\S]*?transform:\s*scale\(0\.9\);/s,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.projects-workspace__desktop-rail[\s\S]*?\.projects-workspace__desktop-row-link:active,[\s\S]*?transform:\s*none;/s,
  );
  assert.match(
    css,
    /@media \(min-width:\s*701px\)[\s\S]*?\.projects-team-drawer\s*\{[^}]*inset:\s*auto auto 62px calc\(var\(--projects-rail-width\) \+ 8px\);/s,
  );
  assert.match(
    css,
    /\.projects-workspace\s+\.projects-workspace__desktop-rail\s+\.projects-workspace__desktop-nav\s+\.projects-workspace__desktop-row-link\s*\{[^}]*grid-template-columns:\s*1fr !important;[^}]*justify-items:\s*center !important;/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*700px\)[\s\S]*?\.projects-team-drawer\s*\{[^}]*inset:\s*0 auto 0 0;[^}]*transform:\s*translateX\(-100%\);/s,
  );
});
