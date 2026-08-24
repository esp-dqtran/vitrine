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

test("Vitrines UI element taxonomy contains 63 internal types", () => {
  assert.equal(UI_ELEMENT_TYPES.length, 63);
  assert.equal(new Set(UI_ELEMENT_TYPES.map(({ name }) => name)).size, 63);
  assert.ok(UI_ELEMENT_TYPES.some(({ name }) => name === "Logo Wall"));
  assert.ok(UI_ELEMENT_TYPES.some(({ name }) => name === "Hero Image"));
  assert.ok(UI_ELEMENT_TYPES.some(({ name }) => name === "Product Image"));
});

test("parses and orders valid UI element occurrences", () => {
  const result = parseUiElementExtraction({
    summary: "Authentication screen",
    components: [{
      type: "Button",
      layer: "whole-screen",
      variant: "Primary",
      purpose: "Continue authentication",
      anatomy: ["Label"],
      visibleStates: ["Enabled"],
      observedProperties: ["Orange fill"],
      region: { x: 0.1, y: 0.6, width: 0.8, height: 0.08 },
      confidence: 0.94,
    }, {
      type: "Logo",
      layer: "whole-screen",
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
  assert.ok(result.components.every(({ layer }) => layer === "whole-screen"));
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

test("canonicalizes reference-style UI element aliases", () => {
  const base = {
    variant: "Default",
    purpose: "Visible control",
    anatomy: [],
    observedProperties: [],
    confidence: 0.9,
  };
  const result = parseUiElementExtraction({
    summary: "Controls",
    components: [
      { ...base, type: "Accordion & Collapse", region: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 } },
      { ...base, type: "Switch & Toggle", region: { x: 0.1, y: 0.3, width: 0.2, height: 0.1 } },
      { ...base, type: "Navigation Bar", region: { x: 0, y: 0.5, width: 1, height: 0.1 } },
    ],
  });
  assert.deepEqual(result.components.map(({ type }) => type), [
    "Accordion",
    "Switch",
    "Top Navigation Bar",
  ]);
});

test("keeps nested candidates from different presentation layers", () => {
  const result = parseUiElementExtraction({
    summary: "Marketing composite",
    components: [{
      type: "Card",
      layer: "outer-presentation",
      variant: "Device frame",
      purpose: "Frame the promotion",
      anatomy: [],
      observedProperties: [],
      region: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      confidence: 0.9,
    }, {
      type: "Button",
      layer: "embedded-ui",
      variant: "Play",
      purpose: "Play an episode",
      anatomy: ["Label"],
      observedProperties: [],
      region: { x: 0.3, y: 0.6, width: 0.4, height: 0.08 },
      confidence: 0.9,
    }],
  });
  assert.deepEqual(result.components.map(({ layer }) => layer), [
    "outer-presentation",
    "embedded-ui",
  ]);
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
  assert.match(prompt, /sourcePresentation/);
  assert.match(prompt, /marketing composite/);
  assert.match(prompt, /pixel-grounded visible affordances/);
  assert.match(prompt, /confidence at 0\.90/);
  assert.match(prompt, /outer-presentation/);
  assert.match(prompt, /embedded-ui/);
  assert.doesNotMatch(prompt, /screenPatterns/);
  assert.doesNotMatch(prompt, /login: Login/);
  assert.match(prompt, /Control\n[\s\S]*- Button/);
  assert.match(prompt, /Overlay\n[\s\S]*- Dialog/);
  assert.match(prompt, /normalized/);
  assert.match(prompt, /tight crop/);
  assert.match(prompt, /parent-wins hierarchy/);
  assert.match(prompt, /repeated keypad keys remain one representative Keyboard Key/);
  assert.match(prompt, /Do not relabel repeated primitives/);
  assert.match(prompt, /exactly one supported Vitrines screen category/);
  assert.match(prompt, /Shop & Storefront/);
  assert.match(prompt, /isolated arrow[\s\S]*is an Icon, not a Button/);
  assert.match(prompt, /device frames are never Logos/);
  assert.match(prompt, /Settings & Preferences whenever the primary surface changes configuration/);
  assert.match(prompt, /Internal Tool only as a last-resort operational workspace/);
  assert.match(prompt, /Other Content is a last resort and must not replace Post Detail/);
  assert.match(prompt, /generation prompt[\s\S]*are Add & Create, not Media Editor/);
  assert.match(prompt, /freeform spatial workspace[\s\S]*is not a Canvas/);
  assert.match(prompt, /Keep pageType consistent across near-identical screens/);
});

test("parses screen analysis and exact screen-pattern assignments from the same response", () => {
  const result = parseUiElementScreenExtraction({
    summary: "Authentication screen",
    screenAnalysis: {
      description: "A login form with a primary action.",
      purpose: "Authenticate the user.",
      pageType: "Login",
      sourcePresentation: "direct-screen",
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
      layer: "whole-screen",
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
  assert.equal(result.components[0].layer, "whole-screen");
});

test("parses screen analysis and UI elements without UX patterns", () => {
  const result = parseUiElementScreenExtraction({
    summary: "Authentication screen",
    screenAnalysis: {
      description: "A login form with a primary action.",
      purpose: "Authenticate the user.",
      pageType: "Login",
      sourcePresentation: "direct-screen",
      productArea: "Account Management",
      theme: "light",
      visibleStates: ["Default"],
      componentNames: ["Button"],
      confidence: 0.95,
    },
    components: [{
      type: "Button",
      layer: "whole-screen",
      variant: "Primary",
      purpose: "Submit login",
      anatomy: ["Label"],
      observedProperties: [],
      region: { x: 0.1, y: 0.7, width: 0.8, height: 0.1 },
      confidence: 0.97,
    }],
  }, SCREEN_PATTERNS);

  assert.deepEqual(result.screenPatterns, []);
  assert.equal(result.screenAnalysis.pageType, "Login");
  assert.equal(result.components[0].type, "Button");
});

test("rejects invented screen categories and canonicalizes supported category casing", () => {
  const value = {
    summary: "Marketplace",
    screenAnalysis: {
      description: "A marketplace home screen.",
      purpose: "Browse products.",
      pageType: "Marketplace Home",
      sourcePresentation: "direct-screen",
      productArea: "Commerce",
      theme: "light",
      visibleStates: [],
      componentNames: [],
      confidence: 0.9,
    },
    components: [],
  };
  assert.throws(
    () => parseUiElementScreenExtraction(value, SCREEN_PATTERNS),
    /Unsupported Vitrines screen category: Marketplace Home/,
  );
  const result = parseUiElementScreenExtraction({
    ...value,
    screenAnalysis: { ...value.screenAnalysis, pageType: "shop & storefront" },
  }, SCREEN_PATTERNS);
  assert.equal(result.screenAnalysis.pageType, "Shop & Storefront");
});

test("enforces marketing-composite category, embedded category, and confidence", () => {
  const value = {
    summary: "Feature promotion",
    screenAnalysis: {
      description: "Promotional copy around a phone.",
      purpose: "Promote a feature.",
      pageType: "Feature Info",
      sourcePresentation: "marketing-composite",
      productArea: "News",
      theme: "mixed",
      visibleStates: [],
      componentNames: [],
      confidence: 0.88,
    },
    components: [],
  };
  assert.throws(
    () => parseUiElementScreenExtraction(value, SCREEN_PATTERNS),
    /require embeddedPageType/,
  );
  assert.throws(
    () => parseUiElementScreenExtraction({
      ...value,
      screenAnalysis: {
        ...value.screenAnalysis,
        embeddedPageType: "News Feed",
        confidence: 0.96,
      },
    }, SCREEN_PATTERNS),
    /confidence at or below 0.90/,
  );
});

test("requires explicit component layers for marketing composites", () => {
  const value = {
    summary: "Feature promotion",
    screenAnalysis: {
      description: "Promotional copy around a phone",
      purpose: "Promote a feature",
      pageType: "Feature Info",
      sourcePresentation: "marketing-composite",
      embeddedPageType: "News Feed",
      productArea: "News",
      theme: "mixed",
      visibleStates: [],
      componentNames: ["Button"],
      confidence: 0.88,
    },
    screenPatterns: [{ slug: "login", confidence: 0.8 }],
    components: [{
      type: "Button",
      variant: "Play",
      purpose: "Play content",
      anatomy: ["Label"],
      observedProperties: [],
      region: { x: 0.3, y: 0.7, width: 0.4, height: 0.08 },
      confidence: 0.9,
    }],
  };
  assert.throws(
    () => parseUiElementScreenExtraction(value, SCREEN_PATTERNS),
    /must identify their visual layer/,
  );
  const result = parseUiElementScreenExtraction({
    ...value,
    components: [{ ...value.components[0], layer: "embedded-ui" }],
  }, SCREEN_PATTERNS);
  assert.equal(result.components[0].layer, "embedded-ui");
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
