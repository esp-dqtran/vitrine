import assert from "node:assert/strict";
import test from "node:test";
import { options } from "./analyze-screens-with-kiro.ts";

test("selects an exact app version by default", () => {
  const selected = options([
    "--app", "15five",
    "--platform", "web",
    "--version", "1",
    "--limit", "25",
  ]);

  assert.equal(selected.latestPublished, false);
  assert.equal(selected.app, "15five");
  assert.equal(selected.versionNumber, 1);
  assert.equal(selected.limit, 25);
  assert.match(selected.output ?? "", /15five-web-v1-kiro\.json$/);
});

test("supports a read-only latest-published selection without a fixed output file", () => {
  const selected = options([
    "--latest-published",
    "--platform", "web",
    "--limit", "25",
    "--dry-run",
  ]);

  assert.equal(selected.latestPublished, true);
  assert.equal(selected.dryRun, true);
  assert.equal(selected.app, undefined);
  assert.equal(selected.versionNumber, undefined);
  assert.equal(selected.output, undefined);
});

test("rejects force mode for the resumable latest-published sweep", () => {
  assert.throws(
    () => options(["--latest-published", "--platform", "web", "--force"]),
    /--force requires an exact --app and --version scope/,
  );
});

test("requires exactly one selection mode", () => {
  assert.throws(
    () => options(["--platform", "web"]),
    /Usage:/,
  );
  assert.throws(
    () => options([
      "--latest-published",
      "--app", "15five",
      "--platform", "web",
      "--version", "1",
    ]),
    /Usage:/,
  );
});
