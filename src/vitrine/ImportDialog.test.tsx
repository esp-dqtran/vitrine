import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportDialog, appRow, buildPipelineRows } from './components/ImportDialog.tsx';
import { AppCard } from './components/AppCard.tsx';
import { ImportingAppCard } from './components/ImportingAppCard.tsx';
import { PlaceholderImage } from './components/PlaceholderImage.tsx';
import type { App, Job, Screen } from './types.ts';

const screen = (id: number, over: Partial<Screen> = {}): Screen => ({
  id, type: 'Dashboard', productArea: 'Home', theme: 'light', visibleStates: [], platform: 'web',
  description: null, url: `https://x/${id}.png`, sourceUrl: `https://mobbin.com/s/${id}`, capturedAt: '2026-07-09T00:00:00Z', confidence: null,
  ...over,
});

const apps: App[] = [
  // fully analyzed sample covering every captured screen -> Complete
  { id: 'done', app: 'DoneApp', cat: 'Fintech', accent: '#059669', totalScreens: 2, screens: [screen(1, { confidence: 0.9 }), screen(2, { confidence: 0.8 })] },
  // captured=5 but only a 2-screen sample with 1 analyzed -> In progress (never fakes "pending")
  { id: 'partial', app: 'PartialApp', cat: 'Travel', accent: '#f0763b', totalScreens: 5, screens: [screen(3, { confidence: 0.9 }), screen(4)] },
];

test('derives per-app capture/analysis metrics and status from real screen data', () => {
  const [done, partial] = apps.map(appRow);
  assert.equal(done.status, 'Complete');
  assert.equal(done.captured, 2);
  assert.equal(done.analyzed, 2);
  assert.equal(partial.status, 'In progress');
  assert.equal(partial.captured, 5);
  assert.equal(partial.analyzed, 1);
});

test('adds synthetic pipeline rows for in-flight imports not yet in the app list', () => {
  const jobs: Job[] = [
    { id: 10, parent_id: null, type: 'import-app', payload: { name: 'linear' }, status: 'running', message: 'Capturing', created_at: '2026-07-12', updated_at: null },
    { id: 11, parent_id: 10, type: 'caption-app', payload: { name: 'linear' }, status: 'error', message: 'Provider unavailable', created_at: '2026-07-12', updated_at: null },
  ];
  const rows = buildPipelineRows(apps, jobs);
  assert.equal(rows.length, 3);
  const linear = rows.find((r) => r.slug === 'linear');
  assert.ok(linear);
  assert.equal(linear!.status, 'Needs attention');
  assert.equal(linear!.app, undefined);
});

test('renders the import dialog with a platform selector', () => {
  const html = renderToStaticMarkup(
    <ImportDialog isOpen onClose={() => undefined} submitImport={async () => undefined} knownPlatforms={() => []} />,
  );
  assert.match(html, /Import from URL/);
  assert.match(html, /Mobbin screens URL/);
  assert.match(html, /Platform/);
});

test('app cards expose a keyboard action separately from carousel controls', () => {
  const html = renderToStaticMarkup(<AppCard app={apps[0]} onOpen={() => undefined} status="In progress" progressLabel="1/2 analyzed" />);
  assert.match(html, /aria-label="Open DoneApp"/);
  assert.match(html, /aria-label="Previous screen"/);
  assert.match(html, /aria-label="Next screen"/);
  assert.match(html, /View screens/);
  assert.match(html, /DoneApp/);
  assert.match(html, /In progress/);
  assert.match(html, /1\/2 analyzed/);
});

test('loading and unavailable cards keep explicit accessible labels', () => {
  const row = { ...appRow(apps[1]), status: 'In progress' as const };
  const html = renderToStaticMarkup(<><ImportingAppCard row={row} /><PlaceholderImage /></>);
  assert.match(html, /aria-label="PartialApp import In progress"/);
  assert.match(html, /aria-label="Captured preview unavailable"/);
});
