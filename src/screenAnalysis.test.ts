import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScreenAnalysis } from "./screenAnalysis.ts";

test("normalizes a fenced structured screen analysis", () => {
  const analysis = parseScreenAnalysis(`\`\`\`json
  {
    "description": "A light login page with a centered form.",
    "purpose": "Authenticate an existing user",
    "pageType": "Login",
    "sourcePresentation": "direct-screen",
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
  assert.equal(analysis.sourcePresentation, "direct-screen");
  assert.deepEqual(analysis.visibleStates, ["default", "focused input"]);
  assert.deepEqual(analysis.layoutPatterns, ["Centered form"]);
  assert.equal(analysis.responsiveViewport, "desktop");
  assert.equal(analysis.confidence, 0.92);
});

test("preserves layered classification for a marketing composite", () => {
  const analysis = parseScreenAnalysis(JSON.stringify({
    description: "Promotional copy surrounds a phone showing a news feed.",
    purpose: "Explain a news feature",
    pageType: "Feature Info",
    sourcePresentation: "marketing-composite",
    embeddedPageType: "News Feed",
    productArea: "News",
    theme: "mixed",
    visibleStates: [],
    componentNames: ["Device Mockup"],
    confidence: 0.84,
  }));

  assert.equal(analysis.sourcePresentation, "marketing-composite");
  assert.equal(analysis.embeddedPageType, "News Feed");
});

test("defaults legacy analysis presentation to unknown", () => {
  const analysis = parseScreenAnalysis(JSON.stringify({
    description: "Screen",
    purpose: "Purpose",
    pageType: "Misc",
    productArea: "Area",
    theme: "light",
    visibleStates: [],
    componentNames: [],
  }));

  assert.equal(analysis.sourcePresentation, "unknown");
});

test("rejects unsupported source presentation values", () => {
  assert.throws(
    () => parseScreenAnalysis(JSON.stringify({
      description: "Screen",
      purpose: "Purpose",
      pageType: "Misc",
      sourcePresentation: "app-store-image",
      productArea: "Area",
      theme: "light",
      visibleStates: [],
      componentNames: [],
    })),
    /Unsupported source presentation/,
  );
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
