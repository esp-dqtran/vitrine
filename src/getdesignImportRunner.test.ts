import { test } from "node:test";
import assert from "node:assert/strict";
import { GETDESIGN_APP_MAPPINGS } from "./getdesignCatalog.ts";
import {
  parseGetDesignImportArgs,
  redactImportError,
  runGetDesignImport,
} from "./getdesignImportRunner.ts";

const template = (slug: string) => `---
description: "${slug} system"
colors:
  primary: "#123456"
components:
  button:
    backgroundColor: "{colors.primary}"
---
## Layout
Keep content aligned.
`;

const dependencies = (failApp?: string) => ({
  mappings: GETDESIGN_APP_MAPPINGS,
  readTemplate: async (slug: string) => template(slug),
  inspectTarget: async (mapping: typeof GETDESIGN_APP_MAPPINGS[number]) => ({ appFound: true, webPlatformFound: !mapping.createWebPlatform }),
  replace: async (input: { app: string }) => {
    if (input.app === failApp) throw new Error("write failed");
    return { historyId: "1", changed: true, createdPlatform: input.app === "tesla" };
  },
  rollback: async () => ({ historyId: "1" }),
  now: () => new Date("2026-07-22T00:00:00.000Z"),
  runId: () => "00000000-0000-4000-8000-000000000010",
});

test("dry-run validates all 44 mappings without mutation", async () => {
  let writes = 0;
  const deps = dependencies();
  const report = await runGetDesignImport({ mode: "dry-run" }, {
    ...deps,
    replace: async (input) => { writes += 1; return deps.replace(input); },
  });
  assert.equal(report.expected, 44);
  assert.equal(report.valid, 44);
  assert.equal(report.applied, 0);
  assert.equal(report.failed, 0);
  assert.equal(writes, 0);
  assert.deepEqual(report.results.filter(({ createdPlatform }) => createdPlatform).map(({ app }) => app).sort(), [
    "my-bmw", "playstation-app", "raycast", "starbucks", "tesla",
  ]);
});

test("apply continues after one per-app failure", async () => {
  const report = await runGetDesignImport({ mode: "apply" }, dependencies("linear"));
  assert.equal(report.applied, 43);
  assert.equal(report.failed, 1);
  assert.equal(report.results.length, 44);
  assert.equal(report.results.find(({ app }) => app === "linear")?.error, "write failed");
});

test("parses exclusive modes and redacts connection secrets", () => {
  assert.deepEqual(parseGetDesignImportArgs(["--dry-run"]), { mode: "dry-run" });
  assert.deepEqual(parseGetDesignImportArgs(["--apply"]), { mode: "apply" });
  assert.deepEqual(parseGetDesignImportArgs(["--rollback", "tesla"]), { mode: "rollback", app: "tesla" });
  assert.throws(() => parseGetDesignImportArgs([]), /exactly one mode/);
  assert.equal(
    redactImportError(new Error("postgres://user:secret@db/app failed"), "postgres://user:secret@db/app"),
    "[redacted] failed",
  );
});
