import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportTrackerPanel, PipelineStatusList, screenHasSynthesizedEvidence } from './components/ImportTrackerPanel.tsx';
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
  const html = renderToStaticMarkup(<ImportTrackerPanel apps={apps} onBack={() => undefined} />);
  assert.match(html, /Import Tracker/);
  assert.match(html, /DoneApp/);
  assert.match(html, /PartialApp/);
  // captured = 2 + 5 = 7 ; analyzed = 2 + 1 = 3
  assert.match(html, /Screens captured/);
  assert.match(html, /Needs attention/);         // failed accepted pipelines remain filterable
  assert.match(html, /Complete/);                // DoneApp: sample covers all captured + analyzed
  assert.match(html, /In progress/);             // PartialApp
  assert.match(html, /2\/2 analyzed/);           // DoneApp progress label (captured = 2)
  assert.match(html, /1\/5 analyzed/);           // PartialApp progress label (captured = 5)
});

test('shows accepted pipeline failures and cancellation controls', () => {
  const jobs: Job[] = [
    { id: 10, parent_id: null, type: 'import-app', payload: { name: 'linear' }, status: 'running', message: 'Capturing', created_at: '2026-07-12', updated_at: null },
    { id: 11, parent_id: 10, type: 'caption-app', payload: { name: 'linear' }, status: 'error', message: 'Provider unavailable', created_at: '2026-07-12', updated_at: null },
    { id: 12, parent_id: 10, type: 'research-app', payload: { name: 'atlassian' }, status: 'done', message: null, created_at: '2026-07-12', updated_at: null },
    { id: 13, parent_id: 10, type: 'smart-crawl-app', payload: { name: 'atlassian' }, status: 'queued', message: null, created_at: '2026-07-12', updated_at: null },
  ];
  const html = renderToStaticMarkup(<PipelineStatusList jobs={jobs} error="Job refresh failed" onCancel={() => undefined} />);
  assert.match(html, /Job refresh failed/);
  assert.match(html, /Provider unavailable/);
  assert.match(html, /Research crawl plan/);
  assert.match(html, /Run smart crawl/);
  assert.match(html, /Cancel/);
});

test('marks synthesis complete only when the screen has snapshot evidence', () => {
  const snapshot = {
    app: 'linear', generatedAt: '2026-07-12', flows: [], rules: [],
    tokens: [{ id: 'accent', kind: 'color' as const, name: 'Accent', value: '#5e6ad2', role: 'accent', evidence: [{ imageId: 7, imageUrl: '/7', description: null }] }],
    components: [],
  };
  assert.equal(screenHasSynthesizedEvidence(snapshot, 7), true);
  assert.equal(screenHasSynthesizedEvidence(snapshot, 8), false);
});
