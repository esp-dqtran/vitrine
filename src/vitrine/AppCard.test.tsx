import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppCard } from './components/AppCard.tsx';
import type { App, Screen } from './types.ts';

const screen = (id: number, url: string, platform: Screen['platform'] = 'web'): Screen => ({
  id,
  type: 'Dashboard',
  productArea: 'Workspace',
  theme: 'light',
  visibleStates: [],
  platform,
  description: null,
  url,
});

const app = (screens: Screen[]): App => ({
  id: 'linear',
  app: 'Linear',
  cat: 'Productivity',
  accent: '#7957ff',
  totalScreens: screens.length,
  platforms: ['web'],
  analyzedScreens: screens.length,
  lastCapturedAt: '2026-07-25T00:00:00.000Z',
  iconUrl: null,
  description: 'Plan and build products',
  previewVideoUrl: null,
  screens,
});

test('renders only the selected preview for a multi-screen App card', () => {
  const html = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/one.png'), screen(2, '/two.png')])} onOpen={() => undefined} />,
  );

  assert.match(html, /data-discovery-card="true"/);
  assert.match(html, /class="discovery-card app-discovery-card"/);
  assert.match(html, /class="discovery-card__media app-discovery-card__media"/);
  assert.match(html, /class="discovery-card__identity app-discovery-card__identity"/);
  assert.doesNotMatch(html, /app-discovery-card__preview/);
  assert.doesNotMatch(html, /data-app-card-preview/);
  assert.match(html, /src="\/one\.png"/);
  assert.match(html, /object-fit:cover/);
  assert.doesNotMatch(html, /src="\/two\.png"/);
  assert.doesNotMatch(html, /app-discovery-card__overlay/);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /Jul 25, 2026 · 2 screens/);
  assert.doesNotMatch(html, /Productivity · 2 screens/);
});

test('renders a preview from the active platform for a mixed-platform App', () => {
  const html = renderToStaticMarkup(
    <AppCard
      app={app([
        screen(1, '/ios.png', 'ios'),
        screen(2, '/web.png', 'web'),
      ])}
      platform="web"
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /src="\/web\.png"/);
  assert.doesNotMatch(html, /src="\/ios\.png"/);
});

test('contains complete iOS and Android previews instead of cropping them', () => {
  for (const platform of ['ios', 'android'] as const) {
    const html = renderToStaticMarkup(
      <AppCard
        app={app([screen(1, `/${platform}.png`, platform)])}
        platform={platform}
        onOpen={() => undefined}
      />,
    );

    assert.match(html, /class="app-discovery-card__phone-preview"/);
    assert.match(html, /background:transparent/);
    assert.match(html, /object-fit:contain/);
    assert.match(html, new RegExp(`data-preview-platform="${platform}"`));
    assert.doesNotMatch(html, /object-fit:cover/);
  }
});

test('keeps a single-screen App card free from an empty next layer', () => {
  const html = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/only.png')])} onOpen={() => undefined} />,
  );

  assert.doesNotMatch(html, /app-discovery-card__preview/);
  assert.doesNotMatch(html, /data-app-card-preview/);
  assert.doesNotMatch(html, /app-discovery-card__overlay/);
  assert.match(html, /Jul 25, 2026 · 1 screen/);
});

test('appends analysis progress to the shared App metadata row', () => {
  const html = renderToStaticMarkup(
    <AppCard
      app={app([screen(1, '/one.png'), screen(2, '/two.png')])}
      status="In progress"
      progressLabel="1/2 analyzed"
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /Jul 25, 2026 · 2 screens · 1\/2 analyzed/);
});
