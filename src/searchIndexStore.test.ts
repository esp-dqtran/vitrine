import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresSearchIndexStore } from "./searchIndexStore.ts";
import { projectSiteSearchDocuments } from "./siteSearchProjection.ts";

test("claims a ready Site job after the App queue is empty", async () => {
  const client = {
    async query(text: string) {
      if (text.includes("FROM search_index_queue")) return { rows: [], rowCount: 0 };
      if (text.includes("FROM site_search_index_queue")) {
        return { rows: [{ site_id: 7, attempts: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query() { return { rows: [], rowCount: 0 }; },
  };

  const job = await new PostgresSearchIndexStore(pool as never).claim("worker-1");

  assert.deepEqual(job, {
    kind: "site",
    siteId: 7,
    attempts: 1,
    workerId: "worker-1",
  });
});

test("replaces only the selected Site scope and writes generic catalog identity", async () => {
  const queries: Array<{ text: string; params?: unknown[] }> = [];
  const client = {
    async query(text: string, params?: unknown[]) {
      queries.push({ text, params });
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query(text: string, params?: unknown[]) {
      queries.push({ text, params });
      return { rows: [], rowCount: 0 };
    },
  };
  const store = new PostgresSearchIndexStore(pool as never);
  const documents = projectSiteSearchDocuments({
    site: {
      id: 7,
      versionId: 11,
      name: "V7",
      description: "Visual data platform",
      categories: ["Business"],
      styles: ["Minimal"],
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
    pages: [{ title: "Pricing", sectionPatterns: ["Hero"] }],
  });

  await store.replaceDocuments(
    { kind: "site", siteId: 7, indexVersion: 1 },
    documents,
  );

  const deletion = queries.find(({ text }) => text.includes("DELETE FROM search_documents"));
  assert.match(deletion?.text ?? "", /catalog_scope = 'sites' AND site_id = \$1/);
  assert.deepEqual(deletion?.params, [7, 1]);
  const insertion = queries.find(({ text }) => text.includes("INSERT INTO search_documents"));
  assert.match(insertion?.text ?? "", /catalog_scope, catalog_name/);
  assert.match(insertion?.text ?? "", /site_sections, site_styles/);
  assert.doesNotMatch(deletion?.text ?? "", /app_id =/);
});
