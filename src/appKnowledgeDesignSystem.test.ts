import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAppKnowledgeSnapshot,
  type AppKnowledgeCoverage,
  type AppKnowledgeDesignSystemResult,
} from "./appKnowledge.ts";
import {
  assembleDesignSystemSnapshot,
  planDesignSystemChunks,
  serializedDesignSystemChunkBytes,
} from "./appKnowledgeDesignSystem.ts";
import type { AppKnowledgeEvidenceAnalysis } from "./appKnowledgeService.ts";

function analysis(
  evidenceId: string,
  overrides: Partial<AppKnowledgeEvidenceAnalysis> = {},
): AppKnowledgeEvidenceAnalysis {
  return {
    evidenceId,
    pageType: "dashboard",
    productArea: "Performance Review",
    purpose: "Review performance",
    viewport: "desktop",
    visibleText: ["Review"],
    theme: "mixed",
    visualHierarchy: ["Sidebar", "Main content"],
    layoutPatterns: ["Sidebar shell"],
    contentPatterns: ["Metric cards"],
    imagery: [],
    icons: ["Navigation icons"],
    interactionPatterns: ["Tabbed navigation"],
    visibleStates: ["Selected navigation item"],
    availableActions: ["Open review"],
    systemFeedback: [],
    accessibilityObservations: ["Visible labels"],
    likelyIntent: "Review performance",
    friction: [],
    uncertainStates: [],
    confidence: 0.9,
    tokenCandidates: [],
    componentOccurrences: [],
    ...overrides,
  };
}

function coverage(total: number): AppKnowledgeCoverage {
  const kind = { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 };
  return {
    total,
    eligible: total,
    analyzed: total,
    cached: 0,
    quarantined: 0,
    skipped: 0,
    failed: 0,
    duplicateVisuals: 0,
    byKind: {
      screen: { ...kind, total, eligible: total, analyzed: total },
      flow_step: { ...kind },
      ui_element: { ...kind },
    },
    flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
  };
}

function designSystem(evidenceId: string): AppKnowledgeDesignSystemResult {
  const claim = {
    id: "language-layout-sidebar",
    kind: "observed" as const,
    text: "A persistent sidebar frames the main content.",
    evidenceIds: [evidenceId],
    confidence: 0.9,
  };
  return {
    componentCandidates: [{
      id: "component-sidebar",
      name: "Sidebar",
      category: "navigation",
      purpose: "Navigate product areas",
      anatomy: ["Brand", "Navigation items"],
      observedProperties: ["Persistent left placement"],
      variants: [],
      states: ["Selected"],
      responsiveEvidence: [],
      evidenceIds: [evidenceId],
      visualRegions: ["Left rail"],
      designLanguageCandidateIds: [claim.id],
      claims: [],
      confidence: 0.9,
      status: "candidate",
    }],
    designLanguage: {
      color: [],
      typography: [],
      spacing: [],
      radius: [],
      border: [],
      effects: [],
      layout: [claim],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
  };
}

test("plans deterministic byte-bounded chunks from unique screen analyses", () => {
  const analyses = Array.from({ length: 610 }, (_, index) =>
    analysis(`SCREEN-${index + 1}`, {
      productArea: index % 2 ? "Performance Review" : "Home",
      pageType: index % 3 ? "dashboard" : "settings_page",
    }));

  const first = planDesignSystemChunks(analyses, 24_000);
  const second = planDesignSystemChunks([...analyses].reverse(), 24_000);

  assert.deepEqual(first, second);
  assert.equal(first.flatMap(({ signals }) => signals).length, 610);
  assert.ok(first.every((chunk) => serializedDesignSystemChunkBytes(chunk) <= 24_000));
  assert.ok(first.every(({ key }) => /^[0-9a-f]{64}$/.test(key)));
});

test("rejects a compact signal larger than the provider byte ceiling", () => {
  const oversized = analysis("SCREEN-1", {
    layoutPatterns: ["x".repeat(30_000)],
  });
  assert.throws(
    () => planDesignSystemChunks([oversized], 10_000),
    /design-system signal exceeds/i,
  );
});

test("assembles a valid design-system-first snapshot with more than 500 screens", () => {
  const analyses = Array.from({ length: 610 }, (_, index) =>
    analysis(`SCREEN-${index + 1}`));
  const snapshot = assembleDesignSystemSnapshot({
    identity: {
      app: "15five",
      platform: "web",
      captureVersionId: 1654,
      sourceSha256: "a".repeat(64),
      providerModel: "gemini-3.6-flash-high",
      promptVersion: 1,
    },
    coverage: coverage(610),
    analyses,
    result: designSystem("SCREEN-1"),
    generatedAt: "2026-07-24T00:00:00.000Z",
  });

  assert.equal(snapshot.screens.length, 610);
  assert.equal(snapshot.flows.length, 0);
  assert.equal(snapshot.productKnowledge.capabilities.length, 1);
  assert.equal(snapshot.componentCandidates[0].status, "candidate");
  assert.doesNotThrow(() =>
    parseAppKnowledgeSnapshot(
      snapshot,
      new Set(analyses.map(({ evidenceId }) => evidenceId)),
    ));
});
