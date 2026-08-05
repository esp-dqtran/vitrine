import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePlan, exportWindow, revenueSummary } from "./pricing.ts";

test("prices yearly plans as monthly recurring revenue and rates churn against live subs", () => {
  assert.deepEqual(revenueSummary({ active_monthly: 0, active_yearly: 0, canceled_30d: 0 }), {
    mrrCents: 0,
    arrCents: 0,
    churnRate: 0,
  });
  // 10 × $8.99 + 3 × ($79.99 / 12) = $89.90 + $20.00
  assert.deepEqual(revenueSummary({ active_monthly: 10, active_yearly: 3, canceled_30d: 2 }), {
    mrrCents: 10990,
    arrCents: 131880,
    churnRate: 13.3,
  });
});

test("grants Pro only for active or unexpired past-due subscriptions", () => {
  const now = new Date("2026-07-10T00:00:00Z");
  assert.equal(effectivePlan(undefined, now), "free");
  assert.equal(effectivePlan({ status: "active", grace_expires_at: null }, now), "pro");
  assert.equal(
    effectivePlan({ status: "past_due", grace_expires_at: "2026-07-11T00:00:00Z" }, now),
    "pro",
  );
  assert.equal(
    effectivePlan({ status: "past_due", grace_expires_at: "2026-07-09T00:00:00Z" }, now),
    "free",
  );
  assert.equal(effectivePlan({ status: "unpaid", grace_expires_at: null }, now), "free");
});

test("uses anniversary windows and shorter month ends", () => {
  assert.deepEqual(
    exportWindow(new Date("2026-01-31T12:00:00Z"), new Date("2026-02-28T18:00:00Z")),
    {
      start: new Date("2026-02-28T12:00:00Z"),
      end: new Date("2026-03-31T12:00:00Z"),
    },
  );
  assert.deepEqual(
    exportWindow(new Date("2026-01-15T12:00:00Z"), new Date("2026-03-10T18:00:00Z")),
    {
      start: new Date("2026-02-15T12:00:00Z"),
      end: new Date("2026-03-15T12:00:00Z"),
    },
  );
});
