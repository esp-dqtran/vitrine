import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueryResult } from "pg";
import type { ObjectMetadata } from "./objectStore.ts";
import { createPublicPageStore, type DatabaseQuery } from "./publicPageStore.ts";
import type { PublicPageCapture } from "./publicPage.ts";

const capture: PublicPageCapture = {
  requestedUrl: "https://example.com/pricing",
  canonicalUrl: "https://example.com/pricing",
  metadata: {
    name: "Example",
    description: "Pricing plans",
    category: "Website",
    accent: "#112233",
    iconUrl: "https://example.com/icon.png",
  },
  viewport: { width: 1440, height: 900 },
  document: { width: 1440, height: 1800 },
  html: "<html></html>",
  sections: [
    { position: 0, selector: "main > section", tagName: "section", heading: "Hero", text: "Hero", bounds: { x: 0, y: 0, width: 1440, height: 900 } },
    { position: 1, selector: "footer", tagName: "footer", heading: "Footer", text: "Footer", bounds: { x: 0, y: 900, width: 1440, height: 900 } },
  ],
};

const contentHash = "a".repeat(64);

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length): QueryResult<Record<string, unknown>> {
  return { rows, rowCount, command: "", oid: 0, fields: [] };
}

function metadata(key: string, contentType: ObjectMetadata["contentType"]): ObjectMetadata {
  return { key, sha256: "b".repeat(64), byteSize: 10, contentType, accessClass: contentType === "application/json" ? "internal" : "protected" };
}

test("beginCapture preserves curated App metadata and reuses one ready content hash", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/INSERT INTO apps/.test(sql)) return result([{ id: 1, name: "example-com" }]);
    if (/INSERT INTO web_pages/.test(sql)) return result([{ id: 2 }]);
    if (/status = 'ready'/.test(sql)) return result([{ id: 3 }]);
    return result();
  };

  const begun = await createPublicPageStore(query).beginCapture(capture, contentHash);

  assert.deepEqual(begun, { reused: true, app: "example-com", pageId: 2, versionId: 3 });
  assert.match(calls[1].sql, /COALESCE\(apps\.display_name/);
  assert.equal(calls.some(({ sql }) => /INSERT INTO web_page_versions/.test(sql)), false);
});

test("beginCapture creates a new importing immutable version", async () => {
  const query: DatabaseQuery = async (sql) => {
    if (/INSERT INTO apps/.test(sql)) return result([{ id: 1, name: "example-com" }]);
    if (/INSERT INTO web_pages/.test(sql)) return result([{ id: 2 }]);
    if (/SELECT id[\s\S]+status = 'ready'/.test(sql)) return result();
    if (/INSERT INTO web_page_versions/.test(sql)) return result([{ id: 4 }]);
    return result();
  };

  assert.deepEqual(await createPublicPageStore(query).beginCapture(capture, contentHash), {
    reused: false,
    app: "example-com",
    appId: 1,
    pageId: 2,
    versionId: 4,
    contentHash,
    capture,
  });
});

test("completeCapture persists Screen and ordered UI Element evidence before ready", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  let imageId = 10;
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/INSERT INTO platforms/.test(sql)) return result([{ id: 5 }]);
    if (/INSERT INTO app_versions/.test(sql)) return result([{ id: 6 }]);
    if (/INSERT INTO images/.test(sql)) return result([{ id: imageId++ }]);
    if (/SELECT count\(\*\).*web_page_sections/s.test(sql)) return result([{ count: "2" }]);
    if (/UPDATE web_page_versions[\s\S]+status = 'ready'/.test(sql)) return result([{ id: 4 }]);
    return result([], 1);
  };
  const store = createPublicPageStore(query);
  const objects = [
    metadata("public-pages/domain/captures/hash/source/source/source.json", "application/json"),
    metadata("public-pages/domain/captures/hash/preview/page/video.webm", "video/webm"),
    metadata("public-pages/domain/captures/hash/page/page/page.png", "image/png"),
    metadata("public-pages/domain/captures/hash/section/0/one.png", "image/png"),
    metadata("public-pages/domain/captures/hash/section/1/two.png", "image/png"),
  ];

  const completed = await store.completeCapture(
    { reused: false, app: "example-com", appId: 1, pageId: 2, versionId: 4, contentHash, capture },
    {
      source: objects[0].key,
      preview: objects[1].key,
      page: { objectKey: objects[2].key, imageRef: "capture:1111111111111111" },
      sections: [
        { position: 0, objectKey: objects[3].key, imageRef: "capture:ui_element:1111111111111111:0" },
        { position: 1, objectKey: objects[4].key, imageRef: "capture:ui_element:1111111111111111:1" },
      ],
    },
    objects,
  );

  assert.deepEqual(completed, { app: "example-com", pageId: 2, versionId: 4, sectionCount: 2 });
  const imageKinds = calls.filter(({ sql }) => /INSERT INTO images/.test(sql)).map(({ values }) => values?.[2]);
  assert.deepEqual(imageKinds, ["screen", "ui_element", "ui_element"]);
  assert.deepEqual(calls.filter(({ sql }) => /INSERT INTO web_page_sections/.test(sql)).map(({ values }) => values?.[1]), [0, 1]);
  const readyIndex = calls.findIndex(({ sql }) => /UPDATE web_page_versions[\s\S]+status = 'ready'/.test(sql));
  const sectionIndex = calls.map(({ sql }) => sql).lastIndexOf(calls.find(({ sql }) => /INSERT INTO web_page_sections/.test(sql))?.sql ?? "");
  assert.ok(readyIndex > sectionIndex);
});

test("completeCapture rolls back before ready when section counts differ", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/INSERT INTO platforms/.test(sql)) return result([{ id: 5 }]);
    if (/INSERT INTO app_versions/.test(sql)) return result([{ id: 6 }]);
    if (/INSERT INTO images/.test(sql)) return result([{ id: 10 + calls.length }]);
    if (/SELECT count\(\*\).*web_page_sections/s.test(sql)) return result([{ count: "1" }]);
    return result([], 1);
  };
  const store = createPublicPageStore(query);
  const objects = [
    metadata("public-pages/domain/captures/hash/source/source/source.json", "application/json"),
    metadata("public-pages/domain/captures/hash/preview/page/video.webm", "video/webm"),
    metadata("public-pages/domain/captures/hash/page/page/page.png", "image/png"),
    metadata("public-pages/domain/captures/hash/section/0/one.png", "image/png"),
    metadata("public-pages/domain/captures/hash/section/1/two.png", "image/png"),
  ];

  await assert.rejects(store.completeCapture(
    { reused: false, app: "example-com", appId: 1, pageId: 2, versionId: 4, contentHash, capture },
    {
      source: objects[0].key,
      preview: objects[1].key,
      page: { objectKey: objects[2].key, imageRef: "capture:1111111111111111" },
      sections: [
        { position: 0, objectKey: objects[3].key, imageRef: "capture:ui_element:1111111111111111:0" },
        { position: 1, objectKey: objects[4].key, imageRef: "capture:ui_element:1111111111111111:1" },
      ],
    },
    objects,
  ), /section count/i);
  assert.equal(calls.some((sql) => /status = 'ready'/.test(sql)), false);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("preview lookup is App-scoped and can require published evidence", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const preview = metadata("public-pages/example.com/version/preview.webm", "video/webm");
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{
      object_key: preview.key,
      sha256: preview.sha256,
      byte_size: preview.byteSize,
      content_type: preview.contentType,
      access_class: preview.accessClass,
    }]);
  };
  const store = createPublicPageStore(query);

  assert.deepEqual(await store.previewObject("example-com", 71, true), preview);
  assert.match(calls[0].sql, /a\.name = \$1 AND wpv\.id = \$2/);
  assert.match(calls[0].sql, /av\.status = 'published'/);
  assert.deepEqual(calls[0].values, ["example-com", 71, true]);
});
