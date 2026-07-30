import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignFlow } from "./designSystem.ts";
import {
  canonicalFlowPath,
  displayFlowName,
  normalizedFlowName,
  replaceVersionFlows,
  type FlowWriteClient,
  validateIncomingFlows,
} from "./normalizedFlowStore.ts";

const flow = (overrides: Partial<DesignFlow> = {}): DesignFlow => ({
  id: "checkout",
  title: "  Guest   Checkout  ",
  category: "  Checkout ",
  description: "Complete a purchase",
  tags: [],
  steps: [],
  ...overrides,
});

test("normalizes display and identity names deterministically", () => {
  assert.equal(displayFlowName("  Guest   Checkout  "), "Guest Checkout");
  assert.equal(normalizedFlowName("  Guest   Checkout  "), "guest checkout");
});

test("normalizes a category into a root and a title into its child", () => {
  assert.deepEqual(canonicalFlowPath(flow()), {
    root: { name: "Checkout", normalizedName: "checkout" },
    child: { name: "Guest Checkout", normalizedName: "guest checkout" },
  });
});

test("uses one root when category and title normalize equally", () => {
  assert.deepEqual(canonicalFlowPath(flow({
    title: " Account ",
    category: "account",
  })), {
    root: { name: "Account", normalizedName: "account" },
  });
});

test("uses the title as a root when category is absent or empty", () => {
  assert.deepEqual(canonicalFlowPath(flow({ category: undefined })), {
    root: { name: "Guest Checkout", normalizedName: "guest checkout" },
  });
  assert.deepEqual(canonicalFlowPath(flow({ category: " " })), {
    root: { name: "Guest Checkout", normalizedName: "guest checkout" },
  });
});

test("rejects duplicate source ids before persistence", () => {
  assert.throws(
    () => validateIncomingFlows([flow(), flow({ title: "Other" })]),
    /Flow source ids must be unique/,
  );
});

test("rejects malformed required fields and arrays", () => {
  assert.throws(() => validateIncomingFlows([flow({ id: " " })]), /Flow id/);
  assert.throws(() => validateIncomingFlows([flow({ title: " " })]), /Flow title/);
  assert.throws(
    () => validateIncomingFlows([{ ...flow(), tags: null } as unknown as DesignFlow]),
    /Flow tags must be an array/,
  );
  assert.throws(
    () => validateIncomingFlows([{ ...flow(), steps: null } as unknown as DesignFlow]),
    /Flow steps must be an array/,
  );
});

test("rejects non-serializable payloads", () => {
  const cyclic = flow() as DesignFlow & { cyclic?: unknown };
  cyclic.cyclic = cyclic;
  assert.throws(() => validateIncomingFlows([cyclic]), /JSON-serializable/);
});

test("accepts an empty authoritative replacement", () => {
  assert.doesNotThrow(() => validateIncomingFlows([]));
});

test("keeps unpublished Flow imports and repairs writable", async () => {
  const sql: string[] = [];
  const client = {
    query: async (statement: string) => {
      sql.push(statement);
      if (/SELECT id, status, published_at/.test(statement)) {
        return { rows: [{ id: 7, status: "draft", published_at: null }], rowCount: 1 };
      }
      if (/max_position/.test(statement)) {
        return { rows: [{ max_position: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as FlowWriteClient;
  await replaceVersionFlows(client, { versionId: 7, flows: [] });
  assert.ok(sql.some((statement) => /UPDATE app_flow_versions/.test(statement)));
  assert.ok(sql.some((statement) => /DELETE FROM app_flow_versions/.test(statement)));
});

test("rejects published Flow repairs before any child or mapping mutation", async () => {
  const sql: string[] = [];
  const client = {
    query: async (statement: string) => {
      sql.push(statement);
      return {
        rows: [{
          id: 7,
          status: "published",
          published_at: "2026-07-29T06:00:00.000Z",
        }],
        rowCount: 1,
      };
    },
  } as unknown as FlowWriteClient;
  await assert.rejects(
    () => replaceVersionFlows(client, { versionId: 7, flows: [] }),
    /Published Flow versions are immutable; publish a new App version/,
  );
  assert.equal(sql.length, 1);
});

test("rejects inconsistent published status even if published_at is missing", async () => {
  const client = {
    query: async () => ({
      rows: [{ id: 7, status: "published", published_at: null }],
      rowCount: 1,
    }),
  } as unknown as FlowWriteClient;
  await assert.rejects(
    () => replaceVersionFlows(client, { versionId: 7, flows: [] }),
    /Published Flow versions are immutable; publish a new App version/,
  );
});
