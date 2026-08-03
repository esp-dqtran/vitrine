import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PublicAppPreviewModal,
  PublicAppPreviewPage,
} from './components/PublicAppPreviewPage.tsx';
import type { PublicAppPreview } from './publicAppPreviewApi.ts';

const preview: PublicAppPreview = {
  app: {
    id: 'linear', app: 'Linear', accent: '#5e6ad2', categories: [],
    totalScreens: 443, totalUiElements: 18, totalFlows: 12, analyzedScreens: 401,
    platforms: ['web'], iconUrl: '/linear.png', description: 'Product planning software',
  },
  previewScreens: [1, 2, 3].map((id) => ({
    id, type: `Screen ${id}`, productArea: 'Workspace', theme: 'dark' as const,
    visibleStates: [], platform: 'web', description: null, url: `/preview-${id}.png`,
  })),
  previewUiElements: [{
    type: 'Navigation Menu', group: 'Navigation', count: 12,
    thumbnailUrl: '/preview-navigation.png',
  }],
  previewFlows: [{
    id: 'create-project', title: 'Creating a project',
    description: 'Start a new project', stepCount: 4,
    screens: [{ label: 'Choose template', thumbnailUrl: '/flow-template.png' },
      { label: 'Create project', thumbnailUrl: '/flow-create.png' }],
  }, {
    id: 'invite-team', title: 'Inviting the team',
    description: 'Add collaborators', stepCount: 3,
    screens: [{ label: 'Invite people', thumbnailUrl: '/flow-invite.png' }],
  }],
};

test('public app preview emphasizes the app identity and keeps conversion on locked evidence', () => {
  const html = renderToStaticMarkup(
    <PublicAppPreviewPage
      preview={preview}
      freeUnlocksRemaining={2}
      isGuest={false}
      onOpenSearch={() => undefined}
      onUnlock={() => undefined}
    />,
  );
  assert.doesNotMatch(html, /Public preview/);
  assert.doesNotMatch(html, /Ready for the complete system/);
  assert.doesNotMatch(html, /Explore selected observed evidence/);
  assert.match(html, /src="\/linear.png"/);
  assert.match(html, /width:72px/);
  assert.match(html, /font-size:clamp\(42px, 6vw, 56px\)/);
  assert.match(html, /443/);
  assert.match(html, /18/);
  assert.match(html, /12/);
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /Navigation Menu/);
  assert.match(html, /Creating a project/);
  assert.doesNotMatch(html, /Inviting the team/);
  assert.match(html, /Showing 1 of 12/);
  assert.match(html, /data-public-preview-featured-flow="true"/);
  assert.match(html, /data-public-preview-flow-screen-strip="true"[^>]+overflow-x:auto/);
  assert.match(html, /src="\/flow-template.png"/);
  assert.match(html, /Choose template/);
  assert.match(html, /Unlock more/);
  assert.match(html, /aria-label="Unlock more screens"/);
});

test('public app preview omits the old guest and exhausted account panels', () => {
  const guest = renderToStaticMarkup(
    <PublicAppPreviewPage preview={preview} freeUnlocksRemaining={null} isGuest onOpenSearch={() => undefined} onUnlock={() => undefined} />,
  );
  assert.doesNotMatch(guest, /Sign in to unlock full analysis/);
  assert.doesNotMatch(guest, /Ready for the complete system/);

  const exhausted = renderToStaticMarkup(
    <PublicAppPreviewPage preview={preview} freeUnlocksRemaining={0} isGuest={false} onOpenSearch={() => undefined} onUnlock={() => undefined} />,
  );
  assert.doesNotMatch(exhausted, /All three permanent Free app unlocks are used/);
  assert.doesNotMatch(exhausted, /Upgrade to Pro/);
});

test('public app preview can render as a modal without page navigation', () => {
  const html = renderToStaticMarkup(
    <PublicAppPreviewModal
      preview={preview}
      loading={false}
      error=""
      freeUnlocksRemaining={2}
      isGuest={false}
      onUnlock={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(html, /data-public-app-preview-modal="true"/);
  assert.match(html, /data-public-preview-close="true" style="position:relative/);
  assert.doesNotMatch(html, /data-public-preview-close="true" style="position:sticky/);
  assert.match(html, /aria-label="Close preview"/);
  assert.doesNotMatch(html, />Close preview</);
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /aria-label="Unlock more screens"/);
});

test('public app preview loading state exposes the three-section shell immediately', () => {
  const html = renderToStaticMarkup(
    <PublicAppPreviewModal
      preview={null}
      loading
      error=""
      freeUnlocksRemaining={null}
      isGuest
      onUnlock={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(html, /Loading public app preview/);
  assert.match(html, /Screens/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
});
