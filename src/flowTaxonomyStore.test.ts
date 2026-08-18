import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFlowTaxonomyStore,
  FlowTaxonomyValidationError,
  parseFlowClassificationInput,
} from "./flowTaxonomyStore.ts";

test("parses only controlled classification input", () => {
  assert.deepEqual(parseFlowClassificationInput({
    flowTypeId: 42,
    status: "approved",
    confidence: 0.876,
  }), {
    flowTypeId: 42,
    status: "approved",
    confidence: 0.88,
  });
  for (const value of [
    {},
    { flowTypeId: 0, status: "approved" },
    { flowTypeId: 1, status: "rejected" },
    { flowTypeId: 1, status: "approved", confidence: 1.1 },
  ]) {
    assert.throws(() => parseFlowClassificationInput(value), FlowTaxonomyValidationError);
  }
});

test("lists the seeded taxonomy with types grouped by category", async () => {
  const calls: string[] = [];
  const store = createFlowTaxonomyStore(async (sql) => {
    calls.push(sql);
    if (sql.includes("FROM flow_categories category")) {
      return { rows: [{ id: 1, slug: "authentication", name: "Authentication", position: 1, approved_flow_count: 3 }] } as never;
    }
    return { rows: [{ type_id: 7, category_id: 1, type_slug: "sign-in", type_name: "Sign in", type_position: 1 }] } as never;
  });
  assert.deepEqual(await store.listPublished(), [{
    id: 1,
    slug: "authentication",
    name: "Authentication",
    position: 1,
    approvedFlowCount: 3,
    types: [{ id: 7, slug: "sign-in", name: "Sign in", position: 1 }],
  }]);
  assert.equal(calls.length, 2);
});

test("lists unclassified and pending canonical flows for review", async () => {
  const store = createFlowTaxonomyStore(async (_sql, values) => {
    assert.deepEqual(values, [10]);
    return {
      rows: [{
        flow_id: 9,
        title: "Reset password",
        current_category: "Account",
        app_flow_count: 38,
        app_count: 14,
        classified_flow_id: null,
      }],
    } as never;
  });
  assert.deepEqual(await store.listReviewQueue(10), [{
    flowId: 9,
    title: "Reset password",
    currentCategory: "Account",
    appFlowCount: 38,
    appCount: 14,
    classification: null,
  }]);
});

test("saves reviewed classifications with the selected type", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const store = createFlowTaxonomyStore(async (sql, values) => {
    calls.push({ sql, values });
    return {
      rows: [{
        flow_id: 9,
        status: "approved",
        confidence: "0.90",
        source: "manual",
        reviewed_by_user_id: 4,
        reviewed_at: "2026-08-17T10:00:00.000Z",
        type_id: 7,
        type_slug: "password-reset",
        type_name: "Password reset",
        type_position: 5,
        category_id: 1,
        category_slug: "authentication",
        category_name: "Authentication",
        category_position: 1,
      }],
    } as never;
  });
  assert.deepEqual(await store.saveClassification({
    flowId: 9,
    flowTypeId: 7,
    status: "approved",
    confidence: 0.9,
    source: "manual",
    reviewedByUserId: 4,
  }), {
    flowId: 9,
    type: {
      id: 7,
      slug: "password-reset",
      name: "Password reset",
      position: 5,
      category: { id: 1, slug: "authentication", name: "Authentication", position: 1 },
    },
    status: "approved",
    confidence: 0.9,
    source: "manual",
    reviewedByUserId: 4,
    reviewedAt: "2026-08-17T10:00:00.000Z",
  });
  assert.match(calls[0]!.sql, /ON CONFLICT \(flow_id\) DO UPDATE/);
  assert.deepEqual(calls[0]!.values, [9, 7, "approved", 0.9, "manual", 4]);
});
