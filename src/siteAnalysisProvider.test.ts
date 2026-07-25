import assert from "node:assert/strict";
import test from "node:test";
import type { MultimodalJsonProvider } from "./evidenceAnalysisProvider.ts";
import {
  analyzeSiteEvidence,
  siteAnalysisProviderFromMultimodal,
  type SiteAnalysisProvider,
} from "./siteAnalysisProvider.ts";

test("accepts only synthesis claims that cite supplied evidence", async () => {
  const provider: SiteAnalysisProvider = {
    model: "fixture",
    analyze: async () => synthesis({
      kind: "observed",
      text: "Uses motion",
      evidenceIds: ["TECH-1"],
      confidence: 1,
    }),
  };
  const result = await analyzeSiteEvidence(provider, {
    evidenceIds: ["TECH-1"],
    evidence: { technology: [] },
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  });
  assert.equal(result.claims[0]?.evidenceIds[0], "TECH-1");
});

test("rejects invented provider evidence IDs", async () => {
  const provider: SiteAnalysisProvider = {
    model: "fixture",
    analyze: async () => synthesis({
      kind: "inferred",
      text: "Invented",
      evidenceIds: ["NOPE-1"],
      confidence: 0.5,
    }),
  };
  await assert.rejects(() => analyzeSiteEvidence(provider, {
    evidenceIds: ["TECH-1"],
    evidence: {},
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  }), /evidence/i);
});

test("requires citations for observed and inferred claims", async () => {
  const provider: SiteAnalysisProvider = {
    model: "fixture",
    analyze: async () => synthesis({
      kind: "observed",
      text: "Unsupported",
      evidenceIds: [],
      confidence: 0.5,
    }),
  };
  await assert.rejects(() => analyzeSiteEvidence(provider, {
    evidenceIds: ["TECH-1"],
    evidence: {},
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  }), /requires evidence/i);
});

test("multimodal adapter sends bounded evidence and strict synthesis instructions", async () => {
  let request: Parameters<MultimodalJsonProvider["completeJson"]>[0] | undefined;
  const multimodal: MultimodalJsonProvider = {
    model: "vision-fixture",
    async completeJson(input) {
      request = input;
      return synthesis({
        kind: "unknown",
        text: "Hover behavior was not activated",
        evidenceIds: [],
        confidence: 0,
      });
    },
  };
  const provider = siteAnalysisProviderFromMultimodal(multimodal);
  await analyzeSiteEvidence(provider, {
    evidenceIds: ["STRUCTURE-1"],
    evidence: { structure: [{ id: "STRUCTURE-1" }] },
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  });

  assert.equal(provider.model, "vision-fixture");
  assert.match(request?.system ?? "", /JSON only/i);
  assert.match(request?.system ?? "", /Never invent an evidence ID/i);
  assert.match(request?.system ?? "", /exact original design tokens/i);
  assert.deepEqual(
    (request?.text as { evidenceIds?: unknown }).evidenceIds,
    ["STRUCTURE-1"],
  );
});

function synthesis(claim: {
  kind: "observed" | "inferred" | "unknown";
  text: string;
  evidenceIds: string[];
  confidence: number;
}) {
  return {
    purpose: "Website builder",
    category: "Design tool",
    structure: [],
    rendering: [],
    motion: [],
    technology: [],
    responsive: [],
    reconstructionPriorities: [],
    unknowns: [],
    claims: [claim],
  };
}
