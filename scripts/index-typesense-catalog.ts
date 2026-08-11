import { publishedCatalogSearchSource } from "../src/db.ts";
import { catalogSearchItems } from "../src/catalogResearch.ts";
import {
  createTypesenseCatalogClient,
  typesenseCatalogConfigFromEnv,
} from "../src/typesenseCatalog.ts";

const config = typesenseCatalogConfigFromEnv(process.env);
if (!config) throw new Error("Set TYPESENSE_SEARCH_ENABLED=true before indexing Typesense");

const source = await publishedCatalogSearchSource();
const documentCount = catalogSearchItems(source).length;

if (!process.argv.includes("--apply")) {
  console.log(`Typesense plan: ${documentCount} catalog documents. Re-run with --apply to write.`);
  process.exit(0);
}

const indexed = await createTypesenseCatalogClient(config).index(source);
console.log(`Indexed ${indexed} Typesense catalog documents.`);
