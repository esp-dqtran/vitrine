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

test('renders Screen cards with a thumbnail fallback and full image for high-density displays', () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /src="\/media\/thumb-screen\.webp"/);
  assert.doesNotMatch(html, /src="\/media\/full-screen\.png"/);
  assert.match(
    html,
    /srcSet="\/media\/thumb-screen\.webp 1x,\/media\/full-screen\.png 2x"/,
  );
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
  assert.doesNotMatch(html, /scale\(1\.04\)/);
});
