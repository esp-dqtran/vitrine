import assert from "node:assert/strict";
import test from "node:test";
import { consolidateCatalogJobs, partitionCatalogJobs } from "./catalogStatePartition.ts";

const job = (mobbinId: string, slug: string, platform: string, status = "pending") => ({
  mobbinId,
  appName: slug,
  slug,
  platform,
  status,
});

test("delegated state wins and slug collisions become explicit repair jobs", () => {
  const primary = [
    job("a-id", "threads", "ios"),
    job("b-id", "threads", "ios", "done"),
    job("c-id", "linear", "web"),
  ];
  const delegated = [{ ...job("c-id", "linear", "web", "done"), verification: { screens: { discovered: 1, captured: 1 } } }];

  const consolidated = consolidateCatalogJobs(primary, delegated);
  assert.equal(consolidated.length, 3);
  assert.equal(consolidated.find((item) => item.mobbinId === "c-id")?.status, "done");
  assert.equal(consolidated.find((item) => item.mobbinId === "b-id")?.slug, "threads");
  const renamed = consolidated.find((item) => item.mobbinId === "a-id")!;
  assert.equal(renamed.slug, "threads-a-id");
  assert.equal(renamed.status, "pending");
  assert.deepEqual(renamed.repair, { screens: true, uiElements: true, flows: true });
});

test("catalog partitions balance repair jobs and preserve every unique Mobbin job", () => {
  const jobs = Array.from({ length: 17 }, (_, index) => ({
    ...job(`id-${index}`, `app-${index}`, index % 2 ? "ios" : "web", index < 5 ? "pending" : "done"),
    ...(index < 5 ? { repair: { screens: false, uiElements: true, flows: false } } : {}),
  }));
  const partitions = partitionCatalogJobs(jobs, 3);
  assert.deepEqual(partitions.map((items) => items.length), [6, 6, 5]);
  assert.deepEqual(partitions.map((items) => items.filter((item) => item.repair).length), [2, 2, 1]);
  assert.equal(new Set(partitions.flat().map((item) => `${item.mobbinId}\u0000${item.platform}`)).size, 17);
});
