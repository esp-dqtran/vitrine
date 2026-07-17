import assert from "node:assert/strict";
import { test } from "node:test";
import { RESEARCH_LIMITS } from "./researchProject.ts";
import { validateResearchUpload } from "./researchUpload.ts";

test("accepts only bounded raster files", () => {
  assert.equal(validateResearchUpload(Buffer.from([1]), "image/png").extension, "png");
  assert.equal(validateResearchUpload(Buffer.from([1]), "image/jpeg").extension, "jpg");
  assert.equal(validateResearchUpload(Buffer.from([1]), "image/webp").extension, "webp");
  assert.throws(
    () => validateResearchUpload(Buffer.alloc(RESEARCH_LIMITS.uploadBytesMax + 1), "image/png"),
    /10 MiB/,
  );
  assert.throws(() => validateResearchUpload(Buffer.from([1]), "image/svg+xml"), /Unsupported/);
  assert.throws(() => validateResearchUpload(Buffer.alloc(0), "image/png"), /empty/i);
});
