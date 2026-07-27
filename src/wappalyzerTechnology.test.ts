import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeWappalyzerTechnology,
  normalizeWappalyzerTechnology,
} from "./wappalyzerTechnology.ts";
import type { SiteTechnologyFinding } from "./siteAnalysis.ts";

test("normalizes Wappalyzer detections with icons, categories, and confidence", () => {
  const result = normalizeWappalyzerTechnology([{
    name: "Next.js",
    slug: "next-js",
    categories: [{ id: 18, slug: "web-frameworks", name: "Web frameworks" }],
    confidence: 100,
    version: "15.4.2",
    icon: "Next.js.svg",
  }]);

  assert.deepEqual(result, [{
    id: "TECHNOLOGY-WAPPALYZER-NEXT-JS",
    name: "Next.js",
    slug: "next-js",
    categories: ["Web frameworks"],
    icon: "Next.js.svg",
    source: "wappalyzer",
    version: "15.4.2",
    category: "framework",
    state: "confirmed",
    evidenceIds: [],
    confidence: 1,
  }]);
});

test("rejects malformed detections instead of retaining unsafe icon data", () => {
  assert.throws(
    () => normalizeWappalyzerTechnology([{
      name: "React",
      slug: "react",
      categories: [{ name: "JavaScript libraries" }],
      confidence: 100,
      icon: "../React.svg",
    }]),
    /icon/i,
  );
});

test("merges duplicate Wappalyzer results over native findings", () => {
  const native: SiteTechnologyFinding[] = [{
    id: "TECHNOLOGY-1",
    name: "Next.js",
    category: "framework",
    state: "observed-in-use",
    evidenceIds: ["TECH-1"],
    confidence: 0.85,
  }, {
    id: "TECHNOLOGY-2",
    name: "CSS Keyframes",
    category: "animation",
    state: "observed-in-use",
    evidenceIds: ["TECH-2"],
    confidence: 0.99,
  }];
  const detected = normalizeWappalyzerTechnology([{
    name: "Next.js",
    slug: "next-js",
    categories: [{ name: "Web frameworks" }],
    confidence: 100,
    icon: "Next.js.svg",
  }]);

  const result = mergeWappalyzerTechnology(native, detected);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    ...detected[0],
    evidenceIds: ["TECH-1"],
  });
  assert.equal(result[1]?.name, "CSS Keyframes");
  assert.equal(result[1]?.source, "native");
});

