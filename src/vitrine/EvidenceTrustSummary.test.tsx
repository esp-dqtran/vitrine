import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EvidenceTrustSummary,
  evidenceCorrectionBrief,
} from './components/EvidenceTrustSummary.tsx';

test('renders explicit unknown trust values instead of implying certainty', () => {
  const html = renderToStaticMarkup(
    <EvidenceTrustSummary evidenceId="screen:stripe:12" />,
  );
  assert.match(html, />Not scored</);
  assert.match(html, />Not assessed</);
  assert.match(html, />Date unavailable</);
});

test('builds a traceable correction brief from evidence metadata', () => {
  assert.equal(
    evidenceCorrectionBrief({
      evidenceId: 'screen:stripe:12',
      sourceUrl: 'https://dashboard.stripe.com/',
      capturedAt: '2026-08-01T00:00:00.000Z',
    }),
    [
      'Vitrines evidence correction',
      'Evidence: screen:stripe:12',
      'Source: https://dashboard.stripe.com/',
      'Captured: 2026-08-01T00:00:00.000Z',
      'Correction needed:',
    ].join('\n'),
  );
});
