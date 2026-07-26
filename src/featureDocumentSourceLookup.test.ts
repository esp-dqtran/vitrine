import assert from "node:assert/strict";
import test from "node:test";
import {
  createFeatureDocumentStore,
  type DatabaseQuery,
} from "./featureDocumentStore.ts";

test("resolves a Document Flow by exact source and prefers the owned document", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("source_document_id")) {
      return { rows: [{ source_document_id: 12 }] } as never;
    }
    if (sql.includes("FROM feature_documents d") && sql.includes("WHERE d.id = $1")) {
      return {
        rows: [{
          id: 12,
          title: "Checkout",
          visibility: "private",
          current_revision_id: null,
          source_change_acknowledged_sha256: null,
          revision_source_sha256: null,
          current_source_sha256: null,
        }],
      } as never;
    }
    return { rows: [] } as never;
  };
  const store = createFeatureDocumentStore(query);

  const document = await store.getDocumentBySource(7, {
    app: "linear",
    platform: "web",
    sourceVersionId: 5,
    flowId: "checkout",
  });

  assert.equal(document?.id, 12);
  assert.match(
    calls[0].sql,
    /COALESCE\(r\.source_version_id, latest_job\.source_version_id\) = \$5/,
  );
  assert.match(calls[0].sql, /ORDER BY \(d\.user_id = \$1\) DESC/);
  assert.deepEqual(calls[0].values, [7, "linear", "web", "checkout", 5]);
});
