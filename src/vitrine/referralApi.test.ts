import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activateProMonth,
  createReferralLink,
  loadReferralSummary,
  validateReferral,
} from "./referralApi.ts";

test("validates an encoded referral token with a privacy-safe visitor id", async () => {
  let requested = "";
  const valid = await validateReferral("token / value", "visitor id", async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ valid: true }), { status: 200 });
  });
  assert.equal(valid, true);
  assert.equal(requested, "/api/referrals/validate?token=token+%2F+value&visitor=visitor+id");
});

test("loads referral state, creates a link, and activates one Pro Month", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const summary = {
    campaign: { id: "launch-2026", active: true, endsAt: "2026-10-19T00:00:00.000Z" },
    referralCount: 1,
    activatedCount: 1,
    earnedCount: 1,
    availableMonths: 1,
    referrals: [{ id: "11", state: "rewarded" as const }],
  };
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method });
    if (String(input).endsWith("/link")) {
      return new Response(JSON.stringify({ url: "https://astryx.example/?ref=token" }), { status: 201 });
    }
    if (String(input).endsWith("/activate")) {
      return new Response(JSON.stringify({
        status: "activated",
        expiresAt: "2026-08-24T00:00:00.000Z",
        availableMonths: 0,
      }), { status: 200 });
    }
    return new Response(JSON.stringify(summary), { status: 200 });
  };

  assert.deepEqual(await loadReferralSummary(fetcher), summary);
  assert.equal((await createReferralLink(fetcher)).url, "https://astryx.example/?ref=token");
  assert.equal((await activateProMonth(fetcher)).availableMonths, 0);
  assert.deepEqual(calls, [
    { url: "/api/referrals/summary", method: undefined },
    { url: "/api/referrals/link", method: "POST" },
    { url: "/api/referrals/rewards/activate", method: "POST" },
  ]);
});

test("surfaces referral API errors", async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: "No Pro Month is available" }), { status: 409 });
  await assert.rejects(activateProMonth(fetcher), /No Pro Month is available/);
});
