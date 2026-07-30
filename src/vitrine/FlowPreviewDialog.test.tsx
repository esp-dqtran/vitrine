import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowPreviewDialog } from './components/FlowPreviewDialog.tsx';

const screens = [
  {
    label: 'Welcome',
    stepNumber: 1,
    evidence: {
      imageId: 1,
      imageUrl: '/flows/welcome.png',
      thumbnailUrl: '/flows/welcome-thumb.webp',
      description: 'Welcome screen',
      responsiveViewport: '1512x945',
    },
  },
  {
    label: 'Create account',
    stepNumber: 2,
    evidence: {
      imageId: 2,
      imageUrl: '/flows/account.png',
      description: 'Create account screen',
    },
  },
];
const flow = {
  id: 'mercor:onboarding',
  title: 'Onboarding',
  description: '',
  tags: [],
  steps: screens.map((screen) => ({
    label: screen.label,
    evidence: [screen.evidence],
  })),
};

test('renders a dedicated Flow workspace with real app identity and full-resolution screens', () => {
  const html = renderToStaticMarkup(
    <FlowPreviewDialog
      flowId="mercor:onboarding"
      flowTitle="Onboarding"
      flow={flow}
      screens={screens}
      activeIndex={0}
      activeMode="screens"
      platform="web"
      sourceAppName="Mercor"
      sourceAppIconUrl="/icons/mercor.png"
      onActiveIndexChange={() => undefined}
      onModeChange={() => undefined}
      onClose={() => undefined}
      onOpenSourceApp={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Onboarding in Mercor"/);
  assert.match(html, /data-flow-preview-dialog="mercor:onboarding"/);
  assert.match(html, /class="[^"]*flow-preview-dialog flow-preview-dialog--web"/);
  assert.match(html, /data-flow-preview-platform="web"/);
  assert.match(html, /data-active-mode="screens"/);
  assert.match(
    html,
    /class="flow-preview-dialog__mode-indicator" aria-hidden="true"/,
  );
  assert.match(html, /aria-label="Open Mercor app"/);
  assert.match(html, /<img src="\/icons\/mercor\.png" alt=""/);
  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Screens")(?=[^>]*aria-selected="true")/,
  );
  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Prototype")(?=[^>]*aria-selected="false")/,
  );
  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Document")(?=[^>]*aria-selected="false")/,
  );
  assert.match(html, /src="\/flows\/welcome\.png"/);
  assert.match(html, /src="\/flows\/account\.png"/);
  assert.doesNotMatch(html, /welcome-thumb\.webp/);
  assert.match(html, /aria-label="Copy link"/);
  assert.match(html, /aria-label="Close Flow preview"/);
  assert.match(html, />Save</);
  assert.match(html, />Copy image</);
  assert.doesNotMatch(html, /Copy image URL/);
  assert.match(html, /aria-label="More screen actions"/);
  assert.match(html, />Web 1512×945</);
  assert.match(html, /aria-expanded="false"[^>]*>[\s\S]*More info/);
  assert.doesNotMatch(html, /aria-label="Previous Flow screen"/);
  assert.match(html, /aria-label="Next Flow screen"/);
});

test('keeps phone Screens mode free of carousel navigation arrows', () => {
  const html = renderToStaticMarkup(
    <FlowPreviewDialog
      flowId="mercor:onboarding"
      flowTitle="Onboarding"
      flow={flow}
      screens={screens}
      activeIndex={1}
      activeMode="screens"
      platform="ios"
      onActiveIndexChange={() => undefined}
      onModeChange={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /aria-label="Previous Flow screen"/);
  assert.doesNotMatch(html, /aria-label="Next Flow screen"/);
  assert.match(html, /Screen 2 of 2: Create account/);
});

test('renders Mobbin-style prototype playback as a first-class mode', () => {
  const html = renderToStaticMarkup(
    <FlowPreviewDialog
      flowId="mercor:onboarding"
      flowTitle="Onboarding"
      flow={flow}
      screens={screens}
      activeIndex={0}
      activeMode="prototype"
      platform="web"
      onActiveIndexChange={() => undefined}
      onModeChange={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Prototype")(?=[^>]*aria-selected="true")/,
  );
  assert.match(html, /data-active-mode="prototype"/);
  assert.match(html, /aria-label="Flow prototype"/);
  assert.match(html, /aria-label="Prototype screen 1: Welcome"/);
  assert.match(html, /aria-label="Next Flow screen"/);
  assert.doesNotMatch(html, /aria-label="Previous Flow screen"/);
  assert.match(html, />Restart prototype</);
  assert.match(html, /aria-label="More prototype actions"/);
  assert.match(html, />1 of 2</);
  assert.doesNotMatch(html, /aria-label="More screen actions"/);
});

test('renders the Feature Document panel as a first-class modal mode', () => {
  const html = renderToStaticMarkup(
    <FlowPreviewDialog
      flowId="mercor:onboarding"
      flowTitle="Onboarding"
      flow={flow}
      screens={screens}
      activeIndex={0}
      activeMode="document"
      platform="web"
      documentSource={{
        app: 'mercor',
        platform: 'web',
        version: 3,
        flowId: 'onboarding',
      }}
      userRole="admin"
      onActiveIndexChange={() => undefined}
      onModeChange={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Screens")(?=[^>]*aria-selected="false")/,
  );
  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Prototype")(?=[^>]*aria-selected="false")/,
  );
  assert.match(
    html,
    /<button(?=[^>]*role="tab")(?=[^>]*aria-label="Document")(?=[^>]*aria-selected="true")/,
  );
  assert.match(html, /data-active-mode="document"/);
  assert.match(html, /aria-label="Feature Document"/);
  assert.match(html, /aria-label="Document Flow"/);
  assert.doesNotMatch(html, /aria-label="Next Flow screen"/);
  assert.doesNotMatch(html, /aria-label="More screen actions"/);
});
