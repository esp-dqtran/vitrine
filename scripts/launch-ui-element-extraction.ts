import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { buildUiElementLaunchAgentPlist } from "../src/uiElementLaunchAgent.ts";

const execute = promisify(execFile);

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positive(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be positive`);
  }
  return parsed;
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("app is invalid");
  return normalized.slice(0, 60);
}

async function run(): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("The one-shot UI-element launcher requires macOS launchd");
  }
  const app = argument("--app");
  const platform = argument("--platform");
  if (platform !== "ios" && platform !== "android" && platform !== "web") {
    throw new Error("--platform must be ios, android, or web");
  }
  const versionNumber = positive(argument("--version"), "version");
  const limit = positive(argument("--limit", "18"), "limit");
  const concurrency = positive(argument("--concurrency", "3"), "concurrency");
  if (concurrency > 8) throw new Error("concurrency cannot exceed 8");
  const restartOnFailure = process.argv.includes("--restart-on-failure");

  const workingDirectory = resolve(process.cwd());
  const stamp = `${Date.now()}-${process.pid}`;
  const label = `com.eastplayers.astryx.kiro-ui.${slug(app)}-${platform}-v${versionNumber}.${stamp}`;
  const jobDirectory = resolve(
    argument("--job-dir", join(tmpdir(), "astryx-ui-element-jobs", label)),
  );
  await mkdir(jobDirectory, { recursive: true, mode: 0o700 });
  const reportPath = join(jobDirectory, "report.json");
  const stdoutPath = join(jobDirectory, "stdout.log");
  const stderrPath = join(jobDirectory, "stderr.log");
  const plistPath = join(jobDirectory, `${label}.plist`);
  const metadataPath = join(jobDirectory, "job.json");
  const environmentFile = join(workingDirectory, ".env");
  const extractionScript = join(workingDirectory, "scripts", "extract-ui-elements.ts");
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid)) throw new Error("Cannot determine launchd user domain");

  const plist = buildUiElementLaunchAgentPlist({
    label,
    nodePath: process.execPath,
    workingDirectory,
    environmentFile,
    extractionScript,
    app,
    platform,
    versionNumber,
    limit,
    concurrency,
    restartOnFailure,
    reportPath,
    stdoutPath,
    stderrPath,
    environment: {
      path: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin",
      home: process.env.HOME ?? "",
      user: process.env.USER,
      tmpdir: process.env.TMPDIR,
    },
  });
  await writeFile(plistPath, plist, { mode: 0o600 });
  await writeFile(metadataPath, `${JSON.stringify({
    label,
    domain: `gui/${uid}`,
    app,
    platform,
    versionNumber,
    limit,
    concurrency,
    restartOnFailure,
    reportPath,
    stdoutPath,
    stderrPath,
    plistPath,
    restartOnFailure,
    launcher: basename(process.argv[1]),
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`, { mode: 0o600 });
  await execute("/bin/launchctl", ["bootstrap", `gui/${uid}`, plistPath]);
  console.log(JSON.stringify({
    label,
    domain: `gui/${uid}`,
    jobDirectory,
    reportPath,
    stdoutPath,
    stderrPath,
    plistPath,
    restartOnFailure,
  }, null, 2));
}

await run();
