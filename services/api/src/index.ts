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
import { publishedFlowCatalogDocuments } from "../../../src/typesenseFlowCatalogSource.ts";
import { publishedSiteCatalogDocuments } from "../../../src/typesenseSiteCatalogSource.ts";
import { createSitesStore } from "../../../src/sitesStore.ts";
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
    const typesenseFlowCatalog = typesenseConfig
      ? createTypesenseFlowCatalogClient({ ...typesenseConfig, collection: TYPESENSE_FLOW_CATALOG_COLLECTION })
      : undefined;
    const typesenseSiteCatalog = typesenseConfig
      ? createTypesenseSiteCatalogClient({ ...typesenseConfig, collection: TYPESENSE_SITE_CATALOG_COLLECTION })
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
    let typesenseFlowSync: Promise<void> | undefined;
    const syncTypesenseFlowCatalog = (): Promise<void> => {
      if (typesenseFlowSync) return typesenseFlowSync;
      typesenseFlowSync = (async () => {
        if (typesenseFlowCatalog) {
          const indexed = await typesenseFlowCatalog.index(await publishedFlowCatalogDocuments({
            cursorSecret: config.mediaSigningSecret,
            loadPage: publishedFlowCatalogPage,
          }));
          console.log(`[api] Indexed ${indexed} Typesense Flow documents.`);
        }
      })().finally(() => {
        typesenseFlowSync = undefined;
      });
      return typesenseFlowSync;
    };
    let typesenseSiteSync: Promise<void> | undefined;
    const syncTypesenseSiteCatalog = (): Promise<void> => {
      if (typesenseSiteSync) return typesenseSiteSync;
      typesenseSiteSync = (async () => {
        if (typesenseSiteCatalog) {
          const indexed = await typesenseSiteCatalog.index(
            await publishedSiteCatalogDocuments(createSitesStore()),
          );
          console.log(`[api] Indexed ${indexed} Typesense Site documents.`);
        }
      })().finally(() => {
        typesenseSiteSync = undefined;
      });
      return typesenseSiteSync;
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
      ...(typesenseCatalog ? {
        typesenseCatalog,
        syncTypesenseCatalog,
      } : {}),
      ...(typesenseAppCatalog ? { typesenseAppCatalog, syncTypesenseAppCatalog } : {}),
      ...(typesenseFlowCatalog ? { typesenseFlowCatalog, syncTypesenseFlowCatalog } : {}),
      ...(typesenseSiteCatalog ? { typesenseSiteCatalog } : {}),
    });
    app.listen(PORT, () => {
      console.log(`[api] listening on :${PORT}`);
      // Rebuild through an alias swap so a schema change (such as Flow platform
      // and tag facets) never leaves the live search collection half-updated.
      if (typesenseCatalog) {
        void syncTypesenseCatalog().catch((error) => {
          console.warn(`[api] Typesense catalog reindex failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      if (typesenseSiteCatalog) {
        void syncTypesenseSiteCatalog().catch((error) => {
          console.warn(`[api] Typesense Site reindex failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      if (typesenseFlowCatalog) {
        void syncTypesenseFlowCatalog().catch((error) => {
          console.warn(`[api] Typesense Flow reindex failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
    });
  },
});
