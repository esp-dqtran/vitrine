import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import type { ObjectMetadata } from "./objectStore.ts";
import { createSitesStore, type DatabaseQuery } from "./sitesStore.ts";

const identity = {
  canonicalUrl:
    "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
  sourceSiteId: "v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09",
  sourceVersionId: "f4e176f7-aeb6-4f9a-9689-e4379fc357b1",
};

const graph = {
  site: {
    sourceId: "1fbe80df-2586-4a09-aa5c-29aeeb716a09",
    name: "V7",
    slug: identity.sourceSiteId,
    sourceUrl: "https://v7labs.com/",
  },
  version: {
    sourceId: identity.sourceVersionId,
    label: "Jul 2026",
    isLatest: true,
    previewVideoUrl: "https://cdn.fixture/preview.mp4",
  },
  pages: [{
    sourceId: "page-1",
    title: "Home",
    url: "https://v7labs.com/",
    position: 0,
    fullPageImageUrl: "https://cdn.fixture/page.png",
    sections: [{
      sourceId: "section-1",
      position: 0,
      mediaKind: "image" as const,
      mediaUrl: "https://cdn.fixture/page.png",
      cropTop: 0,
      cropBottom: 800,
      ocrBoxes: [],
    }],
  }],
};

function result(
  rows: Array<Record<string, unknown>> = [],
  rowCount = rows.length,
): QueryResult<Record<string, unknown>> {
  return { rows, rowCount, command: "", oid: 0, fields: [] };
}

test("loads only ready versions", async () => {
  const capturedSql: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql) => {
    capturedSql.push(sql);
    return result();
  };
  const store = createSitesStore(fakeQuery);

  await store.listReadySites();
  await store.readyVersionByCanonicalUrl(identity.canonicalUrl);
  await store.readyVersionDetail(1, 2);

  assert.match(capturedSql[0], /sv\.status = 'ready'/);
  assert.match(capturedSql[1], /sv\.status = 'ready'/);
  assert.match(capturedSql[2], /sv\.status = 'ready'/);
});

test("returns only authenticated API media paths in ready Site views", async () => {
  const fakeQuery: DatabaseQuery = async (sql) => {
    if (/SELECT s\.id AS site_id, sv\.id AS version_id, s\.name/.test(sql)) {
      return result([{
        site_id: 1,
        version_id: 2,
        name: "V7",
        slug: graph.site.slug,
        source_url: graph.site.sourceUrl,
        canonical_url: identity.canonicalUrl,
        label: graph.version.label,
        is_latest: true,
      }]);
    }
    if (/SELECT sp\.id, sp\.source_page_id/.test(sql)) {
      return result([{ id: 3, source_page_id: "page-1", title: "Home", page_url: graph.pages[0].url, position: 0 }]);
    }
    if (/SELECT ss\.id, ss\.page_id/.test(sql)) {
      return result([{
        id: 4,
        page_id: 3,
        source_section_id: "section-1",
        position: 0,
        media_kind: "video",
        poster_object_key: "sites/poster.webp",
        crop_top: null,
        crop_bottom: null,
        video_start_seconds: 1,
        video_end_seconds: 2,
        ocr_boxes: [],
        source_metadata: {},
      }]);
    }
    return result();
  };

  const view = await createSitesStore(fakeQuery).readyVersionDetail(1, 2);
  assert.equal(view?.previewUrl, "/api/sites/1/versions/2/media/preview");
  assert.equal(view?.pages[0].fullPageImageUrl, "/api/sites/1/versions/2/pages/3/media");
  assert.equal(view?.pages[0].sections[0].mediaUrl, "/api/sites/1/versions/2/sections/4/media");
  assert.equal(view?.pages[0].sections[0].posterUrl, "/api/sites/1/versions/2/sections/4/poster");
});

test("media resolution is scoped to one ready Site version", async () => {
  const capturedSql: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql) => {
    capturedSql.push(sql);
    return result();
  };
  const store = createSitesStore(fakeQuery);

  await store.siteMediaObject({
    siteId: 1,
    versionId: 2,
    kind: "section",
    recordId: 3,
  });

  assert.match(
    capturedSql.at(-1)!,
    /s\.id = \$1[\s\S]+sv\.id = \$2[\s\S]+sv\.status = 'ready'/,
  );
  assert.match(capturedSql.at(-1)!, /ss\.id = \$3/);
});

test("beginImport resets only a non-ready version to importing", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/INSERT INTO sites/.test(sql)) return result([{ id: 1 }]);
    if (/INSERT INTO site_versions/.test(sql)) return result([{ id: 2 }]);
    return result();
  };

  const created = await createSitesStore(fakeQuery).beginImport(identity, graph);

  assert.deepEqual(created, { siteId: 1, versionId: 2 });
  const versionUpsert = calls.find((call) => /INSERT INTO site_versions/.test(call.sql));
  assert.match(versionUpsert!.sql, /status = CASE[\s\S]+status = 'ready'/);
  assert.match(versionUpsert!.sql, /ELSE 'importing'/);
});

test("completeImport writes object metadata and graph before the final ready transition", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  let pageId = 10;
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/FOR UPDATE/.test(sql)) {
      return result([{ site_id: 1, version_id: 2, status: "importing" }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: values?.[0] }]);
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: pageId++ }]);
    if (/INSERT INTO site_sections/.test(sql)) return result([{ id: 20 }]);
    if (/page_count/.test(sql) && /section_count/.test(sql)) {
      return result([{ page_count: 1, section_count: 1 }]);
    }
    if (/UPDATE site_versions/.test(sql) && /status = 'ready'/.test(sql)) {
      return result([{ id: 2 }]);
    }
    return result();
  };
  const objects: ObjectMetadata[] = [
    metadata("sites/source.json", "application/json"),
    metadata("sites/preview.png", "image/png"),
    metadata("sites/page.png", "image/png"),
    metadata("sites/section.png", "image/png"),
  ];

  const completed = await createSitesStore(fakeQuery).completeImport({
    identity,
    graph,
    objectKeys: {
      source: "sites/source.json",
      preview: "sites/preview.png",
      pages: { "page-1": "sites/page.png" },
      sections: { "section-1": { media: "sites/section.png" } },
    },
  }, objects);

  assert.deepEqual(completed, { siteId: 1, versionId: 2 });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1)!.sql, "COMMIT");
  const readyIndex = calls.findIndex((call) => /status = 'ready'/.test(call.sql));
  const sectionIndex = calls.findIndex((call) => /INSERT INTO site_sections/.test(call.sql));
  assert.ok(readyIndex > sectionIndex);
});

test("completeImport rolls back when persisted counts do not match", async () => {
  const calls: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) {
      return result([{ site_id: 1, version_id: 2, status: "importing" }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: values?.[0] }]);
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: 10 }]);
    if (/INSERT INTO site_sections/.test(sql)) return result([{ id: 20 }]);
    if (/page_count/.test(sql) && /section_count/.test(sql)) {
      return result([{ page_count: 1, section_count: 0 }]);
    }
    return result();
  };

  await assert.rejects(
    createSitesStore(fakeQuery).completeImport({
      identity,
      graph,
      objectKeys: {
        source: "sites/source.json",
        preview: "sites/preview.png",
        pages: { "page-1": "sites/page.png" },
        sections: { "section-1": { media: "sites/section.png" } },
      },
    }, [
      metadata("sites/source.json", "application/json"),
      metadata("sites/preview.png", "image/png"),
      metadata("sites/page.png", "image/png"),
      metadata("sites/section.png", "image/png"),
    ]),
    /persisted Site graph count mismatch/i,
  );
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.doesNotMatch(calls.join("\n"), /status = 'ready'/);
});

function metadata(
  key: string,
  contentType: ObjectMetadata["contentType"],
): ObjectMetadata {
  return {
    key,
    sha256: "a".repeat(64),
    byteSize: 10,
    contentType,
    accessClass: "protected",
  };
}
