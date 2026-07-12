import { spawn as nodeSpawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import type { EventEmitter } from "node:events";
import { constants as fsConstants, createReadStream } from "node:fs";
import { chmod, copyFile, link, lstat, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import pg from "pg";
import { assertMigrationsCurrent } from "./migrations.ts";

interface ToolChild extends EventEmitter {
  stderr: Readable | null;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnTool = (
  command: string,
  args: readonly string[],
  options: {
    env: NodeJS.ProcessEnv;
    shell: false;
    stdio: ["ignore", "ignore", "pipe"];
  },
) => ToolChild;

export interface RunToolOptions {
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  killGraceMs?: number;
  spawn?: SpawnTool;
}

function redactedMessage(error: unknown, environment: NodeJS.ProcessEnv): string {
  let message = error instanceof Error ? error.message : "PostgreSQL tool failed";
  const secrets = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    .map((name) => environment[name])
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length);
  for (const secret of secrets) message = message.split(secret).join("[redacted]");
  return message.slice(0, 8_192);
}

export async function runTool(
  command: string,
  args: readonly string[],
  options: RunToolOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const killGraceMs = options.killGraceMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("PostgreSQL tool timeout must be a positive integer");
  }
  if (!Number.isInteger(killGraceMs) || killGraceMs <= 0) {
    throw new Error("PostgreSQL tool kill grace must be a positive integer");
  }
  const spawn: SpawnTool = options.spawn ?? ((tool, toolArgs, spawnOptions) => (
    nodeSpawn(tool, [...toolArgs], spawnOptions)
  ));
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let diagnostics = Buffer.alloc(0);
    const child = spawn(command, args, {
      env: options.env,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      if (diagnostics.length >= 8_192) return;
      const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      diagnostics = Buffer.concat([diagnostics, incoming.subarray(0, 8_192 - diagnostics.length)]);
    });
    let escalation: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill("SIGTERM");
      escalation = setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, killGraceMs);
    }, timeoutMs);
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if (timedOut) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(error.code === "ENOENT"
        ? `Required PostgreSQL tool ${command} is not installed`
        : redactedMessage(error, options.env)));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (escalation) clearTimeout(escalation);
      if (timedOut) {
        reject(new Error(`${command} timed out after ${timeoutMs} ms`));
        return;
      }
      if (code === 0) resolve();
      else {
        const detail = diagnostics.toString("utf8").trim();
        const suffix = detail ? `: ${redactedMessage(new Error(detail), options.env)}` : "";
        reject(new Error(`${command} exited with code ${String(code)}${suffix}`));
      }
    });
  });
}

export function libpqEnv(
  databaseUrl: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database URL must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Database URL must use PostgreSQL");
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!parsed.hostname || !database) throw new Error("Database URL must name a host and database");
  const environment = { ...baseEnvironment };
  for (const name of Object.keys(environment)) {
    if (name.startsWith("PG") || name === "DATABASE_URL" || name.endsWith("_DATABASE_URL")) {
      delete environment[name];
    }
  }
  const host = parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]")
    ? parsed.hostname.slice(1, -1)
    : parsed.hostname;
  const result: NodeJS.ProcessEnv = {
    ...environment,
    PGHOST: host,
    PGPORT: parsed.port || "5432",
    PGDATABASE: database,
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
  };
  const enumParameter = (
    name: string,
    target: string,
    allowed: readonly string[],
  ): void => {
    const value = parsed.searchParams.get(name);
    if (value === null) return;
    if (!allowed.includes(value)) throw new Error(`Invalid PostgreSQL URL parameter: ${name}`);
    result[target] = value;
  };
  enumParameter("sslmode", "PGSSLMODE", ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]);
  enumParameter("channel_binding", "PGCHANNELBINDING", ["disable", "prefer", "require"]);
  enumParameter("target_session_attrs", "PGTARGETSESSIONATTRS", [
    "any", "read-write", "read-only", "primary", "standby", "prefer-standby",
  ]);
  for (const [name, target] of [
    ["sslrootcert", "PGSSLROOTCERT"],
    ["sslcert", "PGSSLCERT"],
    ["sslkey", "PGSSLKEY"],
    ["application_name", "PGAPPNAME"],
  ] as const) {
    const value = parsed.searchParams.get(name);
    if (value !== null) {
      if (!value || value.length > 4_096 || value.includes("\0")) {
        throw new Error(`Invalid PostgreSQL URL parameter: ${name}`);
      }
      result[target] = value;
    }
  }
  const connectTimeout = parsed.searchParams.get("connect_timeout");
  if (connectTimeout !== null) {
    const seconds = Number(connectTimeout);
    if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 300) {
      throw new Error("Invalid PostgreSQL URL parameter: connect_timeout");
    }
    result.PGCONNECT_TIMEOUT = connectTimeout;
  }
  const supported = new Set([
    "sslmode", "sslrootcert", "sslcert", "sslkey", "channel_binding",
    "target_session_attrs", "connect_timeout", "application_name",
  ]);
  for (const name of parsed.searchParams.keys()) {
    if (!supported.has(name)) throw new Error(`Unsupported PostgreSQL URL parameter: ${name}`);
  }
  return result;
}

export interface RestoreTargetConfig {
  targetUrl: string;
  adminUrl: string;
  databaseName: string;
}

export function createRestoreTargetConfig(
  targetUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
): RestoreTargetConfig {
  if (environment.RESTORE_TEST_ALLOW_DROP !== "1") {
    throw new Error("RESTORE_TEST_ALLOW_DROP=1 is required");
  }
  libpqEnv(targetUrl, {});
  const parsed = new URL(targetUrl);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^astryx_restore_test_[a-z0-9_]+$/.test(databaseName) || databaseName.length > 63) {
    throw new Error(`Refusing unsafe restore database: ${databaseName}`);
  }
  const admin = new URL(targetUrl);
  admin.pathname = "/postgres";
  return { targetUrl, adminUrl: admin.toString(), databaseName };
}

export function pgDumpArguments(dumpPath: string, snapshotId: string): string[] {
  return ["--format=custom", `--snapshot=${snapshotId}`, "--file", dumpPath];
}

export function pgRestoreArguments(dumpPath: string): string[] {
  return [
    "--dbname=",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    dumpPath,
  ];
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export interface RelationshipEvidence {
  appVersions: number;
  versionImages: number;
  invalidAppVersions: number;
  invalidVersionImages: number;
}

export interface DatabaseEvidence {
  postgresServerVersion: string;
  migrationHead: number | null;
  tableCounts: Record<string, number>;
  relationships: RelationshipEvidence;
}

export interface RecoveryQueryable {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface RecoveryPool extends RecoveryQueryable {
  end(): Promise<void>;
}

export interface RecoveryClient extends RecoveryQueryable {
  release(): void;
}

export interface BackupRecoveryPool {
  connect(): Promise<RecoveryClient>;
  end(): Promise<void>;
}

const EVIDENCE_TABLES = [
  "apps",
  "platforms",
  "images",
  "jobs",
  "users",
  "sessions",
  "subscriptions",
  "free_app_unlocks",
  "stripe_events",
  "export_usage",
  "access_events",
  "design_systems",
  "app_flows",
  "app_versions",
  "version_images",
  "design_system_versions",
  "app_flow_versions",
  "review_issues",
  "exports",
  "crawl_plans",
  "crawl_runs",
  "crawl_evidence",
  "crawl_run_steps",
  "crawl_repairs",
  "collections",
  "collection_items",
] as const;

export async function captureDatabaseEvidence(pool: RecoveryQueryable): Promise<DatabaseEvidence> {
  const version = await pool.query("SHOW server_version");
  const ledger = await pool.query(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
  );
  let migrationHead: number | null = null;
  if (ledger.rows[0]?.present === true) {
    const head = await pool.query("SELECT max(version)::integer AS head FROM schema_migrations");
    migrationHead = head.rows[0]?.head as number | null;
  }

  const counts = await pool.query(EVIDENCE_TABLES.map((table) => (
    `SELECT '${table}' AS table_name, count(*)::integer AS row_count FROM "${table}"`
  )).join("\nUNION ALL\n"));
  const relationshipResult = await pool.query(`SELECT
    (SELECT count(*)::integer FROM app_versions) AS app_versions,
    (SELECT count(*)::integer FROM version_images) AS version_images,
    (SELECT count(*)::integer
       FROM app_versions version_row
       LEFT JOIN apps app_row ON app_row.id = version_row.app_id
      WHERE app_row.id IS NULL) AS invalid_app_versions,
    (SELECT count(*)::integer
       FROM version_images link_row
       LEFT JOIN app_versions version_row ON version_row.id = link_row.version_id
       LEFT JOIN images image_row ON image_row.id = link_row.image_id
      WHERE version_row.id IS NULL OR image_row.id IS NULL) AS invalid_version_images`);
  const relationships = relationshipResult.rows[0] ?? {};

  return {
    postgresServerVersion: String(version.rows[0]?.server_version ?? ""),
    migrationHead,
    tableCounts: Object.fromEntries(counts.rows.map((row) => [
      String(row.table_name),
      Number(row.row_count),
    ])),
    relationships: {
      appVersions: Number(relationships.app_versions),
      versionImages: Number(relationships.version_images),
      invalidAppVersions: Number(relationships.invalid_app_versions),
      invalidVersionImages: Number(relationships.invalid_version_images),
    },
  };
}

export interface BackupManifestInput {
  createdAt: string;
  postgresServerVersion: string;
  migrationHead: number | null;
  releaseId: string | null;
  tableCounts: Record<string, number>;
  relationships: RelationshipEvidence;
  dumpBytes: number;
  checksum: string;
}

export interface BackupManifest extends BackupManifestInput {
  formatVersion: 1;
}

export function createBackupManifest(input: BackupManifestInput): BackupManifest {
  return {
    formatVersion: 1,
    createdAt: input.createdAt,
    postgresServerVersion: input.postgresServerVersion,
    migrationHead: input.migrationHead,
    releaseId: input.releaseId,
    tableCounts: { ...input.tableCounts },
    relationships: { ...input.relationships },
    dumpBytes: input.dumpBytes,
    checksum: input.checksum,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function parseBackupManifest(value: unknown): BackupManifest {
  const keys = [
    "formatVersion",
    "createdAt",
    "postgresServerVersion",
    "migrationHead",
    "releaseId",
    "tableCounts",
    "relationships",
    "dumpBytes",
    "checksum",
  ];
  if (!isRecord(value) || !hasOnlyKeys(value, keys)) throw new Error("Invalid backup manifest");
  if (
    value.formatVersion !== 1
    || typeof value.createdAt !== "string"
    || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.postgresServerVersion !== "string"
    || value.postgresServerVersion.length === 0
    || !(value.migrationHead === null || (Number.isSafeInteger(value.migrationHead) && Number(value.migrationHead) > 0))
    || !(value.releaseId === null || typeof value.releaseId === "string")
    || !isCount(value.dumpBytes)
    || typeof value.checksum !== "string"
    || !/^[0-9a-f]{64}$/.test(value.checksum)
    || !isRecord(value.tableCounts)
    || Object.entries(value.tableCounts).some(([name, count]) => !/^[a-z][a-z0-9_]*$/.test(name) || !isCount(count))
    || !isRecord(value.relationships)
    || !hasOnlyKeys(value.relationships, [
      "appVersions",
      "versionImages",
      "invalidAppVersions",
      "invalidVersionImages",
    ])
    || Object.values(value.relationships).some((count) => !isCount(count))
  ) {
    throw new Error("Invalid backup manifest");
  }
  return createBackupManifest({
    createdAt: value.createdAt,
    postgresServerVersion: value.postgresServerVersion,
    migrationHead: value.migrationHead as number | null,
    releaseId: value.releaseId as string | null,
    tableCounts: value.tableCounts as Record<string, number>,
    relationships: value.relationships as unknown as RelationshipEvidence,
    dumpBytes: value.dumpBytes,
    checksum: value.checksum,
  });
}

export async function loadVerifiedBackup(
  dumpPath: string,
): Promise<{ dumpPath: string; manifest: BackupManifest }> {
  const [sidecar, manifestJson, checksum, dumpStat] = await Promise.all([
    readFile(`${dumpPath}.sha256`, "utf8"),
    readFile(`${dumpPath}.json`, "utf8"),
    sha256File(dumpPath),
    stat(dumpPath),
  ]);
  const sidecarChecksum = sidecar.trim();
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestJson);
  } catch {
    throw new Error("Invalid backup manifest");
  }
  const manifest = parseBackupManifest(manifestValue);
  if (checksum !== sidecarChecksum || checksum !== manifest.checksum) {
    throw new Error("Dump checksum mismatch");
  }
  if (dumpStat.size !== manifest.dumpBytes) throw new Error("Dump size does not match manifest");
  return { dumpPath, manifest };
}

interface StagedBackup {
  directory: string;
  dumpPath: string;
  manifest: BackupManifest;
}

async function stageVerifiedBackup(dumpPath: string): Promise<StagedBackup> {
  const verified = await loadVerifiedBackup(dumpPath);
  const directory = await mkdtemp(join(tmpdir(), "astryx-restore-"));
  const stagedPath = join(directory, "verified.dump");
  try {
    await copyFile(dumpPath, stagedPath, fsConstants.COPYFILE_EXCL);
    await chmod(stagedPath, 0o600);
    const [checksum, stagedStat] = await Promise.all([
      sha256File(stagedPath),
      stat(stagedPath),
    ]);
    if (checksum !== verified.manifest.checksum || stagedStat.size !== verified.manifest.dumpBytes) {
      throw new Error("Dump changed while preparing restore");
    }
    return { directory, dumpPath: stagedPath, manifest: verified.manifest };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export interface CreateDatabaseBackupOptions {
  databaseUrl: string;
  backupDirectory: string;
  basename: string;
  releaseId?: string | null;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  spawn?: SpawnTool;
  createPool?: (databaseUrl: string) => BackupRecoveryPool;
  linkFile?: (source: string, destination: string) => Promise<void>;
  now?: () => Date;
}

export interface DatabaseBackupResult {
  dumpPath: string;
  checksumPath: string;
  manifestPath: string;
  manifest: BackupManifest;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function redactRecoveryError(error: unknown, databaseUrl: string): string {
  let message = error instanceof Error ? error.message : "Database recovery failed";
  const secrets = new Set([databaseUrl]);
  try {
    const environment = libpqEnv(databaseUrl, {});
    for (const name of ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
      if (environment[name]) secrets.add(environment[name]!);
    }
  } catch {
    // URL validation reports a safe fixed message separately.
  }
  for (const secret of [...secrets].filter(Boolean).sort((left, right) => right.length - left.length)) {
    message = message.split(secret).join("[redacted]");
  }
  return message.slice(0, 8_192);
}

export async function createDatabaseBackup(
  options: CreateDatabaseBackupOptions,
): Promise<DatabaseBackupResult> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(options.basename)) {
    throw new Error("Backup basename must contain only letters, numbers, dots, underscores, and hyphens");
  }
  libpqEnv(options.databaseUrl, options.environment ?? process.env);
  await mkdir(options.backupDirectory, { recursive: true });
  const dumpPath = join(options.backupDirectory, `${options.basename}.dump`);
  const checksumPath = `${dumpPath}.sha256`;
  const manifestPath = `${dumpPath}.json`;
  if ((await Promise.all([dumpPath, checksumPath, manifestPath].map(pathExists))).some(Boolean)) {
    throw new Error("Backup artifact already exists");
  }
  const suffix = `.tmp-${process.pid}-${randomUUID()}`;
  const temporary = {
    dump: `${dumpPath}${suffix}`,
    checksum: `${checksumPath}${suffix}`,
    manifest: `${manifestPath}${suffix}`,
  };
  const published: string[] = [];
  try {
    const createPool = options.createPool ?? ((databaseUrl) => (
      new pg.Pool({ connectionString: databaseUrl }) as unknown as BackupRecoveryPool
    ));
    const pool = createPool(options.databaseUrl);
    let client: RecoveryClient | undefined;
    let transactionOpen = false;
    let evidence: DatabaseEvidence | undefined;
    let backupError: unknown;
    let cleanupError: unknown;
    try {
      client = await pool.connect();
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      transactionOpen = true;
      const snapshot = await client.query("SELECT pg_export_snapshot() AS snapshot_id");
      const snapshotId = snapshot.rows[0]?.snapshot_id;
      if (typeof snapshotId !== "string" || !/^[a-zA-Z0-9-]+$/.test(snapshotId)) {
        throw new Error("PostgreSQL returned an invalid exported snapshot identifier");
      }
      const [dumpResult, evidenceResult] = await Promise.allSettled([
        runTool("pg_dump", pgDumpArguments(temporary.dump, snapshotId), {
          env: libpqEnv(options.databaseUrl, options.environment ?? process.env),
          timeoutMs: options.timeoutMs,
          spawn: options.spawn,
        }),
        captureDatabaseEvidence(client),
      ]);
      if (dumpResult.status === "rejected") throw dumpResult.reason;
      if (evidenceResult.status === "rejected") throw evidenceResult.reason;
      evidence = evidenceResult.value;
      await client.query("COMMIT");
      transactionOpen = false;
    } catch (error) {
      backupError = error;
    }
    if (transactionOpen && client) {
      try {
        await client.query("ROLLBACK");
      } catch (error) {
        cleanupError = error;
      }
    }
    if (client) {
      try {
        client.release();
      } catch (error) {
        cleanupError ??= error;
      }
    }
    try {
      await pool.end();
    } catch (error) {
      cleanupError ??= error;
    }
    if (backupError !== undefined && cleanupError !== undefined) {
      throw new Error("Database backup failed and snapshot cleanup also failed", { cause: backupError });
    }
    if (backupError !== undefined) throw backupError;
    if (cleanupError !== undefined) throw cleanupError;
    if (!evidence) throw new Error("Database backup did not capture snapshot evidence");

    await chmod(temporary.dump, 0o600);
    const [checksum, dumpStat] = await Promise.all([
      sha256File(temporary.dump),
      stat(temporary.dump),
    ]);
    const manifest = createBackupManifest({
      createdAt: (options.now ?? (() => new Date()))().toISOString(),
      postgresServerVersion: evidence.postgresServerVersion,
      migrationHead: evidence.migrationHead,
      releaseId: options.releaseId ?? null,
      tableCounts: evidence.tableCounts,
      relationships: evidence.relationships,
      dumpBytes: dumpStat.size,
      checksum,
    });
    await Promise.all([
      writeFile(temporary.checksum, `${checksum}\n`, { flag: "wx", mode: 0o600 }),
      writeFile(temporary.manifest, `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 }),
    ]);

    const linkFile = options.linkFile ?? link;
    for (const [source, destination] of [
      [temporary.checksum, checksumPath],
      [temporary.manifest, manifestPath],
      [temporary.dump, dumpPath],
    ] as const) {
      await linkFile(source, destination);
      published.push(destination);
    }
    await Promise.all(Object.values(temporary).map(removeIfPresent));
    return { dumpPath, checksumPath, manifestPath, manifest };
  } catch (error) {
    await Promise.all([
      ...Object.values(temporary).map(removeIfPresent),
      ...published.map(removeIfPresent),
    ]).catch(() => undefined);
    throw new Error(redactRecoveryError(error, options.databaseUrl));
  }
}

export interface VerifyDatabaseRestoreOptions {
  dumpPath: string;
  targetUrl: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  spawn?: SpawnTool;
  createPool?: (databaseUrl: string) => RecoveryPool;
  assertMigrations?: (pool: RecoveryPool) => Promise<void>;
  objectRecovery?: ObjectRecoveryDrill;
}

export interface ObjectRecoveryEvidence {
  totalObjects: number;
  totalBytes: number;
  evidenceSha256: string;
}

export interface ObjectRecoveryDrill {
  restore(): Promise<void>;
  verify(pool: RecoveryPool): Promise<ObjectRecoveryEvidence>;
}

export interface DatabaseRestoreResult {
  targetDatabase: string;
  checksum: string;
  migrationHead: number | null;
  tableCounts: Record<string, number>;
  relationships: RelationshipEvidence;
  objectStorage?: ObjectRecoveryEvidence;
}

export async function runObjectRecoveryDrill(
  drill: ObjectRecoveryDrill,
  pool: RecoveryPool,
): Promise<ObjectRecoveryEvidence> {
  try {
    await drill.restore();
    const evidence = await drill.verify(pool);
    if (
      !Number.isSafeInteger(evidence.totalObjects) || evidence.totalObjects < 0
      || !Number.isSafeInteger(evidence.totalBytes) || evidence.totalBytes < 0
      || !/^[0-9a-f]{64}$/.test(evidence.evidenceSha256)
    ) throw new Error("invalid evidence");
    return evidence;
  } catch {
    throw new Error("Object restore verification failed");
  }
}

function quotedDatabaseName(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function sameNumericRecord(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftEntries = Object.entries(left).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  const rightEntries = Object.entries(right).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

export async function verifyDatabaseRestore(
  options: VerifyDatabaseRestoreOptions,
): Promise<DatabaseRestoreResult> {
  const config = createRestoreTargetConfig(options.targetUrl, options.environment ?? process.env);
  const artifact = await stageVerifiedBackup(options.dumpPath);
  try {
  const createPool = options.createPool ?? ((databaseUrl) => (
    new pg.Pool({ connectionString: databaseUrl }) as unknown as RecoveryPool
  ));
  const adminPool = createPool(config.adminUrl);
  let created = false;
  let result: DatabaseRestoreResult | undefined;
  let operationError: unknown;
  try {
    const existing = await adminPool.query(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present",
      [config.databaseName],
    );
    if (existing.rows[0]?.present === true) throw new Error("Restore target already exists");
    await adminPool.query(`CREATE DATABASE ${quotedDatabaseName(config.databaseName)} TEMPLATE template0`);
    created = true;
    await runTool("pg_restore", pgRestoreArguments(artifact.dumpPath), {
      env: libpqEnv(config.targetUrl, options.environment ?? process.env),
      timeoutMs: options.timeoutMs,
      spawn: options.spawn,
    });
    const targetPool = createPool(config.targetUrl);
    let evidence: DatabaseEvidence;
    let objectStorage: ObjectRecoveryEvidence | undefined;
    try {
      evidence = await captureDatabaseEvidence(targetPool);
      const ledger = await targetPool.query(
        "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
      );
      if (artifact.manifest.migrationHead === null) {
        if (ledger.rows[0]?.present === true) {
          throw new Error("Unversioned backup unexpectedly restored a migration ledger");
        }
      } else {
        if (evidence.migrationHead !== artifact.manifest.migrationHead) {
          throw new Error("Restored migration head does not match manifest");
        }
        const assertMigrations = options.assertMigrations ?? (async (pool) => {
          await assertMigrationsCurrent(pool as unknown as pg.Pool);
        });
        await assertMigrations(targetPool);
      }
      if (artifact.manifest.migrationHead !== null && artifact.manifest.migrationHead >= 2 && !options.objectRecovery) {
        throw new Error("Object restore verification failed");
      }
      if (options.objectRecovery) {
        objectStorage = await runObjectRecoveryDrill(options.objectRecovery, targetPool);
      }
      await targetPool.query("SELECT app_row.id FROM apps app_row ORDER BY app_row.id LIMIT 1");
    } finally {
      await targetPool.end();
    }

    if (!sameNumericRecord(evidence.tableCounts, artifact.manifest.tableCounts)) {
      throw new Error("Restored table counts do not match manifest");
    }
    if (!sameNumericRecord(
      evidence.relationships as unknown as Record<string, number>,
      artifact.manifest.relationships as unknown as Record<string, number>,
    )) {
      throw new Error("Restored relationships do not match manifest");
    }
    if (evidence.relationships.invalidAppVersions !== 0 || evidence.relationships.invalidVersionImages !== 0) {
      throw new Error("Restored database contains invalid core relationships");
    }
    result = {
      targetDatabase: config.databaseName,
      checksum: artifact.manifest.checksum,
      migrationHead: evidence.migrationHead,
      tableCounts: evidence.tableCounts,
      relationships: evidence.relationships,
      ...(objectStorage ? { objectStorage } : {}),
    };
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (created) {
    try {
      await adminPool.query(
        `DROP DATABASE ${quotedDatabaseName(config.databaseName)} WITH (FORCE)`,
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await adminPool.end();
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    const cleanupMessage = cleanupErrors
      .map((error) => redactRecoveryError(error, options.targetUrl))
      .join("; ");
    const prefix = operationError === undefined
      ? "Restore cleanup failed"
      : `Restore failed: ${redactRecoveryError(operationError, options.targetUrl)}; cleanup failed`;
    throw new Error(`${prefix}: ${cleanupMessage}`);
  }
  if (operationError !== undefined) {
    throw new Error(redactRecoveryError(operationError, options.targetUrl));
  }
  if (!result) throw new Error("Database restore verification did not produce a result");
  return result;
  } finally {
    await rm(artifact.directory, { recursive: true, force: true });
  }
}
