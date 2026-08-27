import type { Platform } from "../../../src/platformFromUrl.ts";

interface FlowCatalogWarmupInput {
  platform: Platform;
  limit: 80;
  sort: "grouped";
  includeFacets: false;
  cursorSecret: string;
  flowCategories?: readonly string[];
  flowTypes?: readonly string[];
}

type FlowCatalogWarmupLoader = (input: FlowCatalogWarmupInput) => Promise<unknown>;

export const FLOW_CATEGORY_WARMUPS = [
  "authentication",
  "onboarding",
  "discovery-navigation",
  "search",
  "content-detail",
  "creation-editing",
  "communication-collaboration",
  "commerce-checkout",
  "monetization",
  "billing",
  "account-settings",
  "retention-engagement",
  "system-privacy-support",
] as const;

export async function warmFlowCatalogFilters(input: {
  cursorSecret: string;
  loadPage: FlowCatalogWarmupLoader;
  platforms?: readonly Platform[];
}): Promise<number> {
  let failures = 0;
  for (const platform of input.platforms ?? ["web"]) {
    for (const filters of [
      ...FLOW_CATEGORY_WARMUPS.map((category) => ({ flowCategories: [category] })),
      { flowTypes: ["content-detail/other-content-detail"] },
    ]) {
      try {
        await input.loadPage({
          platform,
          limit: 80,
          sort: "grouped",
          includeFacets: false,
          cursorSecret: input.cursorSecret,
          ...filters,
        });
      } catch {
        failures += 1;
      }
    }
  }
  return failures;
}
