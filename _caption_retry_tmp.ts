import { caption } from "./src/caption.ts";
import { imageObjectById } from "./src/objectStoreDb.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "./src/objectStoreConfig.ts";

const APP = "usa-today";
const PROVIDER = "chatgpt";

async function main() {
  const objectStore = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const t0 = Date.now();
  console.log(`[caption retry 3, with JSON-retry fix] starting for ${APP} @ ${new Date(t0).toISOString()}`);
  const outcome = await caption(PROVIDER, undefined, APP, {
    objectStore,
    resolveObjectMetadata: (image) => imageObjectById(image.id),
  });
  const t1 = Date.now();
  console.log(`[caption retry 3] done in ${((t1 - t0) / 1000).toFixed(1)}s — outcome:`, outcome);
  process.exit(outcome.status === "done" ? 0 : 1);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
