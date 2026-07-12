import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tabUrl, mergeFlows, ingestDownloadedImages } from "./bulkDownload.ts";
import type { DesignFlow } from "./designSystem.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

test("tabUrl swaps or appends the tab segment", () => {
  const base = "https://mobbin.com/apps/linear-ios-1234/abcd/screens";
  assert.equal(tabUrl(base, "ui-elements"), "https://mobbin.com/apps/linear-ios-1234/abcd/ui-elements");
  assert.equal(tabUrl(base, "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd/flows", "screens"), base);
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd", "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
});

test("mergeFlows replaces by id and keeps the rest", () => {
  const flow = (id: string, title: string): DesignFlow => ({ id, title, description: "d", tags: [], steps: [{ label: "Step 1", evidence: [1] }] });
  const merged = mergeFlows([flow("a", "old"), flow("b", "keep")], [flow("a", "new"), flow("c", "added")]);
  assert.deepEqual(merged.map(({ id, title }) => `${id}:${title}`), ["a:new", "b:keep", "c:added"]);
});

test("bulk ingestion uploads verified bytes before attaching the image", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-objects-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "nested", "screen.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
  const events: string[] = [];
  let uploaded: ObjectMetadata | undefined;
  const store = {
    put: async (input: ObjectMetadata & { body: Uint8Array }) => {
      events.push("put"); uploaded = input; return { created: true, metadata: input };
    },
  } as unknown as ObjectStore;
  const result = await ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear", null, "screen", {
    objectStore: store,
    insertImage: async (_app, _platform, reference) => { events.push(`insert:${reference}`); return 17; },
    attachImage: async (imageId, metadata) => {
      events.push(`attach:${imageId}`);
      const { body: _body, ...expected } = uploaded! as ObjectMetadata & { body: Uint8Array };
      assert.deepEqual(metadata, expected);
    },
  });
  assert.deepEqual(events.map((event) => event.split(":")[0]), ["insert", "put", "attach"]);
  assert.equal(result.imported, 1);
  assert.deepEqual(result.imageIds, [17]);
  assert.match(uploaded!.key, /^images\/17\/[0-9a-f]{64}\.png$/);
  assert.equal(uploaded!.contentType, "image/png");
  assert.equal(uploaded!.accessClass, "protected");
});

test("bulk upload failure leaves no usable object association", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-failure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "screen.webp"), Buffer.from("RIFF\x04\x00\x00\x00WEBP", "latin1"));
  let attached = false;
  await assert.rejects(ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear", null, "screen", {
    objectStore: { put: async () => { throw new Error("storage unavailable"); } } as unknown as ObjectStore,
    insertImage: async () => 18,
    attachImage: async () => { attached = true; },
  }), /storage unavailable/);
  assert.equal(attached, false);
});

test("bulk ingestion rejects image bytes that do not match the filename type", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-mime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "screen.png"), Buffer.from([0xff, 0xd8, 0xff, 0x00]));
  let inserted = false;
  await assert.rejects(ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear", null, "screen", {
    objectStore: {} as ObjectStore,
    insertImage: async () => { inserted = true; return 19; },
    attachImage: async () => {},
  }), /does not match image\/png/);
  assert.equal(inserted, false);
});

test("bulk ingestion rejects mismatched adapter metadata before attachment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-metadata-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "screen.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00]));
  let attached = false;
  await assert.rejects(ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear", null, "screen", {
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => ({
        created: true,
        metadata: { ...input, sha256: "0".repeat(64) },
      }),
    } as unknown as ObjectStore,
    insertImage: async () => 20,
    attachImage: async () => { attached = true; },
  }), /metadata does not match/);
  assert.equal(attached, false);
});
