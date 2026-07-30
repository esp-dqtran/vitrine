import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import type { ObjectMetadata, ObjectStore } from "../../src/objectStore.ts";
import {
  createContactSheets,
  EVIDENCE_PER_SHEET,
  sheetLayout,
  splitEvidence,
  type FlowEvidenceItem,
} from "./contact-sheets.ts";

const evidence = (count: number): FlowEvidenceItem[] => Array.from(
  { length: count },
  (_, index) => ({
    imageId: index + 1,
    evidenceId: `S${String(index + 1).padStart(2, "0")}`,
    stepIndex: Math.floor(index / 2),
    imageIndex: index % 2,
    stepLabel: `Step ${Math.floor(index / 2) + 1}`,
  }),
);

test("high-resolution sheets keep four screenshots per attachment", () => {
  assert.equal(EVIDENCE_PER_SHEET, 4);
  assert.deepEqual(splitEvidence(evidence(9)).map(({ length }) => length), [4, 4, 1]);
  assert.deepEqual(sheetLayout("ios"), {
    cellWidth: 512,
    imageHeight: 1_110,
    columns: 2,
    gap: 16,
    labelHeight: 44,
  });
  assert.deepEqual(sheetLayout("web"), {
    cellWidth: 960,
    imageHeight: 600,
    columns: 2,
    gap: 16,
    labelHeight: 44,
  });
});

test("contact sheets are lossless PNGs with evidence labels and versioned names", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "astryx-contact-sheets-"));
  try {
    const source = await sharp({
      create: {
        width: 1_179,
        height: 2_555,
        channels: 3,
        background: { r: 15, g: 95, b: 220 },
      },
    }).png().toBuffer();
    const images = new Map<number, ObjectMetadata>();
    for (let id = 1; id <= 5; id += 1) {
      images.set(id, {
        key: `images/${id}/source.png`,
        sha256: "a".repeat(64),
        byteSize: source.length,
        contentType: "image/png",
        accessClass: "protected",
      });
    }
    const store = {
      get: async (key: string) => ({
        metadata: [...images.values()].find((item) => item.key === key)!,
        body: source,
      }),
    } as ObjectStore;

    const sheets = await createContactSheets({
      baseName: "ios-product-detail",
      outputDirectory,
      platform: "ios",
      evidence: evidence(5),
      images,
      store,
    });

    assert.equal(sheets.length, 2);
    assert.match(sheets[0].path, /ios-product-detail-sheet-v2-01\.png$/);
    assert.match(sheets[1].path, /ios-product-detail-sheet-v2-02\.png$/);
    assert.deepEqual(sheets.map(({ evidence: items }) => items.map(({ evidenceId }) => evidenceId)), [
      ["S01", "S02", "S03", "S04"],
      ["S05"],
    ]);
    assert.deepEqual(
      await sharp(sheets[0].buffer).metadata().then(({ format, width, height }) => ({ format, width, height })),
      { format: "png", width: 1_040, height: 2_324 },
    );
    assert.deepEqual(
      await sharp(sheets[1].buffer).metadata().then(({ format, width, height }) => ({ format, width, height })),
      { format: "png", width: 512, height: 1_154 },
    );
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
