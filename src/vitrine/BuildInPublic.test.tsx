import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildInPublicPage } from './BuildInPublic.tsx';
import { decideRootRoute } from './routeDecision.ts';

test('renders the three pillars as an animated public pipeline', () => {
  const html = renderToStaticMarkup(
    <BuildInPublicPage onHome={() => undefined} onBrowse={() => undefined} onPricing={() => undefined} />,
  );

  assert.match(html, /<h1[^>]*>Building the design intelligence workspace in the open<\/h1>/);
  assert.match(html, /Last updated July 30, 2026/);
  assert.match(html, /Sites \+ Apps we crawl/);
  assert.match(html, /Data we analyze/);
  assert.match(html, /Features we build/);
  assert.match(html, /<ol/);
  assert.match(html, /Up next/);
  assert.match(html, /Exploring/);
  assert.match(html, />465</);
  assert.match(html, />137K\+</);
  assert.match(html, />647</);
  assert.match(html, /Browse the library/);
  assert.match(html, /Vitrines runs on three engines/);
  const visibleText = html.replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(visibleText, /Astryx/i);
});

test('keeps pillar content typed, static, and independent from APIs', () => {
  const source = readFileSync(new URL('./BuildInPublic.tsx', import.meta.url), 'utf8');

  assert.match(source, /const PILLARS: readonly PillarData\[\]/);
  assert.doesNotMatch(source, /fetch\(|useEffect|setInterval|setTimeout/);
});

test('renders the roadmap before authentication gates', () => {
  const source = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.deepEqual(
    decideRootRoute(
      { name: 'build-in-public' },
      {
        auth: 'loading',
        advancedSearchEnabled: false,
        researchProjectsEnabled: false,
      },
    ),
    { kind: 'public', page: 'build-in-public' },
  );
  assert.match(source, /case 'public':[\s\S]+case 'build-in-public':/);
  assert.match(source, /<BuildInPublicPage/);
});
