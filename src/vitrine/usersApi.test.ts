import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  fetchAdminUsersPage,
  fetchFeatureUsage,
  fetchReferralCampaignMetrics,
  fetchUserFeatureUsage,
  grantAdminUserPro,
  revokeReferral,
  revokeAdminUserProGrant,
  setAdminUserActive,
} from "./usersApi.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("encodes paginated directory search and filters", async () => {
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ users: [], nextCursor: null, total: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await fetchAdminUsersPage({ limit: 30, cursor: "next page", query: "kai+test@example.com", filter: "pro" });
  assert.equal(requested, "/api/admin/users?limit=30&cursor=next+page&q=kai%2Btest%40example.com&filter=pro");
});

test("updates account state with the narrow active contract", async () => {
  let request: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ id: 4, active: false }), { status: 200 });
  };

  const user = await setAdminUserActive(4, false);
  assert.equal(request?.method, "PATCH");
  assert.equal(request?.body, JSON.stringify({ active: false }));
  assert.equal(user.active, false);
});

test("grants and revokes a manual Pro access grant", async () => {
  const requests: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method });
    return new Response(JSON.stringify({ id: 4, subscription_status: "active", manual_pro_grant: init?.method === "POST" }), { status: 200 });
  };

  const granted = await grantAdminUserPro(4);
  const revoked = await revokeAdminUserProGrant(4);
  assert.equal(granted.manual_pro_grant, true);
  assert.equal(revoked.manual_pro_grant, false);
  assert.deepEqual(requests, [
    { url: "/api/admin/users/4/subscription/upgrade", method: "POST" },
    { url: "/api/admin/users/4/subscription/grant", method: "DELETE" },
  ]);
});

test("loads overview and per-user analytics for one supported range", async () => {
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response(JSON.stringify({ summary: { totalEvents: 0 }, features: [], daily: [], recentEvents: [] }), { status: 200 });
  };

  await fetchFeatureUsage("90d");
  await fetchUserFeatureUsage(7, "90d");
  assert.deepEqual(requested, ["/api/admin/users/usage?range=90d", "/api/admin/users/7/usage?range=90d"]);
});

test("surfaces the server error message", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "The last active administrator cannot be disabled" }), { status: 403 });
  await assert.rejects(() => setAdminUserActive(1, false), /last active administrator/);
});

test("loads referral metrics and submits a narrow revocation", async () => {
  const requests: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method });
    if (init?.method === "POST") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ linksCreated: 0, referredRetention: { day7: 0, day30: 0, day60: 0 } }), { status: 200 });
  };
  await fetchReferralCampaignMetrics();
  await revokeReferral(11);
  assert.deepEqual(requests, [
    { url: "/api/admin/referrals/metrics", method: undefined },
    { url: "/api/admin/referrals/11/revoke", method: "POST" },
  ]);
});
