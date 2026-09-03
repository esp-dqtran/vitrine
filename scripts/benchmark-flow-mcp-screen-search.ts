import { closePool, query as databaseQuery } from "../src/db.ts";
import { publishedScreenSearch } from "../src/flowScreenSearchStore.ts";
import { searchAccessibleScreens } from "../services/api/src/flowMcp.ts";

const RESULT_LIMIT = 6;
const MIN_RESULTS = 4;
const QUERY_TARGET_MS = 2_000;
const WEB_ANALYSIS_COVERAGE_TARGET = 0.8;

const cases = [
  "login screen with email and password",
  "checkout page showing a promo code field",
  "personalization questions during onboarding",
  "two-factor authentication with an authenticator app",
  "change language in account settings",
] as const;

const user = { id: 1, email: "screen-search-parity@vitrines.test", role: "admin" as const };
const dependencies = {
  appUrl: process.env.APP_URL ?? "https://vitrines.ai",
  canAccessApp: async () => true,
  publishedScreenSearch,
};

try {
  const coverage = await databaseQuery<{
    screens: number;
    analyzed: number;
    indexed: number;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (app_id, platform) id
       FROM app_versions
       WHERE status = 'published' AND platform = 'web'
       ORDER BY app_id, platform, version_number DESC
     )
     SELECT
       count(*) FILTER (WHERE image.kind = 'screen')::integer AS screens,
       count(*) FILTER (WHERE image.kind = 'screen' AND image.analysis IS NOT NULL)::integer AS analyzed,
       (SELECT count(*)::integer FROM published_screen_search_documents) AS indexed
     FROM latest
     JOIN version_images version_image ON version_image.version_id = latest.id
     JOIN images image ON image.id = version_image.image_id`,
  );
  const coverageRow = coverage.rows[0] ?? { screens: 0, analyzed: 0, indexed: 0 };
  const webAnalysisCoverage = coverageRow.screens > 0
    ? coverageRow.analyzed / coverageRow.screens
    : 0;
  const results = [];
  for (const query of cases) {
    const startedAt = performance.now();
    const screens = await searchAccessibleScreens(user, dependencies, { query, mode: "deep", limit: RESULT_LIMIT });
    results.push({
      query,
      mode: "deep",
      durationMs: Math.round(performance.now() - startedAt),
      resultCount: screens.length,
      results: screens.map((screen) => ({
        app: screen.app,
        platform: screen.platform,
        title: screen.title,
        pageType: screen.pageType,
        productArea: screen.productArea,
        matchedOn: screen.matchedOn,
        flowTitle: screen.flow?.title,
        stepLabel: screen.flow?.stepLabel,
      })),
    });
  }
  const relevancePassed = results.every(({ resultCount }) => resultCount >= MIN_RESULTS);
  const performancePassed = results.every(({ durationMs }) => durationMs <= QUERY_TARGET_MS);
  const coveragePassed = webAnalysisCoverage >= WEB_ANALYSIS_COVERAGE_TARGET;
  const passed = relevancePassed && performancePassed && coveragePassed;
  console.log(JSON.stringify({
    passed,
    relevancePassed,
    performancePassed,
    coveragePassed,
    minimumResultsPerQuery: MIN_RESULTS,
    queryTargetMs: QUERY_TARGET_MS,
    webAnalysisCoverageTarget: WEB_ANALYSIS_COVERAGE_TARGET,
    webAnalysisCoverage,
    coverage: coverageRow,
    results,
  }, null, 2));
  process.exitCode = passed ? 0 : 1;
} finally {
  await closePool();
}
