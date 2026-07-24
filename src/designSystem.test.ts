import { test } from "node:test";
import assert from "node:assert/strict";
import { hydrateDesignSystem, parseDesignSystemSnapshot } from "./designSystem.ts";

test("keeps only tokens and variants backed by captured image ids", () => {
  const snapshot = parseDesignSystemSnapshot(
    JSON.stringify({
      tokens: [
        { id: "color-primary", kind: "color", name: "Primary", value: "#5E6AD2", role: "primary action", evidence: [1, 999] },
        { id: "color-invented", kind: "color", name: "Invented", value: "#000000", role: "unknown", evidence: [999] },
      ],
      components: [
        {
          id: "button",
          name: "Button",
          category: "Actions",
          description: "Rounded action control",
          variants: [
            { id: "button-primary", name: "Primary", description: "Filled purple button", evidence: [1] },
            { id: "button-disabled", name: "Disabled", description: "Not observed", evidence: [999] },
          ],
        },
      ],
      flows: [],
    }),
    "linear",
    new Set([1]),
    "2026-07-10T00:00:00.000Z",
  );

  assert.deepEqual(snapshot.tokens[0].evidence, [1]);
  assert.equal(snapshot.tokens.length, 1);
  assert.deepEqual(snapshot.components[0].variants.map((variant) => variant.id), ["button-primary"]);
});

test("rejects malformed synthesis output", () => {
  assert.throws(
    () => parseDesignSystemSnapshot("not json", "linear", new Set([1]), "2026-07-10T00:00:00.000Z"),
    /valid JSON/,
  );
});

test("hydrates evidence ids with public image data", () => {
  const snapshot = parseDesignSystemSnapshot(
    JSON.stringify({
      tokens: [{ id: "space-8", kind: "spacing", name: "Space 8", value: "8px", role: "control gap", evidence: [7] }],
      components: [],
      flows: [],
    }),
    "linear",
    new Set([7]),
    "2026-07-10T00:00:00.000Z",
  );

  const hydrated = hydrateDesignSystem(snapshot, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Toolbar" },
  ]);
  assert.deepEqual(hydrated.tokens[0].evidence, [
    { imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Toolbar" },
  ]);
});

test("hydrates verified component crop media without object-storage fields", () => {
  const hydrated = hydrateDesignSystem({
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [],
    components: [{
      id: "button",
      name: "Button",
      category: "Action",
      description: "Primary action",
      variants: [{
        id: "primary",
        name: "Primary",
        description: "Filled button",
        evidence: [7],
        occurrences: [{
          imageId: 7,
          cropImageId: 88,
          coordinateSpace: "normalized",
          region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        }],
      }],
    }],
    flows: [],
  }, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Form" },
    { id: 88, image_url: "capture:fedcba9876543210", description: "Button crop" },
  ]);

  const occurrence = hydrated.components[0].variants[0].occurrences?.[0];
  assert.equal(occurrence?.crop?.imageId, 88);
  assert.match(occurrence?.crop?.imageUrl ?? "", /^\/api\/media\/linear\//);
  assert.equal("objectKey" in (occurrence?.crop ?? {}), false);
});

test("hydrates ordered flow steps without changing curator order", () => {
  const hydrated = hydrateDesignSystem({
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [],
    components: [],
    flows: [{
      id: "login",
      title: "Login",
      description: "Authenticate",
      tags: ["Authentication"],
      steps: [
        { label: "Email", evidence: [7] },
        { label: "Password", evidence: [9] },
      ],
    }],
  }, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Email" },
    { id: 9, image_url: "mobbin-bulk:fedcba9876543210", description: "Password" },
  ]);

  assert.deepEqual(hydrated.flows[0].steps.map((step) => step.evidence[0].imageId), [7, 9]);
  assert.deepEqual(hydrated.flows[0].steps.map((step) => step.evidence[0].imageUrl), [
    "/api/media/linear/0123456789abcdef",
    "/api/media/linear/fedcba9876543210",
  ]);
});

test("hydrates Flow insight evidence with the same captured images", () => {
  const hydrated = hydrateDesignSystem({
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [],
    components: [],
    flows: [{
      id: "login",
      title: "Login",
      description: "Authenticate",
      tags: ["Authentication"],
      steps: [{ label: "Email", evidence: [7] }],
      insights: {
        purpose: "Authenticate the user",
        feedback: ["Session begins"],
        openQuestions: [],
        confidence: 0.82,
        reviewStatus: "needs_review",
        source: "llm_inferred",
        evidence: [7],
      },
    }],
  }, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Email" },
  ]);

  assert.deepEqual(hydrated.flows[0].insights?.evidence, [{
    imageId: 7,
    imageUrl: "/api/media/linear/0123456789abcdef",
    description: "Email",
  }]);
});

test("preserves autonomous flow provenance while hydrating evidence", () => {
  const hydrated = hydrateDesignSystem({
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [],
    components: [],
    flows: [{
      id: "create-item",
      title: "Create an item",
      description: "Create an item",
      tags: ["Items"],
      steps: [{ label: "Items", evidence: [7] }],
      provenance: {
        autonomousRunId: "1",
        missionId: "mission-1",
        confidence: 0.91,
        sourceUrls: ["https://docs.app.test/items"],
        validationStatus: "complete",
      },
    }],
  }, [{ id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Items" }]);

  assert.equal(hydrated.flows[0].provenance?.autonomousRunId, "1");
  assert.equal(hydrated.flows[0].provenance?.confidence, 0.91);
});

test("hydrates evidence with an injected protected-media URL", () => {
  const hydrated = hydrateDesignSystem({
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color", kind: "color", name: "Color", value: "#000", role: "text", evidence: [7] }],
    components: [],
    flows: [],
  }, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Toolbar" },
  ], (app, source) => `/protected/${app}/${source}`);
  assert.equal(
    hydrated.tokens[0].evidence[0].imageUrl,
    "/protected/linear/mobbin-bulk:0123456789abcdef",
  );
});
