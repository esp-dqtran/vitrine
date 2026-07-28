import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowsPageView } from './components/FlowsPage.tsx';

const items = [
  {
    category: 'Account Management',
    title: 'Logging in',
    count: 12,
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: '/icons/linear.png',
      screenCount: 2,
      flow: {
        id: 'linear:1',
        title: 'Logging in',
        category: 'Account Management',
        description: '',
        tags: [],
        steps: [
          { label: 'Enter email', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Enter email' }] },
          { label: 'Submit', evidence: [{ imageId: 2, imageUrl: '/flow/2', description: 'Submit' }] },
        ],
      },
    },
  },
  {
    category: 'New User Experience',
    title: 'Onboarding',
    count: 8,
    preview: {
      appId: 'notion',
      appName: 'Notion',
      appIconUrl: '/icons/notion.png',
      screenCount: 1,
      flow: {
        id: 'notion:2',
        title: 'Onboarding',
        category: 'New User Experience',
        description: '',
        tags: [],
        steps: [{ label: 'Welcome', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Welcome' }] }],
      },
    },
  },
  {
    category: 'Account Management',
    title: 'Resetting password',
    count: 5,
    preview: {
      appId: 'linear',
      appName: 'Linear',
      appIconUrl: null,
      screenCount: 1,
      flow: {
        id: 'linear:3',
        title: 'Resetting password',
        category: 'Account Management',
        description: '',
        tags: [],
        steps: [{ label: 'Reset', evidence: [{ imageId: 1, imageUrl: '/flow/1', description: 'Reset' }] }],
      },
    },
  },
];

test('renders a first-class searchable Flow catalog beside Apps and Sites', () => {
  const html = renderToStaticMarkup(
    <FlowsPageView
      items={items}
      platform="web"
      query=""
      loading={false}
      error=""
      hasMore={false}
      order="browse"
      onPlatformChange={() => undefined}
      onQueryChange={() => undefined}
      onOrderChange={() => undefined}
      onOpenSearch={() => undefined}
      onSelectFlow={() => undefined}
      onSelectApp={() => undefined}
      onRetry={() => undefined}
      onLoadMore={() => undefined}
    />,
  );

  assert.match(html, /data-flows-discovery="true"/);
  assert.match(html, /aria-selected="true"[^>]*>.*?Flows/s);
  assert.match(html, /aria-label="Flow discovery filters"/);
  assert.match(html, /Flow groups/);
  assert.match(html, /aria-label="Flow ordering"/);
  assert.match(html, />Popular</);
  assert.match(html, />Grouped</);
  assert.match(html, />Account Management</);
  assert.match(html, />New User Experience</);
  assert.match(html, /aria-label="Open Logging in from Account Management flow"/);
  assert.match(
    html,
    /<h2>Logging in <span class="flow-strip-card__title-connector">from<\/span> Account Management<\/h2>/,
  );
  assert.match(html, /aria-label="Open Linear app"/);
  assert.match(html, /<img src="\/icons\/linear\.png" alt=""/);
  assert.doesNotMatch(html, /flows-discovery__flow-heading/);
  assert.doesNotMatch(html, /Previewed from/);
  assert.match(html, /observed in 12 apps/);
  assert.match(html, /data-flow-strip-card="true"/);
});
