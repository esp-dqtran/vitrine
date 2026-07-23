import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppKnowledgeView } from './appKnowledgeApi.ts';
import { AppKnowledgePanelView } from './components/AppKnowledgePanel.tsx';

const approvedView = {
  revision: {
    id: 1,
    revisionNumber: 2,
    reviewStatus: 'approved',
    createdAt: '2026-07-23T00:00:00.000Z',
    evidence: [{ evidenceId: 'SCREEN-42', imageId: 42, kind: 'screen' }],
    content: {
      identity: {
        app: 'linear',
        platform: 'web',
        captureVersionId: 7,
        generatedAt: '2026-07-23T00:00:00.000Z',
      },
      coverage: {
        total: 1,
        eligible: 1,
        analyzed: 1,
        skipped: 0,
        failed: 0,
        flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
      },
    },
  },
  projection: {
    role: 'designer',
    sections: [{
      id: 'screens',
      title: 'Screen taxonomy',
      claims: [{
        id: 'claim-1',
        kind: 'observed',
        text: 'The home screen establishes the primary navigation.',
        evidenceIds: ['SCREEN-42'],
        confidence: 0.92,
      }],
    }],
    entityIds: { screens: ['screen-home'], componentCandidates: [], flows: [] },
  },
} as unknown as AppKnowledgeView;

test('renders deterministic role knowledge with confidence, review, and evidence', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgePanelView
      app="linear"
      platform="web"
      version={2}
      userRole="user"
      knowledgeRole="designer"
      status="ready"
      view={approvedView}
      error={null}
      currentJob={null}
      actions={null}
      onRoleChange={() => undefined}
      retry={() => undefined}
    />,
  );
  assert.match(html, /Designer/);
  assert.match(html, /Developer/);
  assert.match(html, /Product/);
  assert.match(html, /Screen taxonomy/);
  assert.match(html, /92% confidence/);
  assert.match(html, /Approved/);
  assert.match(html, /SCREEN-42/);
});

test('keeps missing member analysis neutral without exposing admin actions', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgePanelView
      app="linear"
      platform="web"
      version={2}
      userRole="user"
      knowledgeRole="designer"
      status="missing"
      view={null}
      error={null}
      currentJob={null}
      actions={null}
      onRoleChange={() => undefined}
      retry={() => undefined}
    />,
  );
  assert.match(html, /Analysis is not published yet/);
  assert.doesNotMatch(html, />Start analysis</);
});

test('offers a scoped start action to admins when analysis is missing', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgePanelView
      app="linear"
      platform="web"
      version={2}
      userRole="admin"
      knowledgeRole="designer"
      status="missing"
      view={null}
      error={null}
      currentJob={null}
      actions={{ start: () => Promise.resolve() }}
      onRoleChange={() => undefined}
      retry={() => undefined}
    />,
  );
  assert.match(html, />Start analysis</);
  assert.match(html, /Linear · Web · Version 2/i);
});
