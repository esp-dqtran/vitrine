import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareReconciliationImport,
} from "./import-kiro-reconciliations.ts";
import type {
  PersistedKiroReconciliation,
  ResearchPacket,
  VisualArtifact,
} from "./kiro-reconciliation.ts";

const packet: ResearchPacket = {
  flow: {
    app: "example-shop",
    platform: "ios",
    flowId: "flow-1",
    title: "Checkout",
  },
  visualAnalysis: {
    artifact: "../json/flow-1.json",
    unknowns: ["Failure behavior is not shown."],
  },
  documentedContext: {
    claims: [{ id: "checkout", sourceIds: ["official-checkout"] }],
  },
};

const visual: VisualArtifact = {
  source: {
    flowId: "flow-1",
    evidence: [{ evidenceId: "S01" }],
  },
};

const saved = (): PersistedKiroReconciliation => ({
  schemaVersion: 1,
  generatedAt: "2026-07-29T00:00:00.000Z",
  provider: "kiro-cli",
  model: "gpt-5.6-terra",
  effort: "high",
  source: {
    researchPacket: "../research-context/flow-1.json",
    visualArtifact: "../json/flow-1.json",
  },
  usage: { credits: 0.5, elapsed: "2m" },
  reviewRecommendation: { solReview: true, reasons: ["critical-journey"] },
  result: {
    flowId: "flow-1",
    modelAssessment: { replicationValue: 7, summary: "Useful evidence." },
    claimReconciliation: [{
      claimId: "checkout",
      classification: "supports",
      reason: "Visible checkout aligns with the documented sequence.",
      visualEvidenceIds: ["S01"],
      sourceIds: ["official-checkout"],
      unresolved: true,
    }],
    implementationKnowledge: {
      observedMustBuild: ["Checkout"],
      documentedBackendContext: ["Payment lifecycle"],
      doNotInfer: ["Failures"],
    },
    risks: [{ severity: "high", text: "Failure behavior is absent.", basis: "gap" }],
    qualityChecks: {
      allClaimsClassified: true,
      visualAndDocumentedSeparated: true,
      unknownsPreserved: true,
    },
  },
});

test("prepares stable hashes for a validated reconciliation", () => {
  const first = prepareReconciliationImport(
    saved(),
    JSON.stringify(packet),
    JSON.stringify(visual),
  );
  const second = prepareReconciliationImport(
    saved(),
    JSON.stringify(packet),
    JSON.stringify(visual),
  );
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.match(first.sourceFingerprint, /^[0-9a-f]{64}$/);
  assert.match(first.visualAnalysisSha256, /^[0-9a-f]{64}$/);
  assert.match(first.researchContextSha256, /^[0-9a-f]{64}$/);
  assert.match(first.resultSha256, /^[0-9a-f]{64}$/);
});

test("changes the fingerprint when the validated result changes", () => {
  const first = prepareReconciliationImport(
    saved(),
    JSON.stringify(packet),
    JSON.stringify(visual),
  );
  const changed = saved();
  changed.result.modelAssessment.replicationValue = 8;
  const second = prepareReconciliationImport(
    changed,
    JSON.stringify(packet),
    JSON.stringify(visual),
  );
  assert.notEqual(first.sourceFingerprint, second.sourceFingerprint);
});

test("rejects an envelope whose visual reference does not match", () => {
  const invalid = saved();
  invalid.source.visualArtifact = "../json/other.json";
  assert.throws(
    () => prepareReconciliationImport(
      invalid,
      JSON.stringify(packet),
      JSON.stringify(visual),
    ),
    /visual artifact reference does not match/,
  );
});
