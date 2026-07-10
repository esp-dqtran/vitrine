import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_URL = "postgres://postgres:postgres@localhost:5432/astryx_test";

async function ensureTestDb(): Promise<string | undefined> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    return "Postgres not running — docker compose up -d postgres";
  }
  try {
    await client.query("CREATE DATABASE astryx_test");
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // 42P04 = already exists
  } finally {
    await client.end();
  }
  return undefined;
}

const skipReason = await ensureTestDb();

test("insert, list uncaptioned, then save description", { skip: skipReason }, async () => {
  process.env.DATABASE_URL = TEST_URL;
  const {
    insertImage,
    uncaptionedImages,
    saveDescription,
    saveScreenAnalysis,
    appImages,
    saveAppFlows,
    getAppFlows,
    saveDesignSystem,
    getDesignSystem,
    query,
    closePool,
  } = await import("./db.ts");

  for (const table of ["subscriptions", "free_app_unlocks", "stripe_events", "export_usage", "access_events"]) {
    const result = await query<{ name: string | null }>("SELECT to_regclass($1) AS name", [table]);
    assert.equal(result.rows[0].name, table);
  }

  await query("TRUNCATE app_flows, design_systems, apps, platforms, images RESTART IDENTITY CASCADE");

  await insertImage("airbnb", "web", "https://cdn.example.com/a.png");
  await insertImage("airbnb", "web", "https://cdn.example.com/a.png"); // duplicate image_url, ignored
  await insertImage("airbnb", "ios", "https://cdn.example.com/b.png");
  await insertImage("linear", "web", "https://cdn.example.com/linear.png");

  // Two apps, three platforms, three images — duplicate URLs are still ignored.
  assert.equal((await query("SELECT 1 FROM apps")).rowCount, 2);
  assert.equal((await query("SELECT 1 FROM platforms")).rowCount, 3);

  const airbnbPending = await uncaptionedImages("airbnb");
  assert.equal(airbnbPending.length, 2);
  assert.ok(airbnbPending.every((image) => image.app === "airbnb"));

  const allPending = await uncaptionedImages();
  assert.equal(allPending.length, 3);
  for (const image of allPending) {
    await saveDescription(image.id, `Caption for ${image.app}`);
  }
  assert.equal((await uncaptionedImages()).length, 0);

  await saveScreenAnalysis(1, {
    description: "Airbnb login",
    purpose: "Authenticate an existing guest",
    pageType: "Login",
    productArea: "Authentication",
    theme: "light",
    visibleStates: ["default"],
    componentNames: ["Text input", "Primary button"],
  });
  assert.equal((await appImages("airbnb"))[0].analysis?.pageType, "Login");

  await saveAppFlows("airbnb", [{
    id: "login",
    title: "Login",
    description: "Authenticate with email",
    tags: ["Authentication"],
    steps: [
      { label: "Enter email", evidence: [1] },
      { label: "Enter password", evidence: [2] },
    ],
  }]);
  assert.deepEqual((await getAppFlows("airbnb"))[0].steps.map((step) => step.evidence[0]), [1, 2]);

  await saveAppFlows("airbnb", []);
  assert.deepEqual(await getAppFlows("airbnb"), []);

  await saveDesignSystem("airbnb", {
    app: "airbnb",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#FF5A5F", role: "primary action", evidence: [1] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#FF5A5F");

  await saveDesignSystem("airbnb", {
    app: "airbnb",
    generatedAt: "2026-07-10T01:00:00.000Z",
    tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#E31C5F", role: "primary action", evidence: [1] }],
    components: [],
    flows: [],
  });
  assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#E31C5F");

  await closePool();
});
