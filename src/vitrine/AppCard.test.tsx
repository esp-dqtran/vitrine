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
  categories: [{ id: 7, name: 'Productivity', slug: 'productivity' }],
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

test('renders only the selected full preview for a multi-screen App card', () => {
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
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
  assert.doesNotMatch(html, /src="\/two\.png"/);
  assert.doesNotMatch(html, /app-discovery-card__overlay/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /Jul 25, 2026/);
  assert.doesNotMatch(html, /2 screens/);
});

test('offers the full preview to high-density displays while keeping the thumbnail fallback', () => {
  const html = renderToStaticMarkup(
    <AppCard
      app={app([{
        ...screen(1, '/api/preview-media/linear/1?variant=full'),
        thumbnailUrl: '/api/preview-media/linear/1',
      }])}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /src="\/api\/preview-media\/linear\/1"/);
  assert.match(
    html,
    /srcSet="\/api\/preview-media\/linear\/1 1x,\/api\/preview-media\/linear\/1\?variant=full 2x"/,
  );
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

test('fills Android AppCard slots like iOS while keeping iOS previews uncropped', () => {
  const iosHtml = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/ios.png', 'ios')])} platform="ios" onOpen={() => undefined} />,
  );
  const androidHtml = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/android.png', 'android')])} platform="android" onOpen={() => undefined} />,
  );

  assert.match(iosHtml, /class="app-discovery-card__phone-preview"/);
  assert.match(iosHtml, /background:transparent/);
  assert.match(iosHtml, /object-fit:contain/);
  assert.match(iosHtml, /data-preview-platform="ios"/);
  assert.doesNotMatch(iosHtml, /object-fit:cover/);

  assert.match(androidHtml, /class="app-discovery-card__phone-preview"/);
  assert.match(androidHtml, /background:transparent/);
  assert.match(androidHtml, /object-fit:cover/);
  assert.match(androidHtml, /data-preview-platform="android"/);
});

test('renders the first three phone previews as one AppCard row', () => {
  const html = renderToStaticMarkup(
    <AppCard
      app={app([
        screen(1, '/ios-one.png', 'ios'),
        screen(2, '/ios-two.png', 'ios'),
        screen(3, '/ios-three.png', 'ios'),
        screen(4, '/web.png', 'web'),
      ])}
      platform="ios"
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /data-preview-layout="triptych"/);
  assert.equal((html.match(/class="app-discovery-card__phone-preview"/g) ?? []).length, 3);
  assert.match(html, /src="\/ios-one\.png"/);
  assert.match(html, /src="\/ios-two\.png"/);
  assert.match(html, /src="\/ios-three\.png"/);
  assert.doesNotMatch(html, /src="\/web\.png"/);
});

test('keeps a single-screen App card free from an empty next layer', () => {
  const html = renderToStaticMarkup(
    <AppCard app={app([screen(1, '/only.png')])} onOpen={() => undefined} />,
  );

  assert.doesNotMatch(html, /app-discovery-card__preview/);
  assert.doesNotMatch(html, /data-app-card-preview/);
  assert.doesNotMatch(html, /app-discovery-card__overlay/);
  assert.doesNotMatch(html, /Jul 25, 2026/);
});

test('shows the stored app description instead of its category', () => {
  const description = 'Bring all your people data into one place.';
  const html = renderToStaticMarkup(
    <AppCard
      app={{
        ...app([screen(1, '/only.png')]),
        description,
        categories: [{ id: 7, name: 'Productivity', slug: 'productivity' }],
      }}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, new RegExp(description));
  assert.doesNotMatch(html, />Productivity</);
});
