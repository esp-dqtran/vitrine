import { pool } from "../src/db.ts";
import { PostgresSearchIndexStore } from "../src/searchIndexStore.ts";

const store = new PostgresSearchIndexStore(pool);
const count = await store.enqueueAllPublished();
console.log(JSON.stringify({ queuedAppPlatforms: count }));
await pool.end();
