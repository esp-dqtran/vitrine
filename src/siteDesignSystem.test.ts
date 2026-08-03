import assert from "node:assert/strict";
import test from "node:test";
import { createSiteDesignSystem, parseSiteDesignSystem } from "./siteDesignSystem.ts";

const analysis = {
  structure: [
    { id: "STRUCTURE-0", tag: "body", visible: true, text: "Example" },
    { id: "STRUCTURE-1", tag: "h1", visible: true, text: "Build better" },
    { id: "STRUCTURE-2", tag: "button", role: "button", visible: true, text: "Start now" },
  ],
  visualTokens: [
    {
      id: "VISUAL-0",
      structureId: "STRUCTURE-0",
      background: "rgb(12, 14, 18)",
      color: "rgb(242, 244, 248)",
      fontFamily: "Inter, sans-serif",
      fontSize: "16px",
      fontWeight: "400",
      lineHeight: "24px",
      padding: "0px 24px",
      customProperties: { "--brand-accent": "rgb(115, 92, 255)" },
    },
    {
      id: "VISUAL-1",
      structureId: "STRUCTURE-1",
      color: "rgb(242, 244, 248)",
      fontFamily: "Inter, sans-serif",
      fontSize: "64px",
      fontWeight: "700",
      lineHeight: "68px",
    },
    {
      id: "VISUAL-2",
      structureId: "STRUCTURE-2",
      background: "rgb(115, 92, 255)",
      color: "rgb(255, 255, 255)",
      fontFamily: "Inter, sans-serif",
      fontSize: "16px",
      fontWeight: "600",
      lineHeight: "24px",
      display: "inline-flex",
      flexDirection: "row",
      gap: "8px",
      padding: "12px 20px",
      borderRadius: "10px",
    },
  ],
  motion: [],
  responsive: [{ id: "RESPONSIVE-0", key: "nav", change: "hidden-on-mobile" }],
  synthesis: {
    purpose: "Help teams build better products.",
    category: "Developer tools",
    structure: ["A bold hero establishes the primary action."],
    rendering: [],
    motion: [],
    technology: [],
    responsive: [],
    reconstructionPriorities: [],
    unknowns: [],
    claims: [{
      kind: "observed" as const,
      text: "A bold hero establishes the primary action.",
      evidenceIds: ["STRUCTURE-1"],
      confidence: 0.9,
    }],
  },
};

test("turns rendered Site evidence into a Refero-style design system", () => {
  const system = createSiteDesignSystem({
    app: "Example",
    sourceUrl: "https://example.com/",
    generatedAt: "2026-08-03T00:00:00.000Z",
    analysis,
  });

  assert.equal(system.provenance?.provider, "vitrines");
  assert.equal(system.provenance?.theme, "dark");
  assert.match(system.summary ?? "", /rendered HTML and computed CSS/);
  assert.equal(system.provenance?.northStar, undefined);
  assert.ok(system.tokens.some((token) => token.kind === "color" && token.value === "rgb(115, 92, 255)"));
  assert.ok(system.tokens.some((token) => token.name.includes("--brand-accent")));
  assert.ok(system.tokens.some((token) => token.kind === "typography" && token.value.includes("64px")));
  assert.ok(system.tokens.some((token) => token.kind === "spacing" && token.value === "24px"));
  assert.ok(system.components.some((component) => component.name === "Button"));
  assert.ok(system.components.some((component) => component.name === "Heading"));
  assert.ok(system.rules?.some((rule) => rule.kind === "responsive"));
  assert.ok(system.rules?.some((rule) => rule.kind === "layout"));
});

test("keeps design-system extraction independent from image-based synthesis", () => {
  const first = createSiteDesignSystem({
    app: "Example",
    sourceUrl: "https://example.com/",
    generatedAt: "2026-08-03T00:00:00.000Z",
    analysis,
  });
  const changedSynthesis = structuredClone(analysis);
  changedSynthesis.synthesis.purpose = "A completely different image interpretation.";
  changedSynthesis.synthesis.category = "Unrelated category";
  changedSynthesis.synthesis.claims = [];
  const second = createSiteDesignSystem({
    app: "Example",
    sourceUrl: "https://example.com/",
    generatedAt: "2026-08-03T00:00:00.000Z",
    analysis: changedSynthesis,
  });

  assert.deepEqual(second, first);
});

test("rejects design-system evidence that was not captured", () => {
  const system = createSiteDesignSystem({
    app: "Example",
    sourceUrl: "https://example.com/",
    analysis,
  });
  system.tokens[0]!.evidence = ["STRUCTURE-99"];

  assert.throws(
    () => parseSiteDesignSystem(system, new Set(["STRUCTURE-0", "STRUCTURE-1", "STRUCTURE-2", "RESPONSIVE-0"])),
    /unknown evidence/,
  );
});
