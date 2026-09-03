import { publishedFlowCatalogPage } from "../src/flowCatalogStore.ts";
import { searchPublishedFlowInstances } from "../src/flowInstanceSearchStore.ts";
import { normalizeFlowSearchQuery, searchAccessibleFlows } from "../services/api/src/flowMcp.ts";

const MIN_RELEVANT_RESULTS = 4;
const RESULT_LIMIT = 4;
const COLD_QUERY_P95_TARGET_MS = 2_000;
const WARM_P95_TARGET_MS = 750;

const cases = [
  { query: "login flow", expectedTitle: /^logging in(?:$|\s*\()/i },
  { query: "login with email and password", expectedTitle: /^logging in(?:$|\s*\()/i },
  { query: "logout flow", expectedTitle: /^logging out$/i },
  { query: "forgot password", expectedTitle: /^resetting password$/i },
  { query: "password recovery", expectedTitle: /^resetting password$/i },
  { query: "sign up flow", expectedTitle: /^creating an account$/i },
  { query: "checkout flow", expectedTitle: /^checkout$/i },
  { query: "invite team members", expectedTitle: /invit/i },
  { query: "invite teammates by email and assign roles", expectedTitle: /invit/i },
  { query: "edit profile", expectedTitle: /edit(?:ing)? profile/i },
  { query: "filter products", expectedTitle: /filter/i },
  { query: "onboarding flow", expectedTitle: /^onboarding$/i },
  { query: "onboarding with personalization questions", expectedTitle: /personaliz/i },
  { query: "change notification preferences", expectedTitle: /^updating notification settings$/i },
  { query: "delete an account", expectedTitle: /^delete an account$/i },
  { query: "cancel a subscription", expectedTitle: /^cancel(?:ing|ling)? a subscription$/i },
  { query: "add a payment method during checkout", expectedTitle: /^adding a payment method$/i },
  { query: "enable two-factor authentication with an authenticator app", expectedTitle: /two-factor authentication/i },
  { query: "change language in account settings", expectedTitle: /^changing language$/i },
  { query: "upload a profile photo and crop it", expectedTitle: /^uploading a profile photo$/i },
] as const;

const user = { id: 1, email: "flow-mcp-parity@vitrines.test", role: "admin" as const };
const dependencies = {
  appUrl: process.env.APP_URL ?? "https://vitrines.ai",
  flowCatalogSecret: process.env.FLOW_CATALOG_CURSOR_SECRET ?? "flow-mcp-parity-read-only-secret",
  canAccessApp: async () => true,
  publishedFlowCatalogPage,
  publishedFlowInstanceSearch: searchPublishedFlowInstances,
};

const coldStartAt = performance.now();
await searchAccessibleFlows(user, dependencies, { query: "flow catalog warmup probe", limit: 1 });
const coldStartMs = Math.round(performance.now() - coldStartAt);

const results = [];
for (const benchmark of cases) {
  const startedAt = performance.now();
  const flows = await searchAccessibleFlows(user, dependencies, {
    query: benchmark.query,
    limit: RESULT_LIMIT,
  });
  const relevantResults = flows.filter(({ title }) => benchmark.expectedTitle.test(title)).length;
  results.push({
    query: benchmark.query,
    effectiveQuery: normalizeFlowSearchQuery(benchmark.query),
    passed: relevantResults >= MIN_RELEVANT_RESULTS,
    relevantResults,
    resultCount: flows.length,
    coldQueryDurationMs: Math.round(performance.now() - startedAt),
    results: flows.map(({ platform, app, title }) => ({ platform, app, title })),
  });
}

const passedCases = results.filter(({ passed }) => passed).length;
const warmDurations = [];
for (const benchmark of cases) {
  const startedAt = performance.now();
  await searchAccessibleFlows(user, dependencies, { query: benchmark.query, limit: RESULT_LIMIT });
  warmDurations.push(Math.round(performance.now() - startedAt));
}
const percentile95 = (durations: readonly number[]): number => {
  const sorted = [...durations].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
};
const coldQueryP95Ms = percentile95(results.map(({ coldQueryDurationMs }) => coldQueryDurationMs));
const warmP95Ms = percentile95(warmDurations);
const relevancePassed = passedCases === cases.length;
const performancePassed = coldQueryP95Ms <= COLD_QUERY_P95_TARGET_MS && warmP95Ms <= WARM_P95_TARGET_MS;
const report = {
  threshold: `At least ${MIN_RELEVANT_RESULTS} of the top ${RESULT_LIMIT} titles match the expected intent`,
  passed: relevancePassed && performancePassed,
  relevancePassed,
  performancePassed,
  passedCases,
  totalCases: cases.length,
  coldStartMs,
  coldQueryP95Ms,
  coldQueryP95TargetMs: COLD_QUERY_P95_TARGET_MS,
  warmP95Ms,
  warmP95TargetMs: WARM_P95_TARGET_MS,
  results,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
