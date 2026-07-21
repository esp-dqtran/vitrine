import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceDetailShell } from './components/ReferenceDetailShell.tsx';

test('renders the Apps-style hero, actions, metadata, and accessible tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailShell
      title="V7"
      identityKey="site-icon-1"
      identityLabel="V"
      backLabel="Back to all sites"
      onBack={() => undefined}
      metadata={[{ label: 'Version', value: 'Jul 2026' }, { label: 'Pages', value: '16' }]}
      actions={<button>Visit site</button>}
      tabs={[{ id: 'overview', label: 'Overview' }, { id: 'pages', label: 'Pages', count: 16 }]}
      activeTab="overview"
      onTabChange={() => undefined}
    >Overview content</ReferenceDetailShell>,
  );
  assert.match(html, /Back to all sites/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /Visit site/);
  assert.match(html, /Overview content/);
  assert.match(html, /<div style="min-height:400px">/);
  assert.doesNotMatch(html, /background:[^;"]+;min-height:400px/);
});
