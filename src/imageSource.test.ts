import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bulkImageHash, findBulkImage, isAppSlug, publicImageUrl } from "./imageSource.ts";

test("validates app slugs and bulk references", () => {
  assert.equal(isAppSlug("linear-ios"), true);
  assert.equal(isAppSlug("../linear"), false);
  assert.equal(bulkImageHash("mobbin-bulk:0123456789abcdef"), "0123456789abcdef");
  assert.equal(bulkImageHash("https://cdn.example.com/a.png"), undefined);
});

test("resolves an existing local bulk image", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-image-source-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  const file = join(dataDir, "images", "linear", "0123456789abcdef.webp");
  writeFileSync(file, "image");
  assert.equal(findBulkImage(dataDir, "linear", "0123456789abcdef"), file);
  rmSync(dataDir, { recursive: true, force: true });
});

test("maps only local bulk references to the media API", () => {
  assert.equal(
    publicImageUrl("linear", "mobbin-bulk:0123456789abcdef"),
    "/api/media/linear/0123456789abcdef"
  );
  assert.equal(
    publicImageUrl("linear", "https://cdn.example.com/a.png"),
    "https://cdn.example.com/a.png"
  );
});
