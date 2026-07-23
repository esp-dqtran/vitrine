# Antigravity Worker LaunchAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Antigravity-backed Astryx import worker as a supervised macOS user service.

**Architecture:** A small Node installer renders a machine-specific LaunchAgent plist and manages it through `launchctl`. The existing worker code and `.env` remain unchanged; the agent only supplies durable process lifecycle and log paths.

**Tech Stack:** Node.js, macOS `launchd`/`launchctl`, Node test runner, RabbitMQ, PostgreSQL.

---

### Task 1: Deterministic LaunchAgent Definition

**Files:**
- Create: `scripts/antigravity-worker-launch-agent.mjs`
- Create: `scripts/antigravity-worker-launch-agent.test.mjs`

- [ ] **Step 1: Write the failing renderer test**

Test that `renderLaunchAgent()` includes the exact label, absolute Node path,
working directory, relative worker entry point, `.env` loading, `RunAtLoad`,
`KeepAlive`, throttle interval, HOME/PATH, and separate stdout/stderr paths.
Also assert that representative secret values are absent.

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```bash
node --test scripts/antigravity-worker-launch-agent.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the renderer**

Export `LAUNCH_AGENT_LABEL`, `launchAgentPaths()`, and
`renderLaunchAgent()`. XML-escape every path and value. Keep credentials out of
the rendered plist.

- [ ] **Step 4: Run the renderer test and verify GREEN**

Run the same Node test command. Expected: all renderer tests pass.

### Task 2: Lifecycle Commands and Duplicate Protection

**Files:**
- Modify: `scripts/antigravity-worker-launch-agent.mjs`
- Modify: `scripts/antigravity-worker-launch-agent.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing command-validation tests**

Test `install`, `status`, and `uninstall` action parsing, including rejection of
unknown actions. Test duplicate-process parsing with one expected LaunchAgent
PID and one unrelated manual worker PID.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because command parsing and duplicate detection are missing.

- [ ] **Step 3: Implement minimal lifecycle management**

Use `launchctl print`, `bootout`, `bootstrap`, `enable`, and `kickstart`.
Create log and LaunchAgents directories, atomically write the plist, refuse an
active Docker import-worker or extra manual worker, and expose package scripts:

```json
"service:antigravity-worker:install": "node scripts/antigravity-worker-launch-agent.mjs install",
"service:antigravity-worker:status": "node scripts/antigravity-worker-launch-agent.mjs status",
"service:antigravity-worker:uninstall": "node scripts/antigravity-worker-launch-agent.mjs uninstall"
```

- [ ] **Step 4: Run tests and verify GREEN**

Run the focused script tests and existing Antigravity/App Knowledge tests.

### Task 3: Installation and Live Acceptance

**Files:**
- Modify: `docs/operations/app-knowledge-antigravity.md`
- Generate: `~/Library/LaunchAgents/com.eastplayers.astryx.antigravity-worker.plist`

- [ ] **Step 1: Document installation and status commands**

Explain that Antigravity must remain open and signed in, Docker
`import-worker` must remain stopped, and logs live under `data/logs/`.

- [ ] **Step 2: Install the LaunchAgent**

Run:

```bash
npm run service:antigravity-worker:install
```

Expected: one loaded LaunchAgent and one host import-worker PID.

- [ ] **Step 3: Verify runtime ownership**

Check `launchctl print`, process count, Docker worker state, RabbitMQ
`mobbin-jobs` ready/unacknowledged/consumer counts, and persistent log files.

- [ ] **Step 4: Verify durable forward progress**

Read the App Knowledge job and evidence tables in a read-only transaction.
Expected: completed evidence increases beyond 179, failed remains zero, and
the RabbitMQ message remains owned by exactly one consumer.

- [ ] **Step 5: Run final verification**

Run focused Node tests, `npm run build`, and `git diff --check`. Preserve
unrelated working-tree changes.

