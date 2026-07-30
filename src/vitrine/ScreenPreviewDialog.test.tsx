import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenPreviewDialog } from './components/ScreenPreviewDialog.tsx';
import type { Screen } from './types.ts';

const screen: Screen = {
  id: 42,
  type: 'Order detail',
  productArea: 'Placing an order',
  theme: 'light',
  visibleStates: ['Default'],
  platform: 'ios',
  description: 'An observed Amazon Shopping order detail screen.',
  url: '/media/order-detail.png',
};

test('renders a Mobbin-style app screen viewer with identity, navigation, actions, and metadata', () => {
  const html = renderToStaticMarkup(
    <ScreenPreviewDialog
      appName="Amazon Shopping"
      appIconUrl="/media/amazon-icon.png"
      screen={screen}
      index={1}
      total={3}
      foundInFlows={['Placing an order', 'Order detail']}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /data-app-screen-preview="42"/);
  assert.match(html, /Amazon Shopping/);
  assert.match(html, /aria-label="Previous screen"/);
  assert.match(html, /aria-label="Next screen"/);
  assert.match(html, />Found in</);
  assert.match(html, /Placing an order \+1/);
  assert.match(html, />Save</);
  assert.match(html, />Copy image</);
  assert.doesNotMatch(html, /Copy as PNG/);
  assert.match(html, /aria-label="More screen actions"/);
  assert.match(html, /iOS \(393×852\)/);
  assert.match(html, />More info</);
});
