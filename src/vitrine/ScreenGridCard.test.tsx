import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenGridCard } from './components/ScreenGridCard.tsx';
import type { Screen } from './types.ts';

const screen: Screen = {
  id: 42,
  type: 'Settings',
  productArea: 'Account',
  theme: 'dark',
  visibleStates: ['Default'],
  platform: 'ios',
  description: null,
  url: '/media/full-screen.png',
  thumbnailUrl: '/media/thumb-screen.webp',
};

test('renders Screen cards with the full image and contained fit', () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /src="\/media\/full-screen\.png"/);
  assert.doesNotMatch(html, /src="\/media\/thumb-screen\.webp"/);
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
  assert.doesNotMatch(html, /scale\(1\.04\)/);
});
