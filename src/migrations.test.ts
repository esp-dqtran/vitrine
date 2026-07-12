import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { discoverMigrations, validateMigrationState } from "./migrations.ts";

async function temporaryDirectory(t: { after(fn: () => Promise<void>): void }): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "astryx-migrations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("discovers contiguous immutable migrations and identifies pending versions", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");

  const files = await discoverMigrations(directory);

  assert.deepEqual(files.map(({ version, name }) => [version, name]), [
    [1, "base"],
    [2, "more"],
  ]);
  assert.match(files[0].checksum, /^[0-9a-f]{64}$/);
  assert.deepEqual(validateMigrationState(files, [{
    version: 1,
    name: "base",
    checksum: files[0].checksum,
  }]).pending.map(({ version }) => version), [2]);
});

test("rejects invalid names, sequence gaps, and top-level transaction statements", async (t) => {
  const root = await temporaryDirectory(t);

  const invalidName = join(root, "invalid-name");
  await mkdir(invalidName);
  await writeFile(join(invalidName, "1_base.sql"), "SELECT 1;\n");
  await assert.rejects(() => discoverMigrations(invalidName), /Invalid migration filename: 1_base\.sql/);

  const gap = join(root, "gap");
  await mkdir(gap);
  await writeFile(join(gap, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(gap, "0003_gap.sql"), "SELECT 3;\n");
  await assert.rejects(() => discoverMigrations(gap), /sequence gap.*0003_gap/i);

  const transaction = join(root, "transaction");
  await mkdir(transaction);
  await writeFile(join(transaction, "0001_bad.sql"), "BEGIN;\nSELECT 1;\nCOMMIT;\n");
  await assert.rejects(() => discoverMigrations(transaction), /contains a transaction statement/i);

  const procedural = join(root, "procedural");
  await mkdir(procedural);
  await writeFile(join(procedural, "0001_do_block.sql"), "DO $$ BEGIN\n  PERFORM 1;\nEND $$;\n");
  assert.equal((await discoverMigrations(procedural)).length, 1);
});

test("rejects changed, missing, and discontinuous applied migrations", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(join(directory, "0001_base.sql"), "SELECT 1;\n");
  await writeFile(join(directory, "0002_more.sql"), "SELECT 2;\n");
  const files = await discoverMigrations(directory);

  assert.throws(() => validateMigrationState(files, [{
    version: 1,
    name: "base",
    checksum: "0".repeat(64),
  }]), /does not match its immutable file/);

  assert.throws(() => validateMigrationState([], [{
    version: 1,
    name: "missing",
    checksum: "0".repeat(64),
  }]), /not present on disk/);

  assert.throws(() => validateMigrationState(files, [{
    version: 2,
    name: "more",
    checksum: files[1].checksum,
  }]), /sequence gap at version 2/);
});
