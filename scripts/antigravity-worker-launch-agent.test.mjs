import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LAUNCH_AGENT_LABEL,
  extraWorkerPids,
  firstAvailableExecutable,
  launchAgentPaths,
  parseAction,
  renderLaunchAgent,
  retryAsync,
} from "./antigravity-worker-launch-agent.mjs";

test("renders a secret-free supervised host worker LaunchAgent", () => {
  const paths = launchAgentPaths({
    repoRoot: "/Users/test/Astryx & Catalog",
    homeDirectory: "/Users/test",
  });
  const plist = renderLaunchAgent({
    nodePath: "/opt/homebrew/bin/node",
    repoRoot: "/Users/test/Astryx & Catalog",
    homeDirectory: "/Users/test",
  });

  assert.equal(LAUNCH_AGENT_LABEL, "com.eastplayers.astryx.antigravity-worker");
  assert.equal(
    paths.plistPath,
    "/Users/test/Library/LaunchAgents/com.eastplayers.astryx.antigravity-worker.plist",
  );
  assert.equal(
    paths.stdoutPath,
    "/Users/test/Astryx & Catalog/data/logs/antigravity-worker.stdout.log",
  );
  assert.equal(
    paths.stderrPath,
    "/Users/test/Astryx & Catalog/data/logs/antigravity-worker.stderr.log",
  );
  assert.match(plist, /<string>com\.eastplayers\.astryx\.antigravity-worker<\/string>/);
  assert.match(plist, /<string>\/opt\/homebrew\/bin\/node<\/string>/);
  assert.match(plist, /<string>--env-file=\.env<\/string>/);
  assert.match(plist, /<string>--import<\/string>\s*<string>tsx<\/string>/);
  assert.match(plist, /<string>services\/import-worker\/src\/index\.ts<\/string>/);
  assert.match(plist, /<key>WorkingDirectory<\/key>\s*<string>\/Users\/test\/Astryx &amp; Catalog<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<key>ThrottleInterval<\/key>\s*<integer>10<\/integer>/);
  assert.match(plist, /<key>HOME<\/key>\s*<string>\/Users\/test<\/string>/);
  assert.match(plist, /<key>PATH<\/key>\s*<string>\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin<\/string>/);
  assert.match(plist, /antigravity-worker\.stdout\.log/);
  assert.match(plist, /antigravity-worker\.stderr\.log/);
  assert.doesNotMatch(plist, /DATABASE_URL|RABBITMQ_URL|AWS_SECRET|password/i);
});

test("accepts only the supported lifecycle actions", () => {
  assert.equal(parseAction(undefined), "status");
  assert.equal(parseAction("install"), "install");
  assert.equal(parseAction("status"), "status");
  assert.equal(parseAction("uninstall"), "uninstall");
  assert.throws(() => parseAction("restart"), /install, status, or uninstall/);
});

test("ignores the current LaunchAgent pid but finds other host workers", () => {
  assert.deepEqual(extraWorkerPids([101, 202, 303], 202), [101, 303]);
  assert.deepEqual(extraWorkerPids([202], 202), []);
  assert.deepEqual(extraWorkerPids([], undefined), []);
});

test("selects the first executable that actually exists", () => {
  const existing = new Set(["/opt/homebrew/bin/docker"]);
  assert.equal(
    firstAvailableExecutable(
      ["/usr/local/bin/docker", "/opt/homebrew/bin/docker"],
      (candidate) => existing.has(candidate),
    ),
    "/opt/homebrew/bin/docker",
  );
  assert.throws(
    () => firstAvailableExecutable(["/missing/docker"], () => false),
    /could not be found/,
  );
});

test("retries a transient launchctl operation with bounded waits", async () => {
  let attempts = 0;
  const waits = [];
  const result = await retryAsync(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("launchd is still terminating");
      return "loaded";
    },
    {
      attempts: 4,
      delayMs: 25,
      wait: async (delayMs) => { waits.push(delayMs); },
    },
  );

  assert.equal(result, "loaded");
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [25, 25]);
  await assert.rejects(
    retryAsync(
      async () => { throw new Error("permanent"); },
      { attempts: 2, delayMs: 1, wait: async () => {} },
    ),
    /permanent/,
  );
});
