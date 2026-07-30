import assert from "node:assert/strict";
import test from "node:test";
import {
  UI_ELEMENT_TYPES,
  buildUiElementExtractionPrompt,
  parseUiElementExtraction,
  parseUiElementScreenExtraction,
} from "./uiElementExtraction.ts";

const SCREEN_PATTERNS = [
  { slug: "login", name: "Login", section: "Account Management" },
  { slug: "verification", name: "Verification", section: "New User Experience" },
];

test("Mobbin UI element taxonomy contains 60 internal types", () => {
  assert.equal(UI_ELEMENT_TYPES.length, 60);
  assert.equal(new Set(UI_ELEMENT_TYPES.map(({ name }) => name)).size, 60);
});

test("parses and orders valid UI element occurrences", () => {
  const result = parseUiElementExtraction({
    summary: "Authentication screen",
    components: [{
      type: "Button",
      variant: "Primary",
      purpose: "Continue authentication",
      anatomy: ["Label"],
      visibleStates: ["Enabled"],
      observedProperties: ["Orange fill"],
      region: { x: 0.1, y: 0.6, width: 0.8, height: 0.08 },
      confidence: 0.94,
    }, {
      type: "Logo",
      variant: "Brand mark",
      purpose: "Identify the app",
      anatomy: [],
      visibleStates: [],
      observedProperties: ["Orange mark"],
      region: { x: 0.4, y: 0.2, width: 0.2, height: 0.12 },
      confidence: 0.9,
    }],
  });
  assert.deepEqual(result.components.map(({ type }) => type), ["Logo", "Button"]);
});

test("rejects unsupported taxonomy values and out-of-bounds regions", () => {
  const base = {
    summary: "A screen",
    components: [{
      type: "Made Up Control",
      variant: "Default",
      purpose: "Nothing",
      anatomy: [],
      visibleStates: [],
      observedProperties: [],
      region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      confidence: 0.9,
    }],
  };
  assert.throws(() => parseUiElementExtraction(base), /Unsupported UI element type/);
  assert.throws(() => parseUiElementExtraction({
    ...base,
    components: [{ ...base.components[0], type: "Button", region: {
      x: 0.9, y: 0.1, width: 0.2, height: 0.2,
    } }],
  }), /stay inside/);
});

test("drops low-confidence and overlapping duplicate detections", () => {
  const component = {
    type: "Button",
    variant: "Primary",
    purpose: "Continue",
    anatomy: [],
    visibleStates: [],
    observedProperties: [],
    region: { x: 0.1, y: 0.1, width: 0.4, height: 0.1 },
    confidence: 0.95,
  };
  const result = parseUiElementExtraction({
    summary: "A screen",
    components: [
      component,
      { ...component, confidence: 0.8 },
      { ...component, region: { x: 0.1, y: 0.4, width: 0.4, height: 0.1 }, confidence: 0.4 },
    ],
  });
  assert.equal(result.components.length, 1);
});

test("canonicalizes a taxonomy group prefix returned by the model", () => {
  const result = parseUiElementExtraction({
    summary: "Promotional splash",
    components: [{
      type: "Imagery: Illustration",
      variant: "Promotional",
      purpose: "Explain an offer",
      anatomy: ["Headline"],
      visibleStates: [],
      observedProperties: ["Orange background"],
      region: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
      confidence: 0.9,
    }],
  });
  assert.equal(result.components[0].type, "Illustration");
});

test("canonicalizes a check-in-circle misclassified as Status Dot to Icon", () => {
  const result = parseUiElementExtraction({
    summary: "Successful transfer",
    components: [{
      type: "Status Dot",
      variant: "Success check",
      purpose: "Communicates completion",
      anatomy: ["Green circle", "White checkmark"],
      visibleStates: ["Success"],
      observedProperties: ["Large", "Centered"],
      region: { x: 0.4, y: 0.1, width: 0.2, height: 0.1 },
      confidence: 0.98,
    }],
  });
  assert.equal(result.components[0].type, "Icon");
});

test("an open dialog excludes both dimmed background and nested primitive components", () => {
  const result = parseUiElementExtraction({
    summary: "Login with a confirmation dialog",
    components: [{
      type: "Top Navigation Bar",
      variant: "Default",
      purpose: "Navigate",
      anatomy: [],
      visibleStates: ["Dimmed"],
      observedProperties: [],
      region: { x: 0, y: 0.05, width: 1, height: 0.08 },
      confidence: 0.98,
    }, {
      type: "Dialog",
      variant: "Confirmation",
      purpose: "Confirm sign up",
      anatomy: ["Title", "Body", "Actions"],
      visibleStates: ["Open"],
      observedProperties: [],
      region: { x: 0.08, y: 0.38, width: 0.84, height: 0.3 },
      confidence: 0.99,
    }, {
      type: "Button",
      variant: "Dialog action",
      purpose: "Agree",
      anatomy: ["Label"],
      visibleStates: ["Enabled"],
      observedProperties: [],
      region: { x: 0.65, y: 0.61, width: 0.2, height: 0.05 },
      confidence: 0.96,
    }, {
      type: "Button",
      variant: "Social login",
      purpose: "Continue with Apple",
      anatomy: ["Icon", "Label"],
      visibleStates: ["Dimmed"],
      observedProperties: [],
      region: { x: 0.08, y: 0.8, width: 0.84, height: 0.06 },
      confidence: 0.97,
    }],
  });
  assert.deepEqual(result.components.map(({ type, variant }) => [type, variant]), [
    ["Dialog", "Confirmation"],
  ]);
});

test("keeps one representative keypad key without changing its taxonomy type", () => {
  const key = (variant: string, x: number, y: number) => ({
    type: "Keyboard Key",
    variant,
    purpose: "Enter a digit",
    anatomy: ["Digit"],
    visibleStates: ["Enabled"],
    observedProperties: ["Rounded key"],
    region: { x, y, width: 0.2, height: 0.06 },
    confidence: 0.97,
  });
  const result = parseUiElementExtraction({
    summary: "Verification keypad",
    components: [
      key("1", 0.1, 0.7),
      key("2", 0.4, 0.7),
      key("3", 0.7, 0.7),
      key("0", 0.4, 0.9),
    ],
  });
  assert.deepEqual(result.components.map(({ type, variant }) => [type, variant]), [
    ["Keyboard Key", "1"],
  ]);
  assert.deepEqual(result.components[0].region, {
    x: 0.1,
    y: 0.7,
    width: 0.2,
    height: 0.06,
  });
});

test("collapses a repeated vertical button series but keeps a separated primary action", () => {
  const button = (variant: string, y: number) => ({
    type: "Button",
    variant,
    purpose: "Continue",
    anatomy: ["Icon", "Label"],
    visibleStates: ["Enabled"],
    observedProperties: ["Outlined"],
    region: { x: 0.08, y, width: 0.84, height: 0.055 },
    confidence: 0.96,
  });
  const result = parseUiElementExtraction({
    summary: "Login choices",
    components: [
      button("Primary", 0.35),
      button("Google", 0.6),
      button("Facebook", 0.67),
      button("WhatsApp", 0.74),
      button("Apple", 0.81),
    ],
  });
  assert.deepEqual(result.components.map(({ type, variant }) => [type, variant]), [
    ["Button", "Primary"],
    ["Button", "Google"],
  ]);
});

test("prompt requires exact taxonomy and normalized tight crops", () => {
  const prompt = buildUiElementExtractionPrompt("iOS", SCREEN_PATTERNS);
  assert.match(prompt, /screenAnalysis/);
  assert.match(prompt, /screenPatterns/);
  assert.match(prompt, /login: Login/);
  assert.match(prompt, /Control\n[\s\S]*- Button/);
  assert.match(prompt, /Overlay\n[\s\S]*- Dialog/);
  assert.match(prompt, /normalized/);
  assert.match(prompt, /tight crop/);
  assert.match(prompt, /parent-wins hierarchy/);
  assert.match(prompt, /repeated keypad keys remain one representative Keyboard Key/);
  assert.match(prompt, /Do not relabel repeated primitives/);
});

test("parses screen analysis and exact screen-pattern assignments from the same response", () => {
  const result = parseUiElementScreenExtraction({
    summary: "Authentication screen",
    screenAnalysis: {
      description: "A login form with a primary action.",
      purpose: "Authenticate the user.",
      pageType: "Login",
      productArea: "Account Management",
      theme: "light",
      visibleStates: ["Default"],
      componentNames: ["Text Field", "Button"],
      visibleText: ["Log in"],
      layoutPatterns: ["Single column"],
      icons: [],
      imagery: ["Logo"],
      contentPatterns: ["Authentication form"],
      interactionPatterns: ["Form submission"],
      responsiveViewport: "mobile",
      confidence: 0.96,
    },
    screenPatterns: [{ slug: "login", confidence: 0.97 }],
    components: [{
      type: "Button",
      variant: "Primary",
      purpose: "Submit login",
      anatomy: ["Label"],
      visibleStates: ["Enabled"],
      observedProperties: ["Filled"],
      region: { x: 0.1, y: 0.7, width: 0.8, height: 0.08 },
      confidence: 0.94,
    }],
  }, SCREEN_PATTERNS);

  assert.equal(result.screenAnalysis.pageType, "Login");
  assert.deepEqual(result.screenPatterns, [{ slug: "login", confidence: 0.97 }]);
  assert.equal(result.components[0].type, "Button");
});

test("rejects screen-pattern slugs outside the configured taxonomy", () => {
  assert.throws(() => parseUiElementScreenExtraction({
    summary: "Unknown screen",
    screenAnalysis: {
      description: "A screen.",
      purpose: "Do something.",
      pageType: "Unknown",
      productArea: "Unknown",
      theme: "light",
      visibleStates: [],
      componentNames: [],
    },
    screenPatterns: [{ slug: "made-up", confidence: 0.9 }],
    components: [],
  }, SCREEN_PATTERNS), /Unsupported screen pattern slug/);
});
