import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  tabUrl,
  mergeFlows,
  ingestDownloadedImages,
  extractIfArchive,
  catalogDownloadRoot,
  isFlowlessRedirect,
  flowStageCoverage,
  retryTransientFlowIngestion,
  waitForGridOrRedirect,
} from "./bulkDownload.ts";
import type { DesignFlow } from "./designSystem.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";

test("tabUrl swaps or appends the tab segment", () => {
  const base = "https://mobbin.com/apps/linear-ios-1234/abcd/screens";
  assert.equal(tabUrl(base, "ui-elements"), "https://mobbin.com/apps/linear-ios-1234/abcd/ui-elements");
  assert.equal(tabUrl(base, "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd/flows", "screens"), base);
  assert.equal(tabUrl("https://mobbin.com/apps/linear-ios-1234/abcd", "flows"), "https://mobbin.com/apps/linear-ios-1234/abcd/flows");
});

test("parallel catalog jobs isolate temporary downloads by platform and phase", () => {
  assert.equal(catalogDownloadRoot("threads", "ios", "bulk"), "data/downloads/threads-ios");
  assert.equal(catalogDownloadRoot("threads", "web", "bulk"), "data/downloads/threads-web");
  assert.equal(catalogDownloadRoot("threads", "ios", "flows"), "data/downloads/threads-ios-flows");
});

test("flow navigation recognizes Mobbin redirecting an app with no flows back to screens", () => {
  const requested = "https://mobbin.com/apps/product-hunt-ios-id/latest/flows";
  assert.equal(isFlowlessRedirect(requested, "https://mobbin.com/apps/product-hunt-ios-id/version/screens"), true);
  assert.equal(isFlowlessRedirect(requested, "https://mobbin.com/apps/product-hunt-ios-id/version/flows"), false);
  assert.equal(isFlowlessRedirect(requested, "https://mobbin.com/login"), false);
});

test("flow navigation accepts a delayed client-side redirect before the grid timeout", async () => {
  const result = await waitForGridOrRedirect(
    () => new Promise<void>((resolve) => setTimeout(resolve, 30)),
    () => new Promise<void>((resolve) => setTimeout(resolve, 1)),
  );
  assert.equal(result, "redirect");
});

test("flow coverage fails when the crawl sees fewer rows than Mobbin shows", () => {
  const flow = (id: string): DesignFlow => ({ id, title: id, description: "", tags: [], steps: [] });
  assert.deepEqual(flowStageCoverage(4, ["a", "b", "c"], [flow("mobbin-flow-a")], [
    flow("mobbin-flow-b"), flow("mobbin-flow-c"),
  ]), {
    discovered: 4,
    captured: 3,
    complete: false,
    missingRowIds: [],
    undiscovered: 1,
  });
});

test("flow coverage fails when a seen row was not persisted", () => {
  const flow = (id: string): DesignFlow => ({ id, title: id, description: "", tags: [], steps: [] });
  assert.deepEqual(flowStageCoverage(3, ["a", "b", "c"], [flow("mobbin-flow-a")], [flow("mobbin-flow-b")]), {
    discovered: 3,
    captured: 2,
    complete: false,
    missingRowIds: ["c"],
    undiscovered: 0,
  });
});

test("flow ingestion retries transient database saturation instead of skipping the flow", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await retryTransientFlowIngestion(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error("(EMAXCONNSESSION) max clients reached in session mode");
      return "persisted";
    },
    {
      attempts: 4,
      baseDelayMs: 10,
      sleep: async (delayMs) => { delays.push(delayMs); },
    },
  );

  assert.equal(result, "persisted");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("flow ingestion fails immediately for non-transient errors", async () => {
  let attempts = 0;
  await assert.rejects(
    retryTransientFlowIngestion(async () => {
      attempts++;
      throw new Error("downloaded image metadata mismatch");
    }, { attempts: 4, baseDelayMs: 0, sleep: async () => {} }),
    /metadata mismatch/,
  );
  assert.equal(attempts, 1);
});

test("flow ingestion rejects after transient retry exhaustion", async () => {
  let attempts = 0;
  await assert.rejects(
    retryTransientFlowIngestion(async () => {
      attempts++;
      const error = new Error("too many clients already");
      Object.assign(error, { code: "53300" });
      throw error;
    }, { attempts: 3, baseDelayMs: 0, sleep: async () => {} }),
    /too many clients/,
  );
  assert.equal(attempts, 3);
});

test("UI element selection keeps every Mobbin card regardless of alt text", async () => {
  const bulk = await import("./bulkDownload.ts") as Record<string, unknown>;
  assert.equal(typeof bulk.shouldSelectCard, "function");
  const shouldSelect = bulk.shouldSelectCard as (tab: string, cardAlt: string, appPrefix: string) => boolean;
  assert.equal(shouldSelect("ui-elements", "Button / Primary", "linear"), true);
  assert.equal(shouldSelect("screens", "Not Linear screen", "linear"), false);
  assert.equal(shouldSelect("screens", "Linear screen", "linear"), true);
});

test("mergeFlows replaces by id and keeps the rest", () => {
  const flow = (id: string, title: string): DesignFlow => ({ id, title, description: "d", tags: [], steps: [{ label: "Step 1", evidence: [1] }] });
  const merged = mergeFlows([flow("a", "old"), flow("b", "keep")], [flow("a", "new"), flow("c", "added")]);
  assert.deepEqual(merged.map(({ id, title }) => `${id}:${title}`), ["a:new", "b:keep", "c:added"]);
});

test("extractIfArchive extracts zip entries with non-ASCII filenames", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-zip-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const srcDir = join(root, "src");
  await mkdir(srcDir);
  const entryName = "Condé Nast Spotlight.png";
  await writeFile(join(srcDir, entryName), "not really a png, just bytes");
  const zipPath = join(root, "archive.zip");
  execFileSync("zip", ["-j", zipPath, join(srcDir, entryName)]);

  const destDir = join(root, "dest");
  assert.equal(extractIfArchive(zipPath, destDir), true);
  assert.deepEqual(await readdir(destDir), [entryName]);
});

test("extractIfArchive treats dollar signs in archive paths literally", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-zip-dollar-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const srcDir = join(root, "src");
  await mkdir(srcDir);
  const entryName = "flow.png";
  await writeFile(join(srcDir, entryName), "flow bytes");
  const zipPath = join(root, "Editing $DaveTag.zip");
  execFileSync("zip", ["-j", zipPath, join(srcDir, entryName)]);

  const destDir = join(root, "dest");
  assert.equal(extractIfArchive(zipPath, destDir), true);
  assert.deepEqual(await readdir(destDir), [entryName]);
});

test("bulk ingestion uploads verified bytes before attaching the image, then attaches a thumbnail", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-objects-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "nested"));
  const png = await sharp({ create: { width: 1200, height: 2600, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer();
  await writeFile(join(root, "nested", "screen.png"), png);
  const events: string[] = [];
  let uploaded: ObjectMetadata | undefined;
  let thumbnailUploaded: ObjectMetadata | undefined;
  const store = {
    put: async (input: ObjectMetadata & { body: Uint8Array }) => {
      if (input.contentType === "image/jpeg") { thumbnailUploaded = input; events.push("put-thumb"); }
      else { uploaded = input; events.push("put"); }
      return { created: true, metadata: input };
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
    attachThumbnail: async (imageId, metadata) => {
      events.push(`attach-thumb:${imageId}`);
      const { body: _body, ...expected } = thumbnailUploaded! as ObjectMetadata & { body: Uint8Array };
      assert.deepEqual(metadata, expected);
    },
  });
  assert.deepEqual(events.map((event) => event.split(":")[0]), ["insert", "put", "attach", "put-thumb", "attach-thumb"]);
  assert.equal(result.imported, 1);
  assert.deepEqual(result.imageIds, [17]);
  assert.match(uploaded!.key, /^images\/17\/[0-9a-f]{64}\.png$/);
  assert.equal(uploaded!.contentType, "image/png");
  assert.equal(uploaded!.accessClass, "protected");
  assert.match(thumbnailUploaded!.key, /^thumbnails\/17\/[0-9a-f]{64}\.jpg$/);
  assert.equal(thumbnailUploaded!.contentType, "image/jpeg");
  assert.ok(thumbnailUploaded!.byteSize < uploaded!.byteSize, "thumbnail should be smaller than the full image");
});

test("bulk ingestion keeps artifact kinds and duplicate occurrences distinct", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "astryx-bulk-identity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).png().toBuffer();
  await writeFile(join(root, "01.png"), png);
  await writeFile(join(root, "02.png"), png);
  const references: string[] = [];
  const dependencies = {
    objectStore: {
      put: async (input: ObjectMetadata & { body: Uint8Array }) => ({ created: true, metadata: input }),
    } as unknown as ObjectStore,
    insertImage: async (_app: string, _platform: string, reference: string) => {
      references.push(reference);
      return references.length;
    },
    attachImage: async () => {},
    attachThumbnail: async () => {},
  };

  await ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear/screens", null, "screen", dependencies);
  await ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear/ui-elements", null, "ui_element", dependencies);
  await ingestDownloadedImages(root, "linear", "web", "https://mobbin.com/linear/flows/one", null, "flow_step", dependencies);

  const hash = references[0]!.slice("mobbin-bulk:".length);
  assert.deepEqual(references, [
    `mobbin-bulk:${hash}`,
    `mobbin-bulk:screen:${hash}:2`,
    `mobbin-bulk:ui_element:${hash}`,
    `mobbin-bulk:ui_element:${hash}:2`,
    `mobbin-bulk:flow_step:${hash}`,
    `mobbin-bulk:flow_step:${hash}:2`,
  ]);
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
    attachThumbnail: async () => {},
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
    attachThumbnail: async () => {},
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
    attachThumbnail: async () => {},
  }), /metadata does not match/);
  assert.equal(attached, false);
});
