import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceHeader, WorkspaceRail } from './components/WorkspaceChrome.tsx';

test('renders the shared workspace rail with optional destinations', () => {
  const html = renderToStaticMarkup(
    <WorkspaceRail
      workspace={{ label: 'Switch Team', initial: 'P', expanded: false, onSelect: () => undefined }}
      quickAction={{ label: 'Create Team', icon: <span>+</span> }}
      primaryLabel="Personal navigation"
      primaryActions={[{ label: 'Projects', icon: <span>P</span>, active: true }]}
      secondaryLabel="Libraries"
      secondaryActions={[{ label: 'Apps', href: '/apps', icon: <span>A</span> }]}
      settings={{ label: 'Account settings', icon: <span>S</span> }}
    />,
  );

  assert.match(html, /aria-label="Workspace navigation"/);
  assert.match(html, /aria-label="Personal navigation"/);
  assert.match(html, /href="\/apps"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /class="projects-workspace__desktop-footer"/);
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
  assert.match(settings, /aria-label="Vitrine Projects"/);
});
