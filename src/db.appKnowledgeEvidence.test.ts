import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import { appKnowledgeEvidenceSource } from "./db.ts";

test("loads one complete app/platform/version evidence source in one constrained query", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const source = await appKnowledgeEvidenceSource(
    { app: "Alpha", platform: "web", versionNumber: 3 },
    async (sql, values) => {
      calls.push({ sql, values });
      return {
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [{
          app_id: 11,
          app: "Alpha",
          platform_id: 22,
          platform: "web",
          version_id: 33,
          version_number: 3,
          images: [{
            id: 44,
            app: "Alpha",
            platform: "web",
            image_url: "capture:44",
            kind: "screen",
            description: null,
            object: {
              key: "images/44/a.png",
              sha256: "a".repeat(64),
              byteSize: 10,
              contentType: "image/png",
              accessClass: "protected",
            },
          }],
          flows: [],
        }],
      } as QueryResult<Record<string, unknown>>;
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, ["Alpha", "web", 3]);
  assert.match(calls[0].sql, /a\.name = \$1/);
  assert.match(calls[0].sql, /av\.platform = \$2/);
  assert.match(calls[0].sql, /av\.version_number = \$3/);
  assert.match(calls[0].sql, /vi\.version_id = selected\.version_id/);
  assert.match(calls[0].sql, /i\.platform_id = selected\.platform_id/);
  assert.match(calls[0].sql, /i\.kind IN \('screen', 'flow_step', 'ui_element'\)/);
  assert.deepEqual(source, {
    appId: 11,
    app: "Alpha",
    platformId: 22,
    platform: "web",
    versionId: 33,
    versionNumber: 3,
    images: [{
      id: 44,
      app: "Alpha",
      platform: "web",
      image_url: "capture:44",
      kind: "screen",
      description: null,
      object: {
        key: "images/44/a.png",
        sha256: "a".repeat(64),
        byteSize: 10,
        contentType: "image/png",
        accessClass: "protected",
      },
    }],
    flows: [],
  });
});

test("returns undefined when the exact capture version does not exist", async () => {
  const source = await appKnowledgeEvidenceSource(
    { app: "Missing", platform: "ios", versionNumber: 9 },
    async () => ({
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
      rows: [],
    }),
  );
  assert.equal(source, undefined);
});
