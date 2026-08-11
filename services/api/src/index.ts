import { createApiApp, DEFAULT_API_PORT } from "./app.ts";
import { adminSeedFromEnv, billingConfigFromEnv, referralCampaignFromEnv } from "./config.ts";
import { startApi } from "./start.ts";
import { seedAdmin } from "../../../src/authStore.ts";
import {
  pool,
  publishedCatalogSearchSource,
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
import { createTypesenseCatalogClient, typesenseCatalogConfigFromEnv } from "../../../src/typesenseCatalog.ts";
import {
  TYPESENSE_APP_CATALOG_COLLECTION,
  createTypesenseAppCatalogClient,
} from "../../../src/typesenseAppCatalog.ts";
import {
  publishedAppCatalogDocument,
} from "../../../src/typesenseAppCatalogSource.ts";
import type { Platform } from "../../../src/platformFromUrl.ts";

const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT);
const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
await startApi({
  assertMigrations: () => assertMigrationsCurrent(pool),
  start: async () => {
    const seed = adminSeedFromEnv(process.env);
    const config = billingConfigFromEnv(process.env);
    const auth = createJwtAuth(jwtAuthConfigFromEnv(process.env));
    const typesenseConfig = typesenseCatalogConfigFromEnv(process.env);
    const typesenseCatalog = typesenseConfig ? createTypesenseCatalogClient(typesenseConfig) : undefined;
    const typesenseAppCatalog = typesenseConfig
      ? createTypesenseAppCatalogClient({ ...typesenseConfig, collection: TYPESENSE_APP_CATALOG_COLLECTION })
      : undefined;
    let typesenseSync: Promise<void> | undefined;
    const syncTypesenseCatalog = (): Promise<void> => {
      if (typesenseSync) return typesenseSync;
      typesenseSync = (async () => {
      if (typesenseCatalog) {
        const indexed = await typesenseCatalog.index(await publishedCatalogSearchSource());
        console.log(`[api] Indexed ${indexed} Typesense research documents.`);
      }
      })().finally(() => {
        typesenseSync = undefined;
      });
      return typesenseSync;
    };
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
    void Promise.allSettled(
      (["web", "ios", "android"] as const).map((platform) =>
        publishedFlowCatalogPage({
          platform,
          limit: 12,
          sort: "popular",
          includeFacets: false,
          cursorSecret: config.mediaSigningSecret,
        })
      ),
    ).then((flowWarmups) => {
      const failedFlowWarmups = flowWarmups.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failedFlowWarmups > 0) {
        console.warn(`[api] ${failedFlowWarmups} Flow catalog warmup(s) failed`);
      }
    });
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
      ...(typesenseCatalog ? {
        typesenseCatalog,
        syncTypesenseCatalog,
      } : {}),
      ...(typesenseAppCatalog ? { typesenseAppCatalog, syncTypesenseAppCatalog } : {}),
    });
    app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
  },
});
