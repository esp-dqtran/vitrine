import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUiElementLaunchAgentPlist } from "./uiElementLaunchAgent.ts";

test("builds a bounded one-shot LaunchAgent for three Kiro workers", () => {
  const plist = buildUiElementLaunchAgentPlist({
    label: "com.eastplayers.astryx.kiro-ui.test",
    nodePath: "/opt/node",
    workingDirectory: "/tmp/Astryx & test",
    environmentFile: "/tmp/Astryx & test/.env",
    extractionScript: "/tmp/Astryx & test/scripts/extract-ui-elements.ts",
    app: "shopee",
    platform: "ios",
    versionNumber: 1,
    limit: 18,
    concurrency: 3,
    restartOnFailure: false,
    reportPath: "/tmp/report.json",
    stdoutPath: "/tmp/stdout.log",
    stderrPath: "/tmp/stderr.log",
    environment: {
      path: "/usr/bin:/opt/bin",
      home: "/Users/test",
    },
  });

  assert.match(plist, /<key>RunAtLoad<\/key>\n<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\n<false\/>/);
  assert.match(plist, /<string>--concurrency<\/string>\n<string>3<\/string>/);
  assert.match(plist, /<string>--limit<\/string>\n<string>18<\/string>/);
  assert.match(plist, /Astryx &amp; test/);
  assert.doesNotMatch(plist, /KeepAlive<\/key>\n<true\/>/);
  assert.doesNotMatch(plist, /SuccessfulExit/);
});

test("restarts a full-dataset job only after failure", () => {
  const plist = buildUiElementLaunchAgentPlist({
    label: "com.eastplayers.astryx.kiro-ui.full",
    nodePath: "/opt/node",
    workingDirectory: "/tmp/Astryx",
    environmentFile: "/tmp/Astryx/.env",
    extractionScript: "/tmp/Astryx/scripts/extract-ui-elements.ts",
    app: "shopee",
    platform: "ios",
    versionNumber: 1,
    limit: 5_000,
    concurrency: 3,
    restartOnFailure: true,
    reportPath: "/tmp/report.json",
    stdoutPath: "/tmp/stdout.log",
    stderrPath: "/tmp/stderr.log",
    environment: {
      path: "/usr/bin:/opt/bin",
      home: "/Users/test",
    },
  });

  assert.match(
    plist,
    /<key>KeepAlive<\/key>\n<dict>\n<key>SuccessfulExit<\/key>\n<false\/>\n<\/dict>/,
  );
  assert.match(plist, /<string>--allow-empty<\/string>/);
  assert.match(plist, /<string>--limit<\/string>\n<string>5000<\/string>/);
  assert.doesNotMatch(plist, /<key>KeepAlive<\/key>\n<true\/>/);
});
