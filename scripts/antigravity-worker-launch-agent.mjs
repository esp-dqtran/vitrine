import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  access,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LAUNCH_AGENT_LABEL = "com.eastplayers.astryx.antigravity-worker";
const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(MODULE_PATH), "..");
const WORKER_PATTERN = "services/import-worker/src/index.ts";

const xml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&apos;");

export function launchAgentPaths({ repoRoot, homeDirectory }) {
  return {
    plistPath: path.join(
      homeDirectory,
      "Library",
      "LaunchAgents",
      `${LAUNCH_AGENT_LABEL}.plist`,
    ),
    stdoutPath: path.join(
      repoRoot,
      "data",
      "logs",
      "antigravity-worker.stdout.log",
    ),
    stderrPath: path.join(
      repoRoot,
      "data",
      "logs",
      "antigravity-worker.stderr.log",
    ),
  };
}

export function renderLaunchAgent({ nodePath, repoRoot, homeDirectory }) {
  const paths = launchAgentPaths({ repoRoot, homeDirectory });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(LAUNCH_AGENT_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>--env-file=.env</string>
    <string>--import</string>
    <string>tsx</string>
    <string>services/import-worker/src/index.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xml(homeDirectory)}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(paths.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(paths.stderrPath)}</string>
</dict>
</plist>
`;
}

export function parseAction(value) {
  const action = value ?? "status";
  if (!["install", "status", "uninstall"].includes(action)) {
    throw new Error("Action must be install, status, or uninstall");
  }
  return action;
}

export function extraWorkerPids(processPids, agentPid) {
  return processPids.filter((pid) => pid !== agentPid);
}

export function firstAvailableExecutable(candidates, exists = existsSync) {
  const executable = candidates.find((candidate) => exists(candidate));
  if (!executable) throw new Error("Required executable could not be found");
  return executable;
}

export async function retryAsync(
  operation,
  {
    attempts,
    delayMs,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  },
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs);
    }
  }
  throw lastError;
}

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? result.stderr.trim() : "";
    throw new Error(`${program} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return {
    ok: result.status === 0,
    stdout: options.capture ? result.stdout.trim() : "",
    stderr: options.capture ? result.stderr.trim() : "",
  };
}

function launchTarget() {
  if (typeof process.getuid !== "function") {
    throw new Error("A macOS user session is required");
  }
  return `gui/${process.getuid()}/${LAUNCH_AGENT_LABEL}`;
}

function launchDomain() {
  if (typeof process.getuid !== "function") {
    throw new Error("A macOS user session is required");
  }
  return `gui/${process.getuid()}`;
}

function loadedAgent() {
  const result = command(
    "/bin/launchctl",
    ["print", launchTarget()],
    { capture: true, allowFailure: true },
  );
  const pid = result.ok
    ? Number(/\bpid = (\d+)/.exec(result.stdout)?.[1])
    : undefined;
  return {
    loaded: result.ok,
    pid: Number.isSafeInteger(pid) && pid > 0 ? pid : undefined,
    output: result.stdout,
  };
}

function hostWorkerPids() {
  const result = command(
    "/usr/bin/pgrep",
    ["-f", WORKER_PATTERN],
    { capture: true, allowFailure: true },
  );
  if (!result.ok || !result.stdout) return [];
  return result.stdout
    .split(/\s+/)
    .map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
}

function dockerWorkerRunning(repoRoot) {
  const docker = firstAvailableExecutable([
    "/usr/local/bin/docker",
    "/opt/homebrew/bin/docker",
  ]);
  const result = command(
    docker,
    ["compose", "ps", "--status", "running", "-q", "import-worker"],
    { cwd: repoRoot, capture: true },
  );
  return Boolean(result.stdout);
}

async function install({ repoRoot, homeDirectory, nodePath }) {
  if (process.platform !== "darwin") {
    throw new Error("The Antigravity worker LaunchAgent requires macOS");
  }
  await access(path.join(repoRoot, ".env"));
  await access(nodePath);
  const current = loadedAgent();
  const extras = extraWorkerPids(hostWorkerPids(), current.pid);
  if (extras.length) {
    throw new Error(`Another host import-worker is already running: ${extras.join(", ")}`);
  }
  if (dockerWorkerRunning(repoRoot)) {
    throw new Error("The Docker import-worker must be stopped before installing the host worker");
  }

  const paths = launchAgentPaths({ repoRoot, homeDirectory });
  await mkdir(path.dirname(paths.plistPath), { recursive: true });
  await mkdir(path.dirname(paths.stdoutPath), { recursive: true });
  const temporaryPath = `${paths.plistPath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    renderLaunchAgent({ nodePath, repoRoot, homeDirectory }),
    { encoding: "utf8", mode: 0o600 },
  );
  await rename(temporaryPath, paths.plistPath);

  if (current.loaded) {
    command("/bin/launchctl", ["bootout", launchTarget()]);
  }
  await retryAsync(
    async () => command(
      "/bin/launchctl",
      ["bootstrap", launchDomain(), paths.plistPath],
      { capture: true },
    ),
    { attempts: 5, delayMs: 500 },
  );
  command("/bin/launchctl", ["enable", launchTarget()]);
  command("/bin/launchctl", ["kickstart", "-k", launchTarget()]);
  const status = loadedAgent();
  if (!status.loaded) throw new Error("LaunchAgent did not load");
  process.stdout.write(`${status.output}\n`);
}

async function status() {
  const current = loadedAgent();
  if (!current.loaded) throw new Error("Antigravity worker LaunchAgent is not loaded");
  process.stdout.write(`${current.output}\n`);
}

async function uninstall({ repoRoot, homeDirectory }) {
  const current = loadedAgent();
  if (current.loaded) {
    command("/bin/launchctl", ["bootout", launchTarget()]);
  }
  const paths = launchAgentPaths({ repoRoot, homeDirectory });
  await rm(paths.plistPath, { force: true });
  process.stdout.write(`Removed ${paths.plistPath}\n`);
}

export async function main(
  argv = process.argv.slice(2),
  {
    repoRoot = DEFAULT_REPO_ROOT,
    homeDirectory = homedir(),
    nodePath = process.execPath,
  } = {},
) {
  const action = parseAction(argv[0]);
  if (action === "install") {
    await install({ repoRoot, homeDirectory, nodePath });
  } else if (action === "uninstall") {
    await uninstall({ repoRoot, homeDirectory });
  } else {
    await status();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
