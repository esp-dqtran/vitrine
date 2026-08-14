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
    thumbnailUrl: `/preview-${id}-thumb.webp`,
  })),
  previewUiElements: [{
    type: 'Navigation Menu', group: 'Navigation', count: 12,
    thumbnailUrl: '/preview-navigation.png',
  }],
  previewFlows: [{
    id: 'create-project', title: 'Creating a project',
    description: 'Start a new project', platform: 'web', stepCount: 4,
    screens: [{
      label: 'Choose template',
      imageUrl: '/api/flows/media/linear/web/11/22/1?variant=full',
      thumbnailUrl: '/api/flows/media/linear/web/11/22/1?variant=thumb',
    }, {
      label: 'Create project',
      thumbnailUrl: '/api/flows/media/linear/web/11/22/2?variant=thumb',
    }],
  }, {
    id: 'invite-team', title: 'Inviting the team',
    description: 'Add collaborators', platform: 'web', stepCount: 3,
    screens: [{ label: 'Invite people', thumbnailUrl: '/flow-invite.png' }],
  }, ...Array.from({ length: 6 }, (_, index) => ({
    id: `flow-${index + 3}`,
    title: `Flow ${index + 3}`,
    description: null,
    platform: 'web' as const,
    stepCount: 2,
    screens: [{ label: `Step ${index + 1}`, thumbnailUrl: `/flow-${index + 3}.png` }],
  }))],
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
  assert.match(html, /12/);
  assert.match(html, /Screens/);
  assert.match(html, /Flows/);
  assert.doesNotMatch(html, /UI Elements/);
  assert.doesNotMatch(html, /Navigation Menu/);
  assert.match(html, /Creating a project/);
  assert.match(html, /Inviting the team/);
  assert.match(html, /Flow 6/);
  assert.doesNotMatch(html, /Flow 7/);
  assert.match(html, /Showing 6 of 12/);
  assert.match(html, /data-public-preview-flow-expander="true"/);
  assert.match(html, /Show all 8 flows/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /Preview Creating a project flow screens/);
  assert.match(html, /data-flow-preview-url-sync="false"/);
  assert.match(html, /data-platform="web"/);
  assert.doesNotMatch(html, /data-public-preview-featured-flow="true"/);
  assert.doesNotMatch(html, /data-public-preview-flow-screen-strip="true"/);
  assert.match(html, /src="\/api\/flows\/media\/linear\/web\/11\/22\/1\?variant=full"/);
  assert.match(html, /src="\/api\/flows\/media\/linear\/web\/11\/22\/2\?variant=full"/);
  assert.doesNotMatch(html, /src="[^"]*variant=thumb"/);
  assert.match(html, /4 steps · 2 real screens/);
  assert.doesNotMatch(html, /Choose template/);
  assert.match(html, /Unlock more/);
  assert.match(html, /aria-label="Unlock more screens"/);
  assert.match(html, /src="\/preview-1\.png"/);
  assert.doesNotMatch(html, /preview-1-thumb\.webp/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /data-reference-gallery-layout="web-screens"/);
  assert.equal((html.match(/class="screen-grid-card"/g) ?? []).length, 3);
  assert.match(html, /class="[^"]*astryx-clickable-card/);
  assert.match(html, /Open Linear, Screen 1/);
  assert.doesNotMatch(html, /screen-grid-card__actions/);
  assert.doesNotMatch(html, /screen-grid-card__patterns/);
  assert.match(html, /data-variant="primary"/);
  assert.doesNotMatch(html, /astryx-badge/);
});

test('public app preview renders mobile flows with the shared mobile FlowCard geometry', () => {
  const mobilePreview: PublicAppPreview = {
    ...preview,
    app: { ...preview.app, platforms: ['ios'] },
    previewScreens: preview.previewScreens.map((screen) => ({
      ...screen,
      platform: 'ios',
    })),
    previewFlows: preview.previewFlows.slice(0, 1).map((flow) => ({
      ...flow,
      platform: 'ios',
    })),
  };
  const html = renderToStaticMarkup(
    <PublicAppPreviewPage
      preview={mobilePreview}
      freeUnlocksRemaining={null}
      isGuest
      onOpenSearch={() => undefined}
      onUnlock={() => undefined}
    />,
  );

  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /data-platform="ios"/);
  assert.match(html, /data-reference-gallery-layout="mobile-screens"/);
  assert.doesNotMatch(html, /data-platform="web"/);
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
  assert.doesNotMatch(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /Showing 1 of 12/);
  assert.doesNotMatch(html, /Show all 12 flows/);
  assert.doesNotMatch(html, /data-public-preview-flow-expander="true"/);
  assert.match(html, /class="public-app-preview__flow public-app-preview__flow--modal"/);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /data-flow-preview-url-sync="false"/);
  assert.match(html, /aria-label="Unlock more screens"/);
});

test('public app preview loading state exposes the screen-and-flow shell immediately', () => {
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
  assert.doesNotMatch(html, /UI Elements/);
  assert.match(html, /Flows/);
});
