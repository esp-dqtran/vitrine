import assert from 'node:assert/strict';
import test from 'node:test';
import {
  verifyAppKnowledgePilot,
  type PilotVerifierInput,
} from './verify-app-knowledge-pilot.ts';

function fixture(): PilotVerifierInput {
  const uiElements = Array.from({ length: 610 }, (_, index) => ({
    evidenceId: `UI-ELEMENT-${index + 1}`,
    imageId: index + 1,
    kind: 'ui_element' as const,
    eligibility: 'quarantined' as const,
  }));
  const flowSteps = Array.from({ length: 754 }, (_, index) => ({
    evidenceId: `FLOW-${index + 1}`,
    imageId: (index % 610) + 1,
    kind: 'flow_step' as const,
    eligibility: 'eligible' as const,
    flow: { id: `flow-${Math.floor(index / 151) + 1}`, stepIndex: index },
  }));
  const manifest = [
    { evidenceId: 'SCREEN-1', imageId: 900, kind: 'screen' as const, eligibility: 'eligible' as const },
    ...uiElements,
    ...flowSteps,
  ];
  return {
    app: '15five',
    platform: 'web',
    version: 1,
    manifest,
    evidenceRecords: manifest
      .filter(({ eligibility }) => eligibility === 'eligible')
      .map(({ evidenceId }) => ({ evidenceId, status: 'cached' as const })),
    snapshot: {
      coverage: {
        flowReferences: { total: 754, resolved: 754, uniqueImages: 610 },
      },
      claims: [{
        id: 'claim-1',
        kind: 'observed',
        text: 'The dashboard exposes current priorities.',
        evidenceIds: ['SCREEN-1'],
      }],
      flows: Array.from({ length: 5 }, (_, index) => ({
        id: `flow-${index + 1}`,
        evidenceIds: flowSteps
          .filter(({ flow }) => flow.id === `flow-${index + 1}`)
          .map(({ evidenceId }) => evidenceId),
      })),
    },
    repeatedManifest: {
      repeated: true,
      eligible: 755,
      cacheHits: 755,
      missingCacheEntries: 0,
    },
    acceptance: {
      resume: true,
      cancel: true,
      retry: true,
      stale: true,
      auth: true,
      review: true,
    },
    reviewedFlowIds: ['flow-1', 'flow-2', 'flow-3', 'flow-4', 'flow-5'],
    reviewedRoles: ['designer', 'developer', 'product'],
  };
}

test('passes the exact 15five pilot fixture', () => {
  const result = verifyAppKnowledgePilot(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.failedGates, []);
});

const cases: Array<[string, (input: PilotVerifierInput) => void, string]> = [
  ['UI Element quarantine count', (input) => {
    input.manifest.splice(input.manifest.findIndex(({ kind }) => kind === 'ui_element'), 1);
  }, 'ui_element_quarantine'],
  ['Flow reference count', (input) => { input.snapshot.coverage.flowReferences.total = 753; }, 'flow_reference_count'],
  ['unique Flow image count', (input) => { input.snapshot.coverage.flowReferences.uniqueImages = 609; }, 'unique_flow_images'],
  ['unresolved Flow reference', (input) => { input.snapshot.coverage.flowReferences.resolved = 753; }, 'flow_references_resolved'],
  ['silently missing eligible evidence', (input) => { input.evidenceRecords.pop(); }, 'eligible_evidence_complete'],
  ['unknown citation', (input) => { input.snapshot.claims[0]!.evidenceIds = ['SCREEN-404']; }, 'citations_known'],
  ['uncited observed claim', (input) => { input.snapshot.claims[0]!.evidenceIds = []; }, 'observed_inferred_cited'],
  ['cache miss on repeated manifest', (input) => { input.repeatedManifest.cacheHits -= 1; }, 'repeated_manifest_cache'],
  ['untested lifecycle flag', (input) => { input.acceptance.auth = false; }, 'lifecycle_acceptance'],
  ['fewer than five reviewed Flows', (input) => { input.reviewedFlowIds.pop(); }, 'reviewed_flows'],
  ['unreviewed role projection', (input) => { input.reviewedRoles.pop(); }, 'role_projections_reviewed'],
];

for (const [label, mutate, failedGate] of cases) {
  test(`fails for ${label}`, () => {
    const input = fixture();
    mutate(input);
    const result = verifyAppKnowledgePilot(input);
    assert.equal(result.ok, false);
    assert.ok(result.failedGates.includes(failedGate), result.failedGates.join(', '));
  });
}
