import assert from 'node:assert/strict';
import test from 'node:test';
import {
  verifyAppKnowledgePilot,
  type PilotVerifierInput,
} from './verify-app-knowledge-pilot.ts';

function fixture(): PilotVerifierInput {
  return {
    captureVersion: 7,
    completedAutomaticJobs: 1,
    sourceHashDrift: 0,
    quarantinedUiElementsBefore: 610,
    quarantinedUiElementsAfter: 610,
    protectedSnapshotOverwrites: 0,
    designSystemSeedOutcome: 'seeded',
    tokens: [{
      id: 'token-color-action',
      evidence: [11],
      confidence: 0.94,
      source: 'llm_inferred',
      reviewStatus: 'needs_review',
    }],
    components: [{
      id: 'component-button',
      evidence: [11],
      confidence: 0.9,
      status: 'candidate',
      variants: [{
        id: 'variant-primary',
        evidence: [11],
        confidence: 0.91,
        source: 'llm_inferred',
        reviewStatus: 'needs_review',
        occurrences: [{
          imageId: 11,
          region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          coordinateSpace: 'normalized',
          cropImageId: 211,
        }],
      }],
    }],
    rules: [{
      id: 'rule-spacing',
      evidence: [11],
      confidence: 0.87,
      source: 'llm_inferred',
      reviewStatus: 'needs_review',
    }],
    crops: [{
      derivedImageId: 211,
      sourceImageId: 11,
      region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      metadataVerified: true,
    }],
    flows: [{
      id: 'flow-onboarding',
      steps: [
        { order: 0, interaction: 'Click continue', evidence: [11] },
        { order: 1, interaction: 'Submit profile', evidence: [12] },
      ],
    }],
    crawledFlows: [{
      id: 'flow-onboarding',
      steps: [
        { order: 0, interaction: 'Click continue', evidence: [11] },
        { order: 1, interaction: 'Submit profile', evidence: [12] },
      ],
    }],
  };
}

test('passes a bounded evidence-backed automatic design-system pilot', () => {
  const result = verifyAppKnowledgePilot(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.failedGates, []);
  assert.deepEqual(result.summary, {
    captureVersion: 7,
    completedAutomaticJobs: 1,
    sourceHashDrift: 0,
    tokens: 1,
    components: 1,
    variants: 1,
    rules: 1,
    regions: 1,
    verifiedCrops: 1,
    flows: 1,
    flowSteps: 2,
    quarantinedUiElements: 610,
    protectedSnapshotOverwrites: 0,
  });
});

const cases: Array<[string, (input: PilotVerifierInput) => void, string]> = [
  ['missing completed automatic job', (input) => {
    input.completedAutomaticJobs = 0;
  }, 'completed_automatic_job'],
  ['duplicate completed automatic identity', (input) => {
    input.completedAutomaticJobs = 2;
  }, 'completed_automatic_job'],
  ['source hash drift', (input) => {
    input.sourceHashDrift = 1;
  }, 'source_hash_drift'],
  ['missing token', (input) => {
    input.tokens = [];
  }, 'generated_entities_present'],
  ['uncited token', (input) => {
    input.tokens[0]!.evidence = [];
  }, 'generated_entity_provenance'],
  ['trusted generated rule', (input) => {
    input.rules[0]!.reviewStatus = 'reviewed' as never;
  }, 'generated_entity_provenance'],
  ['invalid confidence', (input) => {
    input.components[0]!.variants[0]!.confidence = 2;
  }, 'generated_entity_provenance'],
  ['unbounded region', (input) => {
    const region = input.components[0]!.variants[0]!.occurrences[0]!.region;
    assert.ok(region);
    region.x = 0.8;
    region.width = 0.3;
  }, 'normalized_regions'],
  ['non-normalized coordinate space', (input) => {
    input.components[0]!.variants[0]!.occurrences[0]!.coordinateSpace = 'pixels' as never;
  }, 'normalized_regions'],
  ['unverified crop metadata', (input) => {
    input.crops[0]!.metadataVerified = false;
  }, 'verified_crop_metadata'],
  ['missing crop reference', (input) => {
    input.components[0]!.variants[0]!.occurrences[0]!.cropImageId = 999;
  }, 'verified_crop_metadata'],
  ['mutated flow order', (input) => {
    input.flows[0]!.steps.reverse();
  }, 'raw_flows_preserved'],
  ['mutated flow interaction', (input) => {
    input.flows[0]!.steps[0]!.interaction = 'Different action';
  }, 'raw_flows_preserved'],
  ['mutated flow evidence', (input) => {
    input.flows[0]!.steps[0]!.evidence = [999];
  }, 'raw_flows_preserved'],
  ['changed quarantine count', (input) => {
    input.quarantinedUiElementsAfter -= 1;
  }, 'ui_element_quarantine'],
  ['protected snapshot overwrite', (input) => {
    input.protectedSnapshotOverwrites = 1;
  }, 'protected_snapshots'],
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
