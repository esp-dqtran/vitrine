import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bulkImageHash, findBulkImage, isAppSlug, parseImageSource, publicImageUrl } from "./imageSource.ts";

test("validates app slugs and bulk references", () => {
  assert.equal(isAppSlug("linear-ios"), true);
  assert.equal(isAppSlug("../linear"), false);
  assert.equal(bulkImageHash("mobbin-bulk:0123456789abcdef"), "0123456789abcdef");
  assert.equal(bulkImageHash("capture:0123456789abcdef"), "0123456789abcdef");
  assert.equal(bulkImageHash("https://cdn.example.com/a.png"), undefined);
});

test("parses only narrow legacy references and safe external HTTP images", () => {
  assert.deepEqual(parseImageSource("capture:0123456789abcdef"), {
    kind: "legacy", hash: "0123456789abcdef",
  });
  assert.deepEqual(parseImageSource("https://cdn.example.com/a.png?version=2"), {
    kind: "external", url: "https://cdn.example.com/a.png?version=2",
  });
  for (const source of [
    "capture:../../secret", "capture:ABCDEF0123456789", "file:///tmp/a.png",
    "javascript:alert(1)", "https://user:secret@cdn.example.com/a.png", "not a url",
  ]) assert.equal(parseImageSource(source), undefined, source);
});

test("maps smart-crawler capture references to the media API", () => {
  assert.equal(
    publicImageUrl("atlassian", "capture:0123456789abcdef"),
    "/api/media/atlassian/0123456789abcdef"
  );
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
  assert.equal(publicImageUrl("linear", "javascript:alert(1)"), "");
  assert.equal(publicImageUrl("linear", "https://user:secret@cdn.example.com/a.png"), "");
});

test("appends a thumb variant query for local bulk references, leaves external URLs untouched", () => {
  assert.equal(
    publicImageUrl("linear", "mobbin-bulk:0123456789abcdef", "thumb"),
    "/api/media/linear/0123456789abcdef?variant=thumb"
  );
  assert.equal(
    publicImageUrl("linear", "https://cdn.example.com/a.png", "thumb"),
    "https://cdn.example.com/a.png"
  );
});
