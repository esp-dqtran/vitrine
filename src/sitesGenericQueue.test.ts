import assert from "node:assert/strict";
import test from "node:test";
import { parseSitesJob } from "./sitesQueue.ts";

test("Sites queue accepts and canonicalizes one arbitrary public page", () => {
  assert.deepEqual(parseSitesJob({
    type: "import-site",
    url: "https://www.framer.com/#hero",
    jobId: 7,
  }), {
    type: "import-site",
    url: "https://www.framer.com/",
    jobId: 7,
  });
});

test("Sites queue still rejects private public-page targets", () => {
  assert.throws(() => parseSitesJob({
    type: "import-site",
    url: "http://127.0.0.1/",
    jobId: 7,
  }), /invalid Sites queue job/i);
});
