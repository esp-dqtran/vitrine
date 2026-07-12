import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportTrackerPanel } from './components/ImportTrackerPanel.tsx';
import type { App, Screen } from './types.ts';

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
  const html = renderToStaticMarkup(<ImportTrackerPanel apps={apps} onBack={() => undefined} />);
  assert.match(html, /Import Tracker/);
  assert.match(html, /DoneApp/);
  assert.match(html, /PartialApp/);
  // captured = 2 + 5 = 7 ; analyzed = 2 + 1 = 3
  assert.match(html, /Screens captured/);
  assert.doesNotMatch(html, /Needs attention/); // no fabricated "pending capture" dimension
  assert.match(html, /Complete/);                // DoneApp: sample covers all captured + analyzed
  assert.match(html, /In progress/);             // PartialApp
  assert.match(html, /2\/2 analyzed/);           // DoneApp progress label (captured = 2)
  assert.match(html, /1\/5 analyzed/);           // PartialApp progress label (captured = 5)
});
