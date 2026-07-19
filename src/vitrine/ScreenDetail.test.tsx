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
  assert.match(html, /aria-label="Design System"/);
  assert.doesNotMatch(html, /Crawler/);
});

test('does not use generic component or flow libraries', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ELEMENT_LIBRARY|FLOW_LIBRARY/);
});

test('animates the active platform indicator and platform content', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /layoutId="platform-active-indicator"/);
  assert.match(source, /\}, \[section, selectedPlatform\]\);/);
});

test('shows every platform reported by app metadata even when the first screen page is web-only', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
      collections={[]}
      onCollectionsChange={() => undefined}
      role="admin"
      app={{
        id: 'adidas',
        app: 'Adidas',
        cat: 'Shopping',
        accent: '#000000',
        totalScreens: 615,
        platforms: ['web', 'ios', 'android'],
        screens: [],
      }}
      onBack={() => {}}
    />
  );

  assert.match(html, />Web</);
  assert.match(html, />iOS</);
  assert.match(html, />Android</);
  assert.match(html, /role="tablist" aria-label="Platform"/);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*aria-label="Web"/);
});
