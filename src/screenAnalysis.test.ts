import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScreenAnalysis } from "./screenAnalysis.ts";

test("normalizes a fenced structured screen analysis", () => {
  const analysis = parseScreenAnalysis(`\`\`\`json
  {
    "description": "A light login page with a centered form.",
    "purpose": "Authenticate an existing user",
    "pageType": "Login",
    "productArea": "Authentication",
    "theme": "light",
    "visibleStates": ["default", "default", "focused input"],
    "componentNames": ["Text input", "Primary button"],
    "visibleText": ["Welcome back"],
    "layoutPatterns": ["Centered form"],
    "icons": ["Brand mark"],
    "imagery": [],
    "contentPatterns": ["Helper text"],
    "interactionPatterns": ["Password reveal"],
    "responsiveViewport": "desktop",
    "confidence": 0.92
  }
  \`\`\``);

  assert.equal(analysis.pageType, "Login");
  assert.deepEqual(analysis.visibleStates, ["default", "focused input"]);
  assert.deepEqual(analysis.layoutPatterns, ["Centered form"]);
  assert.equal(analysis.responsiveViewport, "desktop");
  assert.equal(analysis.confidence, 0.92);
});

test("rejects unsupported theme values", () => {
  assert.throws(
    () => parseScreenAnalysis(JSON.stringify({
      description: "Screen",
      purpose: "Purpose",
      pageType: "Page",
      productArea: "Area",
      theme: "blue",
      visibleStates: [],
      componentNames: [],
    })),
    /Unsupported screen theme/,
  );
});

test("rejects prose replies", () => {
  assert.throws(() => parseScreenAnalysis("This is a login screen."), /valid JSON/);
});
