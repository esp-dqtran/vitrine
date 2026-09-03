import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPublishedScreenSearch,
  screenSearchTermGroups,
  screenSearchTsQueries,
  type PublishedScreenSearchResult,
} from "./flowScreenSearchStore.ts";

test("screen search terms remove generic wording and expand common product intents", () => {
  assert.deepEqual(screenSearchTermGroups("Login screen with email and password"), [
    ["login", "log in", "signin", "sign in"],
    ["email"],
    ["password"],
  ]);
  assert.deepEqual(screenSearchTermGroups("checkout page showing a promo code field"), [
    ["checkout", "check out", "payment", "place order"],
    ["promo"],
    ["code"],
    ["field"],
  ]);
  assert.deepEqual(screenSearchTsQueries("Login screen with email and password"), {
    strict: "(login:* | log:* | signin:* | sign:*) & (email:*) & (password:*)",
    broad: "(login:* | log:* | signin:* | sign:*) | (email:*) | (password:*)",
    groups: [
      "(login:* | log:* | signin:* | sign:*)",
      "(email:*)",
      "(password:*)",
    ],
  });
});

test("published screen search is bounded to the latest published screen evidence", async () => {
  let statement = "";
  let values: unknown[] | undefined;
  const row = {
    id: 12,
    app: "linear",
    app_name: "Linear",
    platform: "web",
    image_url: "capture:0123456789abcdef",
    description: "Sign in form",
    flow_id: "logging-in",
    flow_title: "Logging in",
    flow_step_index: 1,
    flow_step_label: "Enter email",
    matched_term_count: 3,
  } satisfies PublishedScreenSearchResult;
  const search = createPublishedScreenSearch(async <R>(sql: string, params?: unknown[]) => {
    statement = sql;
    values = params;
    return { rows: [row] as R[] };
  });

  const result = await search({
    query: "login screen with email and password",
    platform: "web",
    limit: 500,
  });

  assert.deepEqual(result, [row]);
  assert.match(statement, /av\.status = 'published'/);
  assert.match(statement, /image\.kind = 'screen'/);
  assert.match(statement, /JOIN version_images version_image ON version_image\.version_id = latest\.version_id/);
  assert.match(statement, /LEFT JOIN LATERAL/);
  assert.doesNotMatch(statement, /image\.kind = 'ui_element'|image\.kind = 'flow_step'/);
  assert.match(statement, /JOIN published_screen_search_documents search_document/);
  assert.match(statement, /search_document\.search_vector @@ search_query\.broad_query/);
  assert.match(statement, /ts_rank_cd\(search_document\.search_vector/);
  assert.equal(values?.[0], screenSearchTsQueries("login screen with email and password")?.strict);
  assert.equal(values?.[1], screenSearchTsQueries("login screen with email and password")?.broad);
  assert.deepEqual(values?.[2], screenSearchTsQueries("login screen with email and password")?.groups);
  assert.equal(values?.[3], "web");
  assert.equal(values?.[4], 2);
  assert.equal(values?.[5], 100);
});

test("deep screen search requires every meaningful query concept", async () => {
  let values: unknown[] | undefined;
  const search = createPublishedScreenSearch(async <R>(_sql: string, params?: unknown[]) => {
    values = params;
    return { rows: [] as R[] };
  });

  await search({
    query: "login screen with email and password",
    platform: "web",
    mode: "deep",
    limit: 6,
  });

  assert.equal(values?.[4], 3);
});
