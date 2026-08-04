import { createApiApp, DEFAULT_API_PORT } from "./app.ts";
import { adminSeedFromEnv, billingConfigFromEnv, referralCampaignFromEnv } from "./config.ts";
import { startApi } from "./start.ts";
import { seedAdmin } from "../../../src/authStore.ts";
import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import Stripe from "stripe";
import { createBillingService, type StripePort } from "./billing.ts";
import {
  getSubscription,
  hasProcessedStripeEvent,
  markStripeEventProcessed,
  upsertStripeCustomer,
  upsertSubscription,
} from "../../../src/pricingStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../../src/objectStoreConfig.ts";
import { advancedSearchConfigFromEnv } from "../../../src/searchConfig.ts";
import { OpenAICompatibleSearchEmbeddingProvider } from "../../../src/searchEmbedding.ts";
import { PostgresSearchStore } from "../../../src/searchStore.ts";
import { createSearchService } from "./search.ts";
import { publishedFlowCatalogPage } from "../../../src/flowCatalogStore.ts";
import { createJwtAuth, jwtAuthConfigFromEnv } from "../../../src/jwtAuth.ts";

const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT);
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
await startApi({
  assertMigrations: () => assertMigrationsCurrent(pool),
  start: async () => {
    const seed = adminSeedFromEnv(process.env);
    const config = billingConfigFromEnv(process.env);
    const auth = createJwtAuth(jwtAuthConfigFromEnv(process.env));
    const referralCampaign = referralCampaignFromEnv(process.env);
    const searchConfig = advancedSearchConfigFromEnv(process.env);
    const searchEmbedder = searchConfig.embedding
      ? new OpenAICompatibleSearchEmbeddingProvider(searchConfig.embedding)
      : null;
    await seedAdmin(seed.email, seed.password);
    const stripe = new Stripe(config.stripeSecretKey);
    const billing = createBillingService({
      stripe: stripe as unknown as StripePort,
      config,
      store: {
        getSubscription,
        upsertStripeCustomer,
        upsertSubscription,
        hasProcessedStripeEvent,
        markStripeEventProcessed,
      },
    });
    const flowWarmups = await Promise.allSettled(
      (["web", "ios", "android"] as const).map((platform) =>
        publishedFlowCatalogPage({
          platform,
          limit: 12,
          sort: "popular",
          includeFacets: false,
          cursorSecret: config.mediaSigningSecret,
        })
      ),
    );
    const failedFlowWarmups = flowWarmups.filter(
      (result) => result.status === "rejected",
    ).length;
    if (failedFlowWarmups > 0) {
      console.warn(`[api] ${failedFlowWarmups} Flow catalog warmup(s) failed`);
    }
    const app = createApiApp({
      billing,
      objectStore,
      issueAuthToken: auth.issueAuthToken,
      verifyAuthToken: auth.verifyAuthToken,
      mediaSigningSecret: config.mediaSigningSecret,
      generalRateLimit: config.generalRateLimit,
      mediaRateLimit: config.mediaRateLimit,
      appTraversalLimit: config.appTraversalLimit,
      appUrl: config.appUrl,
      referralCampaign,
      advancedSearchEnabled: searchConfig.enabled,
      adaptiveSearch: createSearchService({
        store: new PostgresSearchStore(pool),
        embedder: searchEmbedder,
        telemetry: {
          record: (event) => {
            console.log(JSON.stringify({ event: "adaptive_search", ...event }));
          },
        },
      }),
    });
    app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
  },
});
