import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminAppKnowledgeView } from './appKnowledgeApi.ts';
import { AppKnowledgeReviewPanel } from './components/AppKnowledgeReviewPanel.tsx';

const claim = {
  id: 'claim-home',
  kind: 'observed' as const,
  text: 'The home screen establishes primary navigation.',
  evidenceIds: ['SCREEN-1'],
  confidence: 0.92,
};

const content = {
  identity: {
    app: 'linear',
    platform: 'web' as const,
    captureVersionId: 7,
    sourceSha256: 'a'.repeat(64),
    providerModel: 'vision-model',
    promptVersion: 1,
    generatedAt: '2026-07-23T00:00:00.000Z',
  },
  coverage: {
    total: 2, eligible: 2, analyzed: 1, cached: 0, quarantined: 0,
    skipped: 0, failed: 1, duplicateVisuals: 0,
    byKind: {
      screen: { total: 1, eligible: 1, analyzed: 1, cached: 0, quarantined: 0, failed: 0 },
      flow_step: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
      ui_element: { total: 1, eligible: 1, analyzed: 0, cached: 0, quarantined: 0, failed: 1 },
    },
    flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
  },
  screens: [{
    id: 'screen-home',
    evidenceId: 'SCREEN-1',
    pageType: 'Home',
    productArea: 'Core',
    purpose: 'Orient',
    viewport: 'desktop' as const,
    visibleText: ['Home'],
    theme: 'light' as const,
    visualHierarchy: [],
    layoutPatterns: [],
    contentPatterns: [],
    imagery: [],
    icons: [],
    interactionPatterns: [],
    visibleStates: [],
    availableActions: [],
    systemFeedback: [],
    accessibilityObservations: [],
    claims: [claim],
    confidence: 0.92,
    reviewStatus: 'needs_review' as const,
  }],
  componentCandidates: [{
    id: 'component-nav',
    name: 'Primary navigation',
    category: 'navigation',
    purpose: 'Move between areas',
    anatomy: [],
    observedProperties: [],
    variants: [],
    states: [],
    responsiveEvidence: [],
    evidenceIds: ['SCREEN-1'],
    visualRegions: [],
    designLanguageCandidateIds: [],
    claims: [],
    confidence: 0.8,
    status: 'candidate' as const,
  }],
  designLanguage: {
    color: [{ ...claim, id: 'token-blue', text: 'Blue is used for primary actions.' }],
    typography: [], spacing: [], radius: [], border: [], effects: [], layout: [],
    iconography: [], imagery: [], responsive: [], content: [], interaction: [],
  },
  flows: [],
  productKnowledge: {
    capabilities: [], featureRelationships: [], userJourneys: [], actorResponsibilities: [],
    requirements: [], acceptanceCriteria: [], edgeCases: [], dependencies: [], risks: [],
    successMetrics: [], guardrails: [], analyticsEvents: [], openQuestions: [],
  },
};

const view = {
  snapshot: {
    id: 41,
    target: {
      appId: 3, app: 'linear', platformId: 5, platform: 'web',
      captureVersionId: 7, versionNumber: 2,
    },
    currentRevisionId: 51,
    currentRevision: {
      id: 51,
      snapshotId: 41,
      revisionNumber: 1,
      authorType: 'generated',
      reviewStatus: 'draft',
      content,
      manifest: [{
        evidenceId: 'SCREEN-1',
        imageId: 1,
        kind: 'screen',
        eligibility: 'eligible',
        reason: 'screen_capture',
        object: { sha256: 'b'.repeat(64), byteSize: 100, contentType: 'image/png' },
      }],
      sourceSha256: 'a'.repeat(64),
      providerModel: 'vision-model',
      promptVersion: 1,
      createdBy: 1,
      createdAt: '2026-07-23T00:00:00.000Z',
    },
    revisions: [],
    reviewEvents: [],
  },
  job: null,
  coverage: content.coverage,
  qualityDiagnostics: {
    partialCoverage: true,
    failedEvidenceCount: 1,
    needsReviewScreenIds: ['screen-home'],
    candidateComponentIds: ['component-nav'],
    lowConfidenceClaimIds: [],
    sourceChanged: false,
  },
} as unknown as AdminAppKnowledgeView;

const actions = {
  saveRevision: async () => ({ id: 52 }),
  recordReviewAction: async () => undefined,
  setReviewStatus: async () => undefined,
  acknowledgeCoverage: async () => undefined,
  regenerate: async () => undefined,
};

test('renders claim editing, exact evidence, candidate decisions, and guarded snapshot actions', () => {
  const html = renderToStaticMarkup(
    <AppKnowledgeReviewPanel
      app="linear"
      platform="web"
      version={2}
      view={view}
      actions={actions}
      retry={() => undefined}
    />,
  );
  assert.match(html, /App Knowledge review/);
  assert.match(html, /The home screen establishes primary navigation/);
  assert.match(html, /textarea/);
  assert.match(html, /SCREEN-1/);
  assert.match(html, /Approve claim/);
  assert.match(html, /Reject claim/);
  assert.match(html, /Primary navigation/);
  assert.match(html, /Confirm component/);
  assert.match(html, /Reject component/);
  assert.match(html, /Blue is used for primary actions/);
  assert.match(html, /Confirm token/);
  assert.match(html, /Acknowledge partial coverage/);
  assert.match(html, /Submit for review/);
  assert.match(html, /Regenerate/);
});

test('saves a complete cloned snapshot and records review decisions without browser prompts', () => {
  const source = readFileSync(new URL('./components/AppKnowledgeReviewPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /structuredClone/);
  assert.match(source, /saveRevision/);
  assert.match(source, /recordReviewAction/);
  assert.doesNotMatch(source, /window\.prompt|window\.confirm/);
});
