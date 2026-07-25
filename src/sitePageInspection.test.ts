import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSiteAnalysis,
  classifyMotionSample,
  responsiveDifferences,
  type SiteViewportInspection,
} from "./sitePageInspection.ts";

test("classifies fixed-position time changes as continuous motion", () => {
  assert.equal(classifyMotionSample({
    scrollChanged: false,
    timeChanged: true,
    sticky: false,
    threeDimensional: false,
    properties: ["transform"],
  }), "continuous");
});

test("classifies matrix3d changes separately", () => {
  assert.equal(classifyMotionSample({
    scrollChanged: true,
    timeChanged: true,
    sticky: false,
    threeDimensional: true,
    properties: ["transform"],
  }), "three-dimensional");
});

test("records components removed on mobile", () => {
  assert.deepEqual(
    responsiveDifferences(
      [{ key: "#hero-video", visible: true, media: "video" }],
      [{ key: "#hero-video", visible: false, media: "video" }],
    ),
    [{ key: "#hero-video", change: "hidden-on-mobile" }],
  );
});

test("builds evidence-backed motion and technology findings", () => {
  const desktop = fixtureInspection("desktop");
  const analysis = buildSiteAnalysis(desktop);

  assert.equal(analysis.schemaVersion, 1);
  assert.equal(analysis.status, "evidence-only");
  assert.equal(analysis.motion[0]?.targetEvidenceId, "STRUCTURE-0");
  assert.equal(analysis.motion[0]?.type, "continuous");
  assert.equal(
    analysis.technology.find((item) => item.name === "CSS Keyframes")?.state,
    "observed-in-use",
  );
  assert.ok(
    analysis.motion.every((item) =>
      item.evidenceIds.every((id) =>
        analysis.evidence.some((evidence) => evidence.id === id)
      )
    ),
  );
});

function fixtureInspection(
  viewport: "desktop" | "mobile",
): SiteViewportInspection {
  return {
    viewport,
    width: viewport === "desktop" ? 1_440 : 390,
    height: viewport === "desktop" ? 900 : 844,
    document: { width: 1_440, height: 2_000 },
    structure: [{
      id: "STRUCTURE-0",
      key: "#loop",
      tag: "div",
      visible: true,
      order: 0,
    }],
    visualTokens: [{
      id: "VISUAL-0",
      structureId: "STRUCTURE-0",
      color: "rgb(0, 0, 0)",
    }],
    animationSamples: [{
      targetId: "STRUCTURE-0",
      key: "#loop",
      scrollChanged: false,
      timeChanged: true,
      sticky: false,
      threeDimensional: false,
      properties: ["transform"],
      states: [{ transform: "none" }, { transform: "matrix(1,0,0,1,10,0)" }],
      durationMs: 1_000,
      iterations: "infinite",
    }],
    technologySignals: {
      generator: [],
      htmlAttributes: {},
      scriptUrls: [],
      stylesheetUrls: [],
      resourceUrls: [],
      inlineScripts: ["@keyframes slide { to { transform: translateX(20px) } }"],
      sourceMapSources: [],
      runtimes: {},
      activeRuntimeSignals: ["css-keyframes:slide"],
    },
    mutations: { attributes: 0, childNodes: 0 },
    warnings: [],
  };
}
