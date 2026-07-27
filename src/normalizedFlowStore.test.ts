import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignFlow } from "./designSystem.ts";
import {
  canonicalFlowPath,
  displayFlowName,
  normalizedFlowName,
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
