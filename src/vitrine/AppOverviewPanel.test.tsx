import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppOverviewPanel } from './components/AppOverviewPanel.tsx';

test('shows captured website context and an autoplaying continuous preview', () => {
  const html = renderToStaticMarkup(<AppOverviewPanel app={{
    id: 'example-com',
    app: 'Example',
    categories: [
      { id: 1, name: 'Business', slug: 'business' },
      { id: 2, name: 'Developer tools', slug: 'developer-tools' },
    ],
    accent: '#123456',
    totalScreens: 1,
    totalUiElements: 5,
    totalFlows: 0,
    platforms: ['web'],
    description: 'Build better examples.',
    websiteUrl: 'https://example.com',
    previewVideoUrl: '/api/apps/example-com/page-preview/71',
  }} />);

  assert.match(html, /Build better examples\./);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /<video/);
  assert.match(html, /src="\/api\/apps\/example-com\/page-preview\/71"/);
  assert.match(html, /autoPlay/);
  assert.match(html, /loop/);
  assert.match(html, /muted/);
  assert.match(html, /Business/);
  assert.match(html, /Developer tools/);
});
