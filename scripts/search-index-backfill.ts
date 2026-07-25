import { pool } from "../src/db.ts";
import { PostgresSearchIndexStore } from "../src/searchIndexStore.ts";

const store = new PostgresSearchIndexStore(pool);
const [queuedAppPlatforms, queuedSites] = await Promise.all([
  store.enqueueAllPublished(),
  store.enqueueAllReadySites(),
]);
console.log(JSON.stringify({ queuedAppPlatforms, queuedSites }));
await pool.end();
