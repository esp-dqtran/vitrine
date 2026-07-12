import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { link, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { backupOptionsFromEnvironment } from "../scripts/db-backup.ts";
import { restoreOptionsFromArguments } from "../scripts/db-restore-verify.ts";
import {
  createRestoreTargetConfig,
  createBackupManifest,
  createDatabaseBackup,
  captureDatabaseEvidence,
  libpqEnv,
  loadVerifiedBackup,
  parseBackupManifest,
  pgDumpArguments,
  pgRestoreArguments,
  redactRecoveryError,
  runObjectRecoveryDrill,
  runTool,
  sha256File,
  verifyDatabaseRestore,
} from "./dbRecovery.ts";

test("object recovery restores bytes before parity verification and returns aggregate evidence", async () => {
  const calls: string[] = [];
  const evidence = await runObjectRecoveryDrill({
    restore: async () => { calls.push("restore"); },
    verify: async () => {
      calls.push("verify");
      return { totalObjects: 3, totalBytes: 42, evidenceSha256: "a".repeat(64) };
    },
  }, {} as never);
  assert.deepEqual(calls, ["restore", "verify"]);
  assert.deepEqual(evidence, { totalObjects: 3, totalBytes: 42, evidenceSha256: "a".repeat(64) });
});

test("object recovery reports missing bytes without leaking object locations", async () => {
  await assert.rejects(runObjectRecoveryDrill({
    restore: async () => {},
    verify: async () => { throw new Error("missing https://signed.example/private?token=secret /Users/kai/objects"); },
  }, {} as never), (error: Error) => {
    assert.equal(error.message, "Object restore verification failed");
    assert.doesNotMatch(error.message, /signed|token|Users|secret/);
    return true;
  });
});

function fakeChild(): EventEmitter & { stderr: PassThrough; kill(signal?: NodeJS.Signals): boolean } {
  return Object.assign(new EventEmitter(), {
    stderr: new PassThrough(),
    kill: () => true,
  });
}

async function writeBackupArtifact(
  directory: string,
  migrationHead: number | null,
): Promise<string> {
  const dumpPath = join(directory, "source.dump");
  await writeFile(dumpPath, "backup bytes");
  const checksum = await sha256File(dumpPath);
  const manifest = createBackupManifest({
    createdAt: "2026-07-12T00:00:00.000Z",
    postgresServerVersion: "17.5",
    migrationHead,
    releaseId: "git-abc123",
    tableCounts: { apps: 4, app_versions: 4, version_images: 12 },
    relationships: {
      appVersions: 4,
      versionImages: 12,
      invalidAppVersions: 0,
      invalidVersionImages: 0,
    },
    dumpBytes: 12,
    checksum,
  });
  await writeFile(`${dumpPath}.sha256`, `${checksum}\n`);
  await writeFile(`${dumpPath}.json`, `${JSON.stringify(manifest)}\n`);
  return dumpPath;
}

test("builds fixed PostgreSQL tool arguments and keeps credentials and TLS routing in libpq environment", () => {
  const databaseUrl = "postgres://backup_user:p%40ssword@db.internal:5433/astryx?sslmode=verify-full&sslrootcert=%2Fcerts%2Froot.pem&channel_binding=require&target_session_attrs=read-write&connect_timeout=10";
  const dumpPath = "/backups/astryx.dump";
  const snapshotId = "00000003-0000001A-1";

  const environment = libpqEnv(databaseUrl, {
    PATH: "/usr/bin",
    DATABASE_URL: "postgres://leaked:credential@other.internal/other",
    PGHOSTADDR: "192.0.2.99",
    PGSERVICE: "stale-service",
    PGOPTIONS: "-c search_path=unsafe",
  });

  assert.deepEqual(pgDumpArguments(dumpPath, snapshotId), [
    "--format=custom",
    `--snapshot=${snapshotId}`,
    "--file",
    dumpPath,
  ]);
  assert.deepEqual(pgRestoreArguments(dumpPath), [
    "--dbname=",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    dumpPath,
  ]);
  assert.deepEqual(environment, {
    PATH: "/usr/bin",
    PGHOST: "db.internal",
    PGPORT: "5433",
    PGDATABASE: "astryx",
    PGUSER: "backup_user",
    PGPASSWORD: "p@ssword",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/certs/root.pem",
    PGCHANNELBINDING: "require",
    PGTARGETSESSIONATTRS: "read-write",
    PGCONNECT_TIMEOUT: "10",
  });
  assert.doesNotMatch(
    JSON.stringify(pgDumpArguments(dumpPath, snapshotId)),
    /backup_user|p@ssword|db\.internal/,
  );
  assert.doesNotMatch(JSON.stringify(pgRestoreArguments(dumpPath)), /backup_user|p@ssword|db\.internal/);
  assert.throws(
    () => libpqEnv("postgres://localhost/astryx?unknown_option=value", {}),
    /unsupported PostgreSQL URL parameter/i,
  );
});

test("normalizes bracketed IPv6 URL hosts for libpq", () => {
  assert.equal(libpqEnv("postgres://postgres:secret@[::1]:5432/astryx", {}).PGHOST, "::1");
});

test("maps explicit backup and restore CLI inputs without exposing credentials", () => {
  assert.throws(() => backupOptionsFromEnvironment({}), /DATABASE_URL is required/);
  assert.throws(
    () => restoreOptionsFromArguments([], { RESTORE_TEST_ALLOW_DROP: "1" }),
    /dump path and target URL are required/i,
  );

  assert.deepEqual(backupOptionsFromEnvironment({
    DATABASE_URL: "postgres://operator:secret@localhost/astryx",
    BACKUP_DIR: "data/backups",
    BACKUP_BASENAME: "release-1",
    RELEASE_ID: "git-abc123",
    DB_TOOL_TIMEOUT_MS: "1234",
  }), {
    databaseUrl: "postgres://operator:secret@localhost/astryx",
    backupDirectory: "data/backups",
    basename: "release-1",
    releaseId: "git-abc123",
    timeoutMs: 1234,
  });
  assert.deepEqual(restoreOptionsFromArguments([
    "data/backups/release-1.dump",
    "postgres://operator:secret@localhost/astryx_restore_test_local",
  ], { RESTORE_TEST_ALLOW_DROP: "1", DB_TOOL_TIMEOUT_MS: "4321" }), {
    dumpPath: "data/backups/release-1.dump",
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_local",
    environment: { RESTORE_TEST_ALLOW_DROP: "1", DB_TOOL_TIMEOUT_MS: "4321" },
    timeoutMs: 4321,
  });
});

test("refuses to overwrite an existing backup artifact before invoking pg_dump", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = join(directory, "existing.dump");
  await writeFile(dumpPath, "keep me");
  let spawnCalls = 0;

  await assert.rejects(() => createDatabaseBackup({
    databaseUrl: "postgres://operator:secret@localhost/astryx",
    backupDirectory: directory,
    basename: "existing",
    spawn: (() => {
      spawnCalls += 1;
      return fakeChild();
    }),
    createPool: () => { throw new Error("pool must not be created"); },
  }), /backup artifact already exists/i);

  assert.equal(spawnCalls, 0);
  assert.equal(await readFile(dumpPath, "utf8"), "keep me");
});

test("publishes a dump, checksum, and allowlisted manifest atomically", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const commands: Array<{ command: string; args: readonly string[]; env: NodeJS.ProcessEnv }> = [];
  const events: string[] = [];
  let poolEnded = false;
  const client = {
    async query(sql: string) {
      if (sql === "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY") {
        events.push("begin");
        return { rows: [] };
      }
      if (sql === "SELECT pg_export_snapshot() AS snapshot_id") {
        events.push("export");
        return { rows: [{ snapshot_id: "00000003-0000001A-1" }] };
      }
      if (sql === "COMMIT") {
        events.push("commit");
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        events.push("rollback");
        return { rows: [] };
      }
      if (sql === "SHOW server_version") events.push("evidence");
      if (sql === "SHOW server_version") return { rows: [{ server_version: "17.5" }] };
      if (sql.includes("to_regclass")) return { rows: [{ present: false }] };
      if (sql.includes("table_name")) return { rows: [{ table_name: "apps", row_count: 4 }] };
      if (sql.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { events.push("release"); },
  };
  const pool = {
    async connect() {
      events.push("connect");
      return client;
    },
    async end() {
      poolEnded = true;
      events.push("end");
    },
  };
  const spawn = ((command: string, args: readonly string[], options: { env: NodeJS.ProcessEnv }) => {
    const child = fakeChild();
    events.push("dump:start");
    commands.push({ command, args, env: options.env });
    const outputPath = args[args.indexOf("--file") + 1];
    void writeFile(outputPath, "backup bytes").then(() => {
      events.push("dump:end");
      child.emit("close", 0, null);
    });
    return child;
  });

  const result = await createDatabaseBackup({
    databaseUrl: "postgres://operator:p%40ssword@db.internal:5433/astryx",
    backupDirectory: directory,
    basename: "verified",
    releaseId: "git-abc123",
    environment: { PATH: "/usr/bin" },
    now: () => new Date("2026-07-12T00:00:00.000Z"),
    spawn,
    createPool: () => pool,
  });

  assert.equal(await readFile(result.dumpPath, "utf8"), "backup bytes");
  assert.equal((await readFile(result.checksumPath, "utf8")).trim(), result.manifest.checksum);
  assert.deepEqual(JSON.parse(await readFile(result.manifestPath, "utf8")), result.manifest);
  assert.equal(result.manifest.migrationHead, null);
  assert.equal(result.manifest.releaseId, "git-abc123");
  assert.equal(poolEnded, true);
  assert.equal(commands[0].command, "pg_dump");
  assert.ok(commands[0].args.includes("--snapshot=00000003-0000001A-1"));
  assert.doesNotMatch(JSON.stringify(commands[0].args), /operator|p@ssword|db\.internal/);
  assert.equal(commands[0].env.PGPASSWORD, "p@ssword");
  assert.deepEqual(events, [
    "connect",
    "begin",
    "export",
    "dump:start",
    "evidence",
    "dump:end",
    "commit",
    "release",
    "end",
  ]);
  assert.deepEqual((await readdir(directory)).sort(), [
    "verified.dump",
    "verified.dump.json",
    "verified.dump.sha256",
  ]);
});

test("publishes the dump commit marker last and removes partial artifacts if it fails", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const attempted: string[] = [];
  const client = {
    async query(sql: string) {
      if (sql === "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY") return { rows: [] };
      if (sql === "SELECT pg_export_snapshot() AS snapshot_id") {
        return { rows: [{ snapshot_id: "00000003-0000001A-1" }] };
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql === "SHOW server_version") return { rows: [{ server_version: "17.5" }] };
      if (sql.includes("to_regclass")) return { rows: [{ present: false }] };
      if (sql.includes("table_name")) return { rows: [{ table_name: "apps", row_count: 4 }] };
      if (sql.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async end() {},
  };
  const spawn = ((_command: string, args: readonly string[]) => {
    const child = fakeChild();
    const outputPath = args[args.indexOf("--file") + 1];
    void writeFile(outputPath, "backup bytes").then(() => child.emit("close", 0, null));
    return child;
  });

  await assert.rejects(() => createDatabaseBackup({
    databaseUrl: "postgres://operator:secret@localhost/astryx",
    backupDirectory: directory,
    basename: "verified",
    spawn,
    createPool: () => pool,
    linkFile: async (source: string, destination: string) => {
      attempted.push(destination.slice(directory.length + 1));
      if (destination.endsWith(".dump")) throw new Error("commit marker failure");
      await link(source, destination);
    },
  }), /commit marker failure/);

  assert.deepEqual(attempted, [
    "verified.dump.sha256",
    "verified.dump.json",
    "verified.dump",
  ]);
  assert.deepEqual(await readdir(directory), []);
});

test("captures a null migration head and only non-sensitive database evidence", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      if (sql === "SHOW server_version") return { rows: [{ server_version: "17.5" }] };
      if (sql.includes("to_regclass")) return { rows: [{ present: false }] };
      if (sql.includes("table_name")) return { rows: [
        { table_name: "apps", row_count: 4 },
        { table_name: "users", row_count: 2 },
      ] };
      if (sql.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const evidence = await captureDatabaseEvidence(pool);

  assert.deepEqual(evidence, {
    postgresServerVersion: "17.5",
    migrationHead: null,
    tableCounts: { apps: 4, users: 2 },
    relationships: {
      appVersions: 4,
      versionImages: 12,
      invalidAppVersions: 0,
      invalidVersionImages: 0,
    },
  });
  assert.equal(queries.some((sql) => sql.includes("max(version)")), false);
});

test("rejects malformed or sensitive manifest fields without echoing them", () => {
  const unsafe = {
    formatVersion: 1,
    createdAt: "2026-07-12T00:00:00.000Z",
    postgresServerVersion: "17.5",
    migrationHead: "latest",
    releaseId: null,
    tableCounts: { apps: 1 },
    relationships: {
      appVersions: 1,
      versionImages: 1,
      invalidAppVersions: 0,
      invalidVersionImages: 0,
    },
    dumpBytes: 1,
    checksum: "a".repeat(64),
    databaseUrl: "postgres://operator:secret@db.internal/astryx",
  };

  assert.throws(
    () => parseBackupManifest(unsafe),
    (error: unknown) => {
      assert.equal((error as Error).message, "Invalid backup manifest");
      assert.doesNotMatch((error as Error).message, /operator|secret|db\.internal/);
      return true;
    },
  );
});

test("rejects a dump whose checksum does not match its sidecar", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = join(directory, "sample.dump");
  await writeFile(dumpPath, "backup bytes");
  const manifest = createBackupManifest({
    createdAt: "2026-07-12T00:00:00.000Z",
    postgresServerVersion: "17.5",
    migrationHead: 1,
    releaseId: null,
    tableCounts: { apps: 4 },
    relationships: {
      appVersions: 4,
      versionImages: 12,
      invalidAppVersions: 0,
      invalidVersionImages: 0,
    },
    dumpBytes: 12,
    checksum: "0".repeat(64),
  });
  await writeFile(`${dumpPath}.sha256`, `${"0".repeat(64)}\n`);
  await writeFile(`${dumpPath}.json`, `${JSON.stringify(manifest)}\n`);

  await assert.rejects(() => loadVerifiedBackup(dumpPath), /dump checksum mismatch/i);
});

test("runs PostgreSQL tools without a shell through an injected spawn", async () => {
  const child = fakeChild();
  let observed: unknown;
  const spawn = ((command: string, args: readonly string[], options: unknown) => {
    observed = { command, args, options };
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });

  await runTool("pg_dump", ["--format=custom"], {
    env: { PATH: "/usr/bin", PGPASSWORD: "secret" },
    spawn,
    timeoutMs: 50,
  });

  assert.deepEqual(observed, {
    command: "pg_dump",
    args: ["--format=custom"],
    options: {
      env: { PATH: "/usr/bin", PGPASSWORD: "secret" },
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    },
  });
});

test("reports a missing PostgreSQL tool without leaking libpq credentials", async () => {
  const child = fakeChild();
  const spawn = (() => {
    queueMicrotask(() => child.emit("error", Object.assign(
      new Error("spawn pg_dump ENOENT for operator secret db.internal"),
      { code: "ENOENT" },
    )));
    return child;
  });

  await assert.rejects(
    () => runTool("pg_dump", [], {
      env: {
        PGHOST: "db.internal",
        PGPORT: "5432",
        PGDATABASE: "astryx",
        PGUSER: "operator",
        PGPASSWORD: "secret",
      },
      spawn,
    }),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /Required PostgreSQL tool pg_dump is not installed/);
      assert.doesNotMatch(message, /operator|secret|db\.internal|astryx/);
      return true;
    },
  );
});

test("bounds PostgreSQL tool execution time", async () => {
  const child = fakeChild();
  const killedWith: NodeJS.Signals[] = [];
  child.kill = (signal?: NodeJS.Signals) => {
    if (signal) killedWith.push(signal);
    if (signal === "SIGKILL") queueMicrotask(() => child.emit("close", null, "SIGKILL"));
    return true;
  };

  await assert.rejects(
    () => runTool("pg_restore", [], {
      env: {},
      spawn: () => child,
      timeoutMs: 5,
      killGraceMs: 5,
    }),
    /pg_restore timed out after 5 ms/,
  );
  assert.deepEqual(killedWith, ["SIGTERM", "SIGKILL"]);
});

test("bounds and redacts PostgreSQL tool diagnostics", async () => {
  const child = fakeChild();
  const spawn = (() => {
    queueMicrotask(() => {
      child.stderr.write(`safe diagnostic ${"x".repeat(20_000)}`);
      child.stderr.end();
      child.emit("close", 1, null);
    });
    return child;
  });

  await assert.rejects(
    () => runTool("pg_dump", [], {
      env: { PGPASSWORD: "x" },
      spawn,
    }),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /safe diagnostic/);
      assert.doesNotMatch(message, /x{2}/);
      assert.ok(message.length <= 8_300, `diagnostic length was ${message.length}`);
      return true;
    },
  );
});

test("bounds and redacts recovery errors outside the tool process", () => {
  const url = "postgres://operator:secret@db.internal/astryx";
  const message = redactRecoveryError(
    new Error(`operator secret db.internal ${"x".repeat(20_000)}`),
    url,
  );

  assert.doesNotMatch(message, /operator|secret|db\.internal|astryx/);
  assert.ok(message.length <= 8_192, `recovery error length was ${message.length}`);
});

test("requires opt-in and a narrowly disposable restore target", () => {
  const targetUrl = "postgres://operator:secret@localhost:5432/astryx_restore_test_local";

  assert.throws(() => createRestoreTargetConfig(targetUrl, {}), /RESTORE_TEST_ALLOW_DROP=1/);
  assert.deepEqual(createRestoreTargetConfig(targetUrl, { RESTORE_TEST_ALLOW_DROP: "1" }), {
    targetUrl,
    adminUrl: "postgres://operator:secret@localhost:5432/postgres",
    databaseName: "astryx_restore_test_local",
  });

  for (const unsafe of [
    "postgres://localhost/astryx",
    "postgres://localhost/astryx_restore_test_",
    "postgres://localhost/astryx_restore_test_bad-name",
    `postgres://localhost/astryx_restore_test_${"a".repeat(64)}`,
  ]) {
    assert.throws(
      () => createRestoreTargetConfig(unsafe, { RESTORE_TEST_ALLOW_DROP: "1" }),
      /refusing unsafe restore database/i,
    );
  }
});

test("refuses an existing restore target without restoring or dropping it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, 1);
  const sql: string[] = [];
  let spawnCalls = 0;
  const adminPool = {
    async query(statement: string) {
      sql.push(statement);
      if (statement.includes("FROM pg_database")) return { rows: [{ present: true }] };
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() {},
  };

  await assert.rejects(() => verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_existing",
    environment: { RESTORE_TEST_ALLOW_DROP: "1" },
    spawn: (() => {
      spawnCalls += 1;
      return fakeChild();
    }),
    createPool: () => adminPool,
  }), /restore target already exists/i);

  assert.equal(spawnCalls, 0);
  assert.equal(sql.some((statement) => statement.startsWith("DROP DATABASE")), false);
});

test("drops only the restore target it created when pg_restore fails", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, 1);
  const sql: string[] = [];
  let observedRestore: { args: readonly string[]; env: NodeJS.ProcessEnv } | undefined;
  const adminPool = {
    async query(statement: string) {
      sql.push(statement);
      if (statement.includes("FROM pg_database")) return { rows: [{ present: false }] };
      if (statement.startsWith("CREATE DATABASE") || statement.startsWith("DROP DATABASE")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() {},
  };
  const spawn = ((_command: string, args: readonly string[], options: { env: NodeJS.ProcessEnv }) => {
    const child = fakeChild();
    observedRestore = { args, env: options.env };
    queueMicrotask(() => child.emit("close", 1, null));
    return child;
  });

  await assert.rejects(() => verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:p%40ssword@localhost:5433/astryx_restore_test_failed",
    environment: { RESTORE_TEST_ALLOW_DROP: "1", PATH: "/usr/bin" },
    spawn,
    createPool: () => adminPool,
  }), /pg_restore exited with code 1/);

  assert.deepEqual(sql.filter((statement) => /^(CREATE|DROP) DATABASE/.test(statement)), [
    'CREATE DATABASE "astryx_restore_test_failed" TEMPLATE template0',
    'DROP DATABASE "astryx_restore_test_failed" WITH (FORCE)',
  ]);
  assert.deepEqual(observedRestore?.args.slice(0, -1), pgRestoreArguments(dumpPath).slice(0, -1));
  assert.notEqual(observedRestore?.args.at(-1), dumpPath);
  assert.equal(observedRestore?.env.PGDATABASE, "astryx_restore_test_failed");
  assert.equal(observedRestore?.env.PGPASSWORD, "p@ssword");
});

test("redacts cleanup failures and still closes the admin pool", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, 1);
  let ended = false;
  const adminPool = {
    async query(statement: string) {
      if (statement.includes("FROM pg_database")) return { rows: [{ present: false }] };
      if (statement.startsWith("CREATE DATABASE")) return { rows: [] };
      if (statement.startsWith("DROP DATABASE")) {
        throw new Error("cleanup failed for operator secret localhost");
      }
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() { ended = true; },
  };
  const spawn = (() => {
    const child = fakeChild();
    queueMicrotask(() => child.emit("close", 1, null));
    return child;
  });

  await assert.rejects(() => verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_cleanup",
    environment: { RESTORE_TEST_ALLOW_DROP: "1" },
    spawn,
    createPool: () => adminPool,
  }), (error: unknown) => {
    assert.match((error as Error).message, /cleanup failed/i);
    assert.doesNotMatch((error as Error).message, /operator|secret|localhost/);
    return true;
  });
  assert.equal(ended, true);
});

test("verifies an unversioned dump has no migration ledger and matching evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, null);
  const adminSql: string[] = [];
  const targetSql: string[] = [];
  let migrationAssertionCalls = 0;
  const adminPool = {
    async query(statement: string) {
      adminSql.push(statement);
      if (statement.includes("FROM pg_database")) return { rows: [{ present: false }] };
      return { rows: [] };
    },
    async end() {},
  };
  const targetPool = {
    async query(statement: string) {
      targetSql.push(statement);
      if (statement === "SHOW server_version") return { rows: [{ server_version: "17.6" }] };
      if (statement.includes("to_regclass")) return { rows: [{ present: false }] };
      if (statement.includes("table_name")) return { rows: [
        { table_name: "apps", row_count: 4 },
        { table_name: "app_versions", row_count: 4 },
        { table_name: "version_images", row_count: 12 },
      ] };
      if (statement.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      if (statement.includes("FROM apps app_row")) return { rows: [{ id: 1 }] };
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() {},
  };
  let poolCalls = 0;
  let restorePath: string | undefined;
  const immutableSpawn = ((_command: string, args: readonly string[]) => {
    const child = fakeChild();
    restorePath = args.at(-1);
    assert.equal(restorePath ? readFileSync(restorePath, "utf8") : "", "backup bytes");
    writeFileSync(dumpPath, "tampered after verification");
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });

  const result = await verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_unversioned",
    environment: { RESTORE_TEST_ALLOW_DROP: "1" },
    spawn: immutableSpawn,
    createPool: () => (++poolCalls === 1 ? adminPool : targetPool),
    assertMigrations: async () => { migrationAssertionCalls += 1; },
  });

  assert.equal(result.migrationHead, null);
  assert.notEqual(restorePath, dumpPath);
  assert.deepEqual(result.tableCounts, { apps: 4, app_versions: 4, version_images: 12 });
  assert.equal(migrationAssertionCalls, 0);
  assert.equal(targetSql.filter((statement) => statement.includes("to_regclass")).length >= 1, true);
  assert.equal(targetSql.some((statement) => statement.includes("FROM apps app_row")), true);
  assert.equal(adminSql.at(-1), 'DROP DATABASE "astryx_restore_test_unversioned" WITH (FORCE)');
});

test("requires a current migration assertion for a versioned dump", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, 2);
  let migrationAssertionCalls = 0;
  const restoreEvents: string[] = [];
  const adminPool = {
    async query(statement: string) {
      if (statement.includes("FROM pg_database")) return { rows: [{ present: false }] };
      return { rows: [] };
    },
    async end() {},
  };
  const targetPool = {
    async query(statement: string) {
      if (statement === "SHOW server_version") return { rows: [{ server_version: "17.6" }] };
      if (statement.includes("to_regclass")) return { rows: [{ present: true }] };
      if (statement.includes("max(version)")) return { rows: [{ head: 2 }] };
      if (statement.includes("table_name")) return { rows: [
        { table_name: "apps", row_count: 4 },
        { table_name: "app_versions", row_count: 4 },
        { table_name: "version_images", row_count: 12 },
      ] };
      if (statement.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      if (statement.includes("FROM apps app_row")) return { rows: [{ id: 1 }] };
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() {},
  };
  let poolCalls = 0;
  const spawn = (() => {
    const child = fakeChild();
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });

  const result = await verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_versioned",
    environment: { RESTORE_TEST_ALLOW_DROP: "1" },
    spawn,
    createPool: () => (++poolCalls === 1 ? adminPool : targetPool),
    assertMigrations: async () => { migrationAssertionCalls += 1; },
    objectRecovery: {
      restore: async () => { restoreEvents.push("objects-restored"); },
      verify: async (pool) => {
        restoreEvents.push("objects-verified");
        assert.equal(pool, targetPool);
        return { totalObjects: 3, totalBytes: 42, evidenceSha256: "b".repeat(64) };
      },
    },
  });

  assert.equal(result.migrationHead, 2);
  assert.equal(migrationAssertionCalls, 1);
  assert.deepEqual(restoreEvents, ["objects-restored", "objects-verified"]);
  assert.deepEqual(result.objectStorage, { totalObjects: 3, totalBytes: 42, evidenceSha256: "b".repeat(64) });
});

test("object-era restore requires object parity evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = await writeBackupArtifact(directory, 2);
  const adminPool = {
    async query(statement: string) {
      if (statement.includes("FROM pg_database")) return { rows: [{ present: false }] };
      return { rows: [] };
    },
    async end() {},
  };
  const targetPool = {
    async query(statement: string) {
      if (statement === "SHOW server_version") return { rows: [{ server_version: "17.6" }] };
      if (statement.includes("to_regclass")) return { rows: [{ present: true }] };
      if (statement.includes("max(version)")) return { rows: [{ head: 2 }] };
      if (statement.includes("table_name")) return { rows: [
        { table_name: "apps", row_count: 4 },
        { table_name: "app_versions", row_count: 4 },
        { table_name: "version_images", row_count: 12 },
      ] };
      if (statement.includes("invalid_version_images")) return { rows: [{
        app_versions: 4,
        version_images: 12,
        invalid_app_versions: 0,
        invalid_version_images: 0,
      }] };
      throw new Error(`Unexpected query: ${statement}`);
    },
    async end() {},
  };
  let poolCalls = 0;
  const spawn = (() => {
    const child = fakeChild();
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });

  await assert.rejects(() => verifyDatabaseRestore({
    dumpPath,
    targetUrl: "postgres://operator:secret@localhost/astryx_restore_test_missing_objects",
    environment: { RESTORE_TEST_ALLOW_DROP: "1" },
    spawn,
    createPool: () => (++poolCalls === 1 ? adminPool : targetPool),
    assertMigrations: async () => {},
  }), (error: unknown) => {
    assert.equal((error as Error).message, "Object restore verification failed");
    assert.doesNotMatch((error as Error).message, /secret|localhost|signed|token|Users/);
    return true;
  });
});

test("computes the dump checksum and allowlists non-sensitive manifest fields", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "astryx-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dumpPath = join(directory, "sample.dump");
  await writeFile(dumpPath, "backup bytes");
  const checksum = await sha256File(dumpPath);

  const manifest = createBackupManifest({
    createdAt: "2026-07-12T00:00:00.000Z",
    postgresServerVersion: "17.5",
    migrationHead: null,
    releaseId: "git-abc123",
    tableCounts: { apps: 4, users: 2 },
    relationships: {
      appVersions: 4,
      versionImages: 12,
      invalidAppVersions: 0,
      invalidVersionImages: 0,
    },
    dumpBytes: 12,
    checksum,
    databaseUrl: "postgres://operator:secret@db.internal/astryx",
  } as Parameters<typeof createBackupManifest>[0] & { databaseUrl: string });

  assert.match(checksum, /^[0-9a-f]{64}$/);
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.migrationHead, null);
  assert.deepEqual(manifest.tableCounts, { apps: 4, users: 2 });
  assert.doesNotMatch(JSON.stringify(manifest), /operator|secret|db\.internal|databaseUrl/);
});
