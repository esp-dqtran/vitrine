import { createApiApp, DEFAULT_API_PORT } from "./app.ts";
import { adminSeedFromEnv, billingConfigFromEnv, referralCampaignFromEnv } from "./config.ts";
import { startApi } from "./start.ts";
import { seedAdmin } from "../../../src/authStore.ts";
import {
  pool, query,
} from "../../../src/db.ts";
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
import { publishedFlowCatalogPage } from "../../../src/flowCatalogStore.ts";
import { createJwtAuth, jwtAuthConfigFromEnv } from "../../../src/jwtAuth.ts";
import {
  createPasswordResetEmailSender,
  passwordResetEmailConfigFromEnv,
} from "../../../src/passwordResetEmail.ts";
import { createTypesenseCatalogClient, typesenseCatalogConfigFromEnv } from "../../../src/typesenseCatalog.ts";
import {
  TYPESENSE_APP_CATALOG_COLLECTION,
  createTypesenseAppCatalogClient,
} from "../../../src/typesenseAppCatalog.ts";
import {
  TYPESENSE_FLOW_CATALOG_COLLECTION,
  createTypesenseFlowCatalogClient,
} from "../../../src/typesenseFlowCatalog.ts";
import {
  TYPESENSE_SITE_CATALOG_COLLECTION,
  createTypesenseSiteCatalogClient,
} from "../../../src/typesenseSiteCatalog.ts";
import {
  publishedAppCatalogDocument,
} from "../../../src/typesenseAppCatalogSource.ts";
import type { Platform } from "../../../src/platformFromUrl.ts";
import {
  createThreadsClient,
  createThreadsMarketingService,
  threadsMarketingConfigFromEnv,
} from "./threadsMarketing.ts";
import { createThreadsMarketingStore } from "../../../src/threadsMarketingStore.ts";

const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT);
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
await startApi({
  assertMigrations: () => assertMigrationsCurrent(pool),
  start: async () => {
    const seed = adminSeedFromEnv(process.env);
    const config = billingConfigFromEnv(process.env);
    const passwordResetEmailConfig = passwordResetEmailConfigFromEnv(process.env);
    const auth = createJwtAuth(jwtAuthConfigFromEnv(process.env));
    const typesenseConfig = typesenseCatalogConfigFromEnv(process.env);
    const typesenseCatalog = typesenseConfig ? createTypesenseCatalogClient(typesenseConfig) : undefined;
    const typesenseAppCatalog = typesenseConfig
      ? createTypesenseAppCatalogClient({ ...typesenseConfig, collection: TYPESENSE_APP_CATALOG_COLLECTION })
      : undefined;
    const typesenseFlowCatalog = typesenseConfig
      ? createTypesenseFlowCatalogClient({ ...typesenseConfig, collection: TYPESENSE_FLOW_CATALOG_COLLECTION })
      : undefined;
    const typesenseSiteCatalog = typesenseConfig
      ? createTypesenseSiteCatalogClient({ ...typesenseConfig, collection: TYPESENSE_SITE_CATALOG_COLLECTION })
      : undefined;
    const syncTypesenseAppCatalog = async (app: string, platform: Platform): Promise<void> => {
      if (!typesenseAppCatalog) return;
      const document = await publishedAppCatalogDocument(app, platform);
      if (!document) return;
      await typesenseAppCatalog.upsert(document);
      console.log(`[api] Updated Typesense App document ${document.id}.`);
    };
    const referralCampaign = referralCampaignFromEnv(process.env);
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
    void (async () => {
      let failedFlowWarmups = 0;
      for (const platform of ["web", "ios", "android"] as const) {
        try {
          await publishedFlowCatalogPage({
            platform,
            limit: 12,
            sort: "grouped",
            includeFacets: false,
            cursorSecret: config.mediaSigningSecret,
          });
        } catch {
          failedFlowWarmups += 1;
        }
      }
      if (failedFlowWarmups > 0) {
        console.warn(`[api] ${failedFlowWarmups} Flow catalog warmup(s) failed`);
      }
    })();
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
      ...(passwordResetEmailConfig
        ? { passwordResetEmailSender: createPasswordResetEmailSender(passwordResetEmailConfig) }
        : {}),
      ...(typesenseCatalog ? { typesenseCatalog } : {}),
      ...(typesenseAppCatalog ? { typesenseAppCatalog, syncTypesenseAppCatalog } : {}),
      ...(typesenseFlowCatalog ? { typesenseFlowCatalog } : {}),
      ...(typesenseSiteCatalog ? { typesenseSiteCatalog } : {}),
    });
    app.listen(PORT, () => {
      console.log(`[api] listening on :${PORT}`);
    });
    const threadsMarketingConfig = threadsMarketingConfigFromEnv(process.env);
    if (threadsMarketingConfig) {
      const service = createThreadsMarketingService({
        store: createThreadsMarketingStore(query),
        config: threadsMarketingConfig,
        client: createThreadsClient(threadsMarketingConfig),
      });
      let lastAttemptAt = 0;
      const runDueDailyPost = async () => {
        const now = new Date();
        const localClock = new Intl.DateTimeFormat("en-GB", {
          timeZone: threadsMarketingConfig.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).format(now);
        if (localClock < threadsMarketingConfig.dailyTime || now.valueOf() - lastAttemptAt < 15 * 60_000) return;
        lastAttemptAt = now.valueOf();
        const post = await service.publishDaily();
        console.log(`[threads-marketing] ${post.status} ${post.id}`);
      };
      void runDueDailyPost().catch((error) => console.error("[threads-marketing] daily run failed", error));
      setInterval(() => void runDueDailyPost().catch((error) => console.error("[threads-marketing] daily run failed", error)), 60_000).unref();
    }
  },
});
