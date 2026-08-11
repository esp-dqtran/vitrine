// Maintenance command for a dedicated indexer process. Do not call this from
// the serving API: each full rebuild reads and serializes the complete catalog.
import { billingConfigFromEnv } from "../services/api/src/config.ts";
import { closePool, publishedCatalogSearchSource } from "../src/db.ts";
import { publishedFlowCatalogPage } from "../src/flowCatalogStore.ts";
import { createSitesStore } from "../src/sitesStore.ts";
import { createTypesenseCatalogClient, typesenseCatalogConfigFromEnv } from "../src/typesenseCatalog.ts";
import { TYPESENSE_FLOW_CATALOG_COLLECTION, createTypesenseFlowCatalogClient } from "../src/typesenseFlowCatalog.ts";
import { publishedFlowCatalogDocuments } from "../src/typesenseFlowCatalogSource.ts";
import { TYPESENSE_SITE_CATALOG_COLLECTION, createTypesenseSiteCatalogClient } from "../src/typesenseSiteCatalog.ts";
import { publishedSiteCatalogDocuments } from "../src/typesenseSiteCatalogSource.ts";

const typesense = typesenseCatalogConfigFromEnv(process.env);
if (!typesense) {
  throw new Error("TYPESENSE_SEARCH_ENABLED=true plus Typesense credentials are required");
}

const billing = billingConfigFromEnv(process.env);

try {
  const catalog = createTypesenseCatalogClient(typesense);
  const catalogDocuments = await catalog.index(await publishedCatalogSearchSource());
  console.log(`[typesense-rebuild] Indexed ${catalogDocuments} research documents.`);

  const sites = createTypesenseSiteCatalogClient({
    ...typesense,
    collection: TYPESENSE_SITE_CATALOG_COLLECTION,
  });
  const siteDocuments = await sites.index(await publishedSiteCatalogDocuments(createSitesStore()));
  console.log(`[typesense-rebuild] Indexed ${siteDocuments} Site documents.`);

  const flows = createTypesenseFlowCatalogClient({
    ...typesense,
    collection: TYPESENSE_FLOW_CATALOG_COLLECTION,
  });
  const flowDocuments = await flows.index(await publishedFlowCatalogDocuments({
    cursorSecret: billing.mediaSigningSecret,
    loadPage: publishedFlowCatalogPage,
  }));
  console.log(`[typesense-rebuild] Indexed ${flowDocuments} Flow documents.`);
} finally {
  await closePool();
}
