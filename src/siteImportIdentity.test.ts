import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  canonicalMobbinSitesUrl,
  classifySiteImportUrl,
} from "./sites.ts";

const mobbinUrl =
  "https://mobbin.com/sites/v7labs/2d6e0e9c-9598-4d92-a9a4-c3985f995a26/preview";

test("routes exact Mobbin URLs to Mobbin and other public URLs to one-page capture", () => {
  assert.deepEqual(classifySiteImportUrl(mobbinUrl), {
    kind: "mobbin",
    ...canonicalMobbinSitesUrl(mobbinUrl),
  });
  const canonicalUrl = "https://www.framer.com/";
  const sourceSiteId =
    `url:${createHash("sha256").update(canonicalUrl).digest("hex")}`;
  assert.deepEqual(classifySiteImportUrl("https://www.framer.com/#hero"), {
    kind: "public-page",
    canonicalUrl,
    sourceSiteId,
  });
});

test("rejects private generic Site URLs", () => {
  assert.throws(
    () => classifySiteImportUrl("http://127.0.0.1/"),
    /public/i,
  );
});
