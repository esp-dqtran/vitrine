import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { GETDESIGN_APP_MAPPINGS } from "./getdesignCatalog.ts";
import { parseGetDesignMarkdown, validateImportedSnapshot } from "./getdesignParser.ts";

test("defines 44 unique GetDesign-to-Astryx web mappings", () => {
  assert.equal(GETDESIGN_APP_MAPPINGS.length, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ sourceSlug }) => sourceSlug)).size, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ app }) => app)).size, 44);
  assert.deepEqual(
    GETDESIGN_APP_MAPPINGS
      .filter(({ createWebPlatform }) => createWebPlatform)
      .map(({ app }) => app)
      .sort(),
    ["my-bmw", "playstation-app", "raycast", "starbucks", "tesla"],
  );
  assert.ok(GETDESIGN_APP_MAPPINGS.every(({ platform }) => platform === "web"));
});

const fixture = `---
version: alpha
name: Example-design-analysis
description: "Dark, precise product UI."
colors:
  primary: "#5e6ad2"
  canvas: "#010102"
typography:
  display:
    fontFamily: Linear Display
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.1
rounded:
  md: 8px
spacing:
  sm: 12px
borders:
  hairline: 1px solid #23252a
effects:
  card: 0 8px 30px rgba(0,0,0,.25)
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: "#828fff"
---

## Responsive behavior
Use one column below 720px and preserve compact controls.
`;

test("parses structured GetDesign foundations, components, and rules", () => {
  const snapshot = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  assert.equal(snapshot.summary, "Dark, precise product UI.");
  assert.deepEqual(snapshot.tokens.map(({ kind }) => kind), [
    "color", "color", "typography", "radius", "spacing", "border", "effect",
  ]);
  assert.ok(snapshot.tokens.every(({ evidence }) => evidence.length === 0));
  assert.deepEqual(snapshot.components.map(({ id }) => id), ["button-primary"]);
  assert.deepEqual(snapshot.components[0].variants.map(({ name }) => name), ["Default", "Hover"]);
  assert.equal(snapshot.components[0].variants[0].reconstruction?.fill, "#5e6ad2");
  assert.equal(snapshot.components[0].variants[0].reconstruction?.radius, 8);
  assert.equal(snapshot.rules?.[0].kind, "responsive");
  assert.match(snapshot.rules?.[0].description ?? "", /one column below 720px/i);
  assert.doesNotThrow(() => validateImportedSnapshot(snapshot));
});

test("keeps actionable guidance out of documentation-heavy Markdown sections", () => {
  const snapshot = parseGetDesignMarkdown(`${fixture}
## Overview
This section explains the product and its history in detail.

## Buttons
This section inventories every button variant and implementation property.

## Do
Keep primary actions visually dominant.

## Known Gaps
This section records incomplete research.

## Voice Library
This section inventories voices available in the product.

## hero-photo-card
This section defines a reusable image component.

## Icon Button Inventory
This section lists icon button variants.

## Interaction Components
This section inventories interactive components.

## Spacing: 1px, 2px, 4px, 8px, 12px, 16px
`, "linear", "2026-07-22T00:00:00.000Z");

  assert.deepEqual(snapshot.rules?.map(({ name }) => name), ["Responsive behavior", "Do"]);
});

test("uses deterministic ids and rejects invalid imported structures", () => {
  const first = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  const second = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  assert.deepEqual(first, second);
  assert.throws(() => validateImportedSnapshot({ ...first, tokens: [] }), /at least one design token/);
  assert.throws(
    () => validateImportedSnapshot({ ...first, tokens: [first.tokens[0], first.tokens[0]] }),
    /duplicate token id/,
  );
});

test("parses every pinned mapped template, including legacy Markdown-only files", async () => {
  const require = createRequire(import.meta.url);
  const templateRoot = join(dirname(require.resolve("getdesign/package.json")), "templates");
  for (const mapping of GETDESIGN_APP_MAPPINGS) {
    const markdown = await readFile(join(templateRoot, `${mapping.sourceSlug}.md`), "utf8");
    const snapshot = parseGetDesignMarkdown(markdown, mapping.app, "2026-07-22T00:00:00.000Z");
    assert.ok(snapshot.tokens.length > 0, `${mapping.sourceSlug} has tokens`);
    assert.ok(snapshot.components.length > 0, `${mapping.sourceSlug} has components`);
    assert.ok((snapshot.rules?.length ?? 0) > 0, `${mapping.sourceSlug} has rules`);
    assert.doesNotThrow(() => validateImportedSnapshot(snapshot), mapping.sourceSlug);
  }
});
