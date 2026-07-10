import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenDetail } from './components/ScreenDetail.tsx';

test('offers the generated design system alongside screens, elements, and flows', () => {
  const html = renderToStaticMarkup(
    <ScreenDetail
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
});

test('does not use generic component or flow libraries', () => {
  const source = readFileSync(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ELEMENT_LIBRARY|FLOW_LIBRARY/);
});
