import { createApiApp, DEFAULT_API_PORT } from "./app.ts";
import { adminSeedFromEnv } from "./config.ts";
import { seedAdmin } from "../../../src/authStore.ts";

const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT);
const seed = adminSeedFromEnv(process.env);
await seedAdmin(seed.email, seed.password);
createApiApp().listen(PORT, () => console.log(`[api] listening on :${PORT}`));
