import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAppResearchKnowledge,
  researchContextForFlow,
  researchPromptBlock,
} from "./research-knowledge.ts";

const fixture = () => parseAppResearchKnowledge({
  schemaVersion: 1,
  app: "example-shop",
  generatedAt: "2026-07-29T00:00:00.000Z",
  separationPolicy: {
    visualEvidenceAuthority: "Screenshots prove visible states only.",
    documentedContextAuthority: "Official sources prove only their stated scope.",
    conflictPolicy: "Keep both claims and record the conflict.",
  },
  sources: [{
    id: "official-catalog",
    title: "Catalog API",
    url: "https://example.com/catalog",
    publisher: "Example",
    retrievedAt: "2026-07-29T00:00:00.000Z",
    sourceType: "official-developer",
    scopeNote: "Backend domain reference, not proof of the mobile implementation.",
  }],
  claims: [{
    id: "catalog-attributes",
    sourceIds: ["official-catalog"],
    kind: "domain-reference",
    text: "Catalog records can expose product attributes and images.",
    topics: ["catalog", "product", "images"],
    platforms: ["all"],
    regions: ["global"],
    scopeNote: "Use to form questions about product data.",
  }],
});

test("validates sources and selects relevant documented context", () => {
  const context = researchContextForFlow(fixture(), {
    platform: "ios",
    title: "Product images",
    category: "Catalog",
  });
  assert.equal(context?.claims[0]?.id, "catalog-attributes");
  assert.equal(context?.claims[0]?.sources[0]?.url, "https://example.com/catalog");
});

test("keeps external research explicitly separate from screenshot evidence", () => {
  const context = researchContextForFlow(fixture(), {
    platform: "android",
    title: "Product detail",
  });
  const block = researchPromptBlock(context);
  assert.match(block, /not screenshot evidence/i);
  assert.match(block, /never assign screenshot evidence IDs/i);
  assert.match(block, /Backend domain reference/);
});

test("rejects claims that cite an unknown source", () => {
  assert.throws(() => parseAppResearchKnowledge({
    ...fixture(),
    sources: [],
  }), /unknown source/);
});
