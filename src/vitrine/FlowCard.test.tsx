import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FlowCard,
  flowPreviewIndexFromSearch,
  flowPreviewModeFromSearch,
} from './components/FlowCard.tsx';

const flow = {
  id: 'login',
  title: 'Login',
  description: '',
  tags: [],
  steps: [{
    label: 'Submit',
    evidence: [{
      imageId: 1,
      imageUrl: '/flow.png',
      thumbnailUrl: '/flow-thumb.webp',
      description: null,
    }],
  }],
};

test('renders a flow strip with responsive observed screen media', () => {
  const html = renderToStaticMarkup(<FlowCard flow={flow} onOpen={() => {}} />);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /flow-strip-card__stage" data-platform="web"/);
  assert.match(html, /aria-label="Preview Login flow screens"/);
  assert.match(html, /data-flow-preview-index="0"/);
  assert.match(html, /src="\/flow-thumb.webp"/);
  assert.match(html, /srcSet="\/flow-thumb.webp 1x,\/flow.png 2x"/);
  assert.match(html, /object-fit:cover/);
  assert.doesNotMatch(html, /background:#fff/);
  assert.match(html, /<h2>Login<\/h2>/);
  assert.match(html, />1 screen</);
  assert.match(html, />Save</);
  assert.match(html, />Copy flow link</);
});

test('keeps native-app flow screens in the mobile presentation', () => {
  const html = renderToStaticMarkup(
    <FlowCard flow={flow} platform="ios" onOpen={() => {}} />,
  );

  assert.match(html, /flow-strip-card__stage" data-platform="ios"/);
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
});

test('uses the captured-preview fallback when a flow has no evidence image', () => {
  const html = renderToStaticMarkup(
    <FlowCard flow={{ ...flow, steps: [{ label: 'Submit', evidence: [] }] }} onOpen={() => {}} />,
  );
  assert.match(html, /aria-label="Captured preview unavailable"/);
  assert.doesNotMatch(html, /<img/);
});

test('allows the aggregate Flow catalog to preserve the total screen count and context', () => {
  const html = renderToStaticMarkup(
    <FlowCard
      flow={{ ...flow, title: 'Logging out from Settings' }}
      screenCount={7}
      metaLabel="7 screens · observed in 42 apps"
      sourceAppName="WhatsApp"
      sourceAppIconUrl="/icons/whatsapp.png"
      onOpenSourceApp={() => {}}
      onOpen={() => {}}
    />,
  );
  assert.match(
    html,
    /<h2>Logging out <span class="flow-strip-card__title-connector">from<\/span> Settings<\/h2>/,
  );
  assert.match(html, /<button[^>]*aria-label="Open WhatsApp app"/);
  assert.match(html, /<img src="\/icons\/whatsapp\.png" alt=""/);
  assert.match(html, /7 screens · observed in 42 apps/);
});

test('does not repeat the app icon on Flow cards rendered inside an App', () => {
  const html = renderToStaticMarkup(
    <FlowCard
      flow={flow}
      sourceAppName="WhatsApp"
      sourceAppIconUrl="/icons/whatsapp.png"
      onOpen={() => {}}
    />,
  );

  assert.doesNotMatch(html, /flow-strip-card__app-icon/);
  assert.doesNotMatch(html, /\/icons\/whatsapp\.png/);
  assert.match(html, /<h2>Login<\/h2>/);
});

test('adds a category context to app-detail Flow titles without changing the Flow title', () => {
  const html = renderToStaticMarkup(
    <FlowCard
      flow={flow}
      contextLabel="Account"
      syncPreviewUrl={false}
      onOpen={() => {}}
    />,
  );

  assert.match(
    html,
    /<h2>Login <span class="flow-strip-card__title-connector">from<\/span> Account<\/h2>/,
  );
  assert.match(html, /data-flow-preview-url-sync="false"/);
});

test('hides the previous arrow at the initial left edge', () => {
  const html = renderToStaticMarkup(
    <FlowCard
      flow={{
        ...flow,
        steps: [
          flow.steps[0],
          {
            label: 'Confirm',
            evidence: [{
              imageId: 2,
              imageUrl: '/confirm.png',
              description: null,
            }],
          },
        ],
      }}
      onOpen={() => {}}
    />,
  );

  assert.doesNotMatch(html, /aria-label="Previous flow screens"/);
  assert.match(html, /aria-label="Next flow screens"/);
  assert.match(html, /src="\/confirm.png"/);
});

test('restores a valid Flow preview index from shareable URL state', () => {
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&tab=screens&screen=1', 'login', 3),
    1,
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&tab=screens&screen=99', 'login', 3),
    0,
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=other&tab=screens&screen=1', 'login', 3),
    null,
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&tab=document&screen=2', 'login', 3),
    2,
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&tab=prototype&screen=2', 'login', 3),
    2,
  );
  assert.equal(
    flowPreviewModeFromSearch('?flow=login&tab=prototype&screen=2', 'login'),
    'prototype',
  );
  assert.equal(
    flowPreviewModeFromSearch('?flow=login&tab=document&screen=2', 'login'),
    'document',
  );
  assert.equal(
    flowPreviewModeFromSearch('?flow=other&tab=document&screen=2', 'login'),
    'screens',
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&flowView=visual&step=1', 'login', 3),
    0,
  );
  assert.equal(
    flowPreviewIndexFromSearch('?flow=login&flowView=document&step=3', 'login', 3),
    2,
  );
  assert.equal(
    flowPreviewModeFromSearch('?flow=login&flowView=document&step=3', 'login'),
    'document',
  );
});
