# Antigravity Worker LaunchAgent Design

## Goal

Keep the host-local Astryx import worker running independently of Codex
terminal sessions so App Knowledge analysis through the signed-in Antigravity
desktop can finish reliably.

## Architecture

Install one per-user macOS LaunchAgent named
`com.eastplayers.astryx.antigravity-worker`. The agent runs the existing
`services/import-worker/src/index.ts` entry point with the repository as its
working directory, loads the existing `.env` at process start, and connects to
Antigravity through its loopback-only DevTools endpoint.

The LaunchAgent uses the current absolute Node executable and repository path.
It contains no database, RabbitMQ, AWS, or authentication secrets. Those remain
in the existing `.env` and user environment.

## Lifecycle

- `RunAtLoad` starts the worker when the LaunchAgent is installed or the user
  signs in.
- `KeepAlive` restarts the worker after an unexpected exit.
- `ThrottleInterval` prevents a tight restart loop.
- Standard output and error are written under `data/logs/`.
- Installation is idempotent: an existing copy of the same LaunchAgent is
  unloaded before the new definition is bootstrapped.
- Installation refuses to proceed while another manual host import-worker or
  the Docker import-worker is active.

## Operational Interface

The repository provides install, status, and uninstall package scripts. The
installer generates the machine-specific plist under
`~/Library/LaunchAgents/`; the generated file is not committed.

`status` prints the authoritative `launchctl` record. `uninstall` unloads the
agent and removes only its generated plist. It does not edit queues, jobs,
evidence, `.env`, or Antigravity state.

## Error Handling

The installer fails closed on non-macOS systems, missing `.env`, missing Node,
an active duplicate worker, an active Docker import-worker, or unsuccessful
`launchctl` operations. Worker failures remain visible in persistent stderr
logs while `launchd` restarts the process.

## Acceptance Criteria

1. The generated plist selects the existing host worker, working directory,
   Node executable, `.env`, persistent logs, `RunAtLoad`, and `KeepAlive`.
2. Exactly one host import-worker process and one `mobbin-jobs` consumer exist.
3. The queued App Knowledge job becomes unacknowledged and resumes increasing
   durable completed-evidence rows.
4. Closing the installing terminal does not terminate the worker.
5. No secrets are embedded in the plist or logs produced by installation.

