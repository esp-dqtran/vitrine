import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeMobbinSitesSource } from "./sitesSource.ts";

const fixtureUrl = new URL(
  "../tests/fixtures/mobbin-sites-v7-rsc.txt",
  import.meta.url,
);

test("decodes the inspected V7 graph exactly", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const result = decodeMobbinSitesSource(raw);
  const sections = result.pages.flatMap((page) => page.sections);

  assert.equal(result.site.name, "V7");
  assert.equal(result.version.sourceId, "f4e176f7-aeb6-4f9a-9689-e4379fc357b1");
  assert.equal(result.pages.length, 16);
  assert.equal(sections.length, 46);
  assert.equal(sections.filter((item) => item.mediaKind === "image").length, 35);
  assert.equal(sections.filter((item) => item.mediaKind === "video").length, 11);
  assert.equal(sections.flatMap((item) => item.ocrBoxes).length, 3146);
  assert.deepEqual(sections[0].sourceMetadata?.patterns, ["Hero Section"]);
  assert.deepEqual(sections[1].sourceMetadata?.patterns, ["Navigation Section"]);
  assert.deepEqual(result.pages.map((page) => page.position), [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ]);
});

test("maps exact image crops, video boundaries, and OCR geometry", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  const result = decodeMobbinSitesSource(raw);
  const sections = result.pages.flatMap((page) => page.sections);
  const image = sections.find((item) => item.mediaKind === "image");
  const video = sections.find((item) => item.mediaKind === "video");

  assert.ok(image);
  assert.ok(video);
  assert.equal(typeof image.cropTop, "number");
  assert.equal(typeof image.cropBottom, "number");
  assert.ok(image.cropBottom! > image.cropTop!);
  assert.ok(image.ocrBoxes[0].width > 0);
  assert.ok(image.ocrBoxes[0].height > 0);
  assert.equal(image.ocrBoxes[0].text, "ocr-0001");
  assert.ok(video.videoEndSeconds! > video.videoStartSeconds!);
  assert.equal(video.cropTop, undefined);
});

test("rejects truncation and source-schema drift", async () => {
  const raw = await readFile(fixtureUrl, "utf8");
  assert.throws(
    () => decodeMobbinSitesSource(raw.slice(0, raw.length / 2)),
    /Mobbin Sites source/i,
  );
  assert.throws(
    () => decodeMobbinSitesSource(raw.replaceAll('"sections"', '"changedSections"')),
    /Mobbin Sites source/i,
  );
});

test("rejects cross-row injection instead of evaluating it", () => {
  assert.throws(
    () => decodeMobbinSitesSource('4:(globalThis.compromised = true)\n'),
    /Mobbin Sites source/i,
  );
  assert.equal((globalThis as { compromised?: boolean }).compromised, undefined);
});
