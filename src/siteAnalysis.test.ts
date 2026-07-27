import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSiteAnalysis,
  siteEvidenceId,
  type SiteAnalysis,
} from "./siteAnalysis.ts";

const fixture: SiteAnalysis = {
  schemaVersion: 1,
  status: "ready",
  evidence: [{ id: "TECH-1", kind: "script-url", value: "motion.mjs" }],
  structure: [],
  visualTokens: [],
  motion: [],
  technology: [{
    id: "TECHNOLOGY-1",
    name: "Framer Motion",
    category: "animation",
    state: "confirmed",
    evidenceIds: ["TECH-1"],
    confidence: 1,
  }],
  responsive: [],
  synthesis: null,
  warnings: [],
};

test("parses evidence-backed Site analysis", () => {
  assert.deepEqual(parseSiteAnalysis(fixture), fixture);
  assert.equal(siteEvidenceId("technology", 7), "TECHNOLOGY-7");
});

test("parses Wappalyzer technology metadata in schema version 2", () => {
  const parsed = parseSiteAnalysis({
    ...fixture,
    schemaVersion: 2,
    technology: [{
      id: "TECHNOLOGY-WAPPALYZER-NEXT-JS",
      name: "Next.js",
      slug: "next-js",
      categories: ["Web frameworks"],
      icon: "Next.js.svg",
      source: "wappalyzer",
      category: "framework",
      state: "confirmed",
      evidenceIds: [],
      confidence: 1,
    }],
  });

  assert.equal(parsed.schemaVersion, 2);
  assert.deepEqual(parsed.technology[0], {
    id: "TECHNOLOGY-WAPPALYZER-NEXT-JS",
    name: "Next.js",
    slug: "next-js",
    categories: ["Web frameworks"],
    icon: "Next.js.svg",
    source: "wappalyzer",
    category: "framework",
    state: "confirmed",
    evidenceIds: [],
    confidence: 1,
  });
});

test("rejects unsafe Wappalyzer icon filenames", () => {
  for (const icon of [
    "../Next.js.svg",
    "https://example.com/icon.svg",
    "folder/icon.svg",
    "icon\u0000.svg",
  ]) {
    assert.throws(
      () => parseSiteAnalysis({
        ...fixture,
        schemaVersion: 2,
        technology: [{
          ...fixture.technology[0],
          slug: "next-js",
          categories: ["Web frameworks"],
          icon,
          source: "wappalyzer",
        }],
      }),
      /icon/i,
    );
  }
});

test("rejects findings that invent evidence IDs", () => {
  assert.throws(
    () => parseSiteAnalysis({
      ...fixture,
      technology: [{ ...fixture.technology[0], evidenceIds: ["MISSING-1"] }],
    }),
    /evidence/i,
  );
});

test("rejects motion targets that are absent from structure evidence", () => {
  assert.throws(
    () => parseSiteAnalysis({
      ...fixture,
      motion: [{
        id: "MOTION-1",
        targetEvidenceId: "STRUCTURE-404",
        type: "continuous",
        trigger: "time",
        properties: ["transform"],
        states: [],
        viewports: ["desktop"],
        evidenceIds: ["TECH-1"],
        confidence: 0.8,
      }],
    }),
    /target evidence/i,
  );
});

test("keeps loaded, observed, inferred, and not-detected states distinct", () => {
  for (const state of [
    "confirmed",
    "observed-in-use",
    "loaded",
    "inferred",
    "not-detected",
  ] as const) {
    assert.equal(parseSiteAnalysis({
      ...fixture,
      technology: [{ ...fixture.technology[0], state }],
    }).technology[0].state, state);
  }
});

test("rejects duplicate evidence IDs and unbounded confidence", () => {
  assert.throws(
    () => parseSiteAnalysis({
      ...fixture,
      evidence: [fixture.evidence[0], fixture.evidence[0]],
    }),
    /duplicate/i,
  );
  assert.throws(
    () => parseSiteAnalysis({
      ...fixture,
      technology: [{ ...fixture.technology[0], confidence: 1.1 }],
    }),
    /confidence/i,
  );
});
