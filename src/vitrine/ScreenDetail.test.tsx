import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenDetail } from './components/ScreenDetail.tsx';

test('offers the generated design system alongside screens, elements, and flows', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'linear',
        app: 'Linear',
        cat: 'Productivity',
        accent: '#5E6AD2',
        totalScreens: 0,
        screens: [],
      }}
      onBack={() => {}}
    />
  );
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /<button[^>]*>\s*Design System\s*<\/button>/);
  assert.match(html, /<button[^>]*>\s*Crawler\s*<\/button>/);
});

test('keeps the crawler workspace out of normal-user navigation', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="user"
      app={{
        id: 'linear',
        app: 'Linear',
        cat: 'Productivity',
        accent: '#5E6AD2',
        totalScreens: 0,
        screens: [],
      }}
      onBack={() => {}}
    />
  );
  assert.doesNotMatch(html, /Crawler/);
});

test('does not use generic component or flow libraries', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ELEMENT_LIBRARY|FLOW_LIBRARY/);
});

test('refreshes the existing version controls when a crawl creates or completes a draft', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /onDraftVersionChange=.*listAppVersions\(app\.id\)/s);
});
