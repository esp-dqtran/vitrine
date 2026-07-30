import assert from "node:assert/strict";
import test from "node:test";
import {
  extractKiroJson,
  validateKiroReconciliation,
  type KiroReconciliationResult,
  type ResearchPacket,
  type VisualArtifact,
} from "./kiro-reconciliation.ts";

const packet: ResearchPacket = {
  flow: {
    app: "example-shop",
    platform: "ios",
    flowId: "flow-1",
    title: "Checkout",
  },
  visualAnalysis: {
    artifact: "../json/checkout.json",
    unknowns: ["Failure behavior is not shown."],
  },
  documentedContext: {
    claims: [{ id: "checkout-reference", sourceIds: ["official-checkout"] }],
  },
};

const visual: VisualArtifact = {
  source: {
    flowId: "flow-1",
    evidence: [{ evidenceId: "S01" }, { evidenceId: "S02" }],
  },
};

const result = (): KiroReconciliationResult => ({
  flowId: "flow-1",
  modelAssessment: { replicationValue: 7, summary: "Useful happy-path evidence." },
  claimReconciliation: [{
    claimId: "checkout-reference",
    classification: "supports",
    reason: "The visible steps align without proving the backend.",
    visualEvidenceIds: ["S01", "S02"],
    sourceIds: ["official-checkout"],
    unresolved: true,
  }],
  implementationKnowledge: {
    observedMustBuild: ["Checkout review"],
    documentedBackendContext: ["Payment lifecycle"],
    doNotInfer: ["Failure handling"],
  },
  risks: [{ severity: "high", text: "Failure behavior is absent.", basis: "gap" }],
  qualityChecks: {
    allClaimsClassified: true,
    visualAndDocumentedSeparated: true,
    unknownsPreserved: true,
  },
});

test("extracts the final reconciliation object from ANSI Kiro output", () => {
  const output = [
    "\u001B[?25lTODO: reading files\u001B[0m",
    `> ${JSON.stringify(result())}`,
    "[Tool uses: none]",
    "Credits: 1.10",
  ].join("\n");
  assert.deepEqual(extractKiroJson(output), result());
});

test("repairs missing trailing JSON containers before validation", () => {
  const truncated = JSON.stringify(result()).slice(0, -1);
  assert.deepEqual(
    extractKiroJson(`${truncated}\n[Tool uses: none]`),
    result(),
  );
});

test("repairs Kiro nesting risks under implementationKnowledge", () => {
  const malformed = JSON.stringify(result()).replace(
    "},\"risks\":",
    ",\"risks\":",
  );
  assert.deepEqual(
    extractKiroJson(`${malformed}\n[Tool uses: none]`),
    result(),
  );
});

test("validates complete claim and evidence coverage", () => {
  assert.deepEqual(validateKiroReconciliation(result(), packet, visual), result());
});

test("rejects foreign evidence IDs", () => {
  const invalid = result();
  invalid.claimReconciliation[0].visualEvidenceIds = ["S99"];
  assert.throws(
    () => validateKiroReconciliation(invalid, packet, visual),
    /Unknown visual evidence ID S99/,
  );
});

test("rejects missing documented claims", () => {
  const invalid = result();
  invalid.claimReconciliation = [];
  assert.throws(
    () => validateKiroReconciliation(invalid, packet, visual),
    /Every documented claim must be classified exactly once/,
  );
});
