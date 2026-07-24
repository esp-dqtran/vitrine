import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import type { DesignSystemSnapshot } from "./designSystem.ts";
import {
  seedDesignSystemWorkingCopy,
  type DesignSystemWorkingCopyRecord,
  type WorkingCopyQuery,
  type WorkingCopyTransaction,
} from "./designSystemWorkingCopy.ts";

function result(rows: Record<string, unknown>[] = []): QueryResult<Record<string, unknown>> {
  return { command: "", rowCount: rows.length, oid: 0, fields: [], rows };
}

function candidate(): DesignSystemSnapshot {
  return {
    app: "Alpha",
    generatedAt: "2026-07-24T00:00:00.000Z",
    tokens: [{
      id: "color-primary",
      kind: "color",
      name: "Primary",
      value: "#2663EB",
      role: "Primary action",
      evidence: [11],
      confidence: 0.88,
      reviewStatus: "needs_review",
      source: "llm_inferred",
    }],
    components: [{
      id: "button",
      name: "Button",
      category: "Actions",
      description: "Triggers an action",
      variants: [{
        id: "button-primary",
        name: "Primary",
        description: "Primary button",
        evidence: [11],
        reviewStatus: "needs_review",
        source: "llm_inferred",
      }],
    }],
    flows: [],
    rules: [],
  };
}

function emptyAutomaticWorkingCopy(): DesignSystemWorkingCopyRecord {
  return {
    snapshot: {
      app: "Alpha",
      generatedAt: "2026-07-23T00:00:00.000Z",
      tokens: [],
      components: [],
      flows: [],
      rules: [],
    },
    captureVersionId: 2,
    sourceAppKnowledgeRevisionId: 4,
    origin: "automatic",
    generatedAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
}

function automaticWorkingCopy(): DesignSystemWorkingCopyRecord {
  return {
    snapshot: candidate(),
    captureVersionId: 2,
    sourceAppKnowledgeRevisionId: 4,
    origin: "automatic",
    generatedAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
}

function transaction(
  existing: DesignSystemWorkingCopyRecord | undefined,
  calls: Array<{ sql: string; values?: readonly unknown[] }>,
): WorkingCopyTransaction {
  const query: WorkingCopyQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT id FROM apps/.test(sql)) return result([{ id: 1 }]);
    if (/SELECT snapshot, capture_version_id/.test(sql)) {
      return existing ? result([{
        snapshot: existing.snapshot,
        capture_version_id: existing.captureVersionId,
        source_app_knowledge_revision_id: existing.sourceAppKnowledgeRevisionId,
        origin: existing.origin,
        generated_at: existing.generatedAt,
        updated_at: existing.updatedAt,
      }]) : result();
    }
    return result([{ app_id: 1 }]);
  };
  return async (work) => work(query);
}

function input(
  existing: DesignSystemWorkingCopyRecord | undefined,
  calls: Array<{ sql: string; values?: readonly unknown[] }> = [],
) {
  return {
    app: "Alpha",
    platform: "web",
    candidate: candidate(),
    captureVersionId: 3,
    sourceAppKnowledgeRevisionId: 5,
    generatedAt: "2026-07-24T00:00:00.000Z",
    transaction: transaction(existing, calls),
  };
}

test("seeds an absent or structurally empty working copy", async () => {
  assert.equal(await seedDesignSystemWorkingCopy(input(undefined)), "seeded");
  assert.equal(
    await seedDesignSystemWorkingCopy(input(emptyAutomaticWorkingCopy())),
    "replaced",
  );
});

test("does not overwrite reviewed, curator-edited, or imported content", async () => {
  const reviewed = automaticWorkingCopy();
  reviewed.snapshot.tokens[0].reviewStatus = "reviewed";
  assert.equal(await seedDesignSystemWorkingCopy(input(reviewed)), "conflict");

  const edited = automaticWorkingCopy();
  delete edited.snapshot.tokens[0].source;
  assert.equal(await seedDesignSystemWorkingCopy(input(edited)), "conflict");

  const imported = { ...automaticWorkingCopy(), origin: "imported" as const };
  assert.equal(await seedDesignSystemWorkingCopy(input(imported)), "conflict");
});

test("replaces an unreviewed automatic copy only for newer provenance", async () => {
  const current = automaticWorkingCopy();
  assert.equal(await seedDesignSystemWorkingCopy(input(current)), "replaced");

  assert.equal(await seedDesignSystemWorkingCopy({
    ...input(current),
    captureVersionId: 2,
    sourceAppKnowledgeRevisionId: 5,
  }), "replaced");

  assert.equal(await seedDesignSystemWorkingCopy({
    ...input(current),
    captureVersionId: 2,
    sourceAppKnowledgeRevisionId: 4,
  }), "unchanged");

  assert.equal(await seedDesignSystemWorkingCopy({
    ...input(current),
    captureVersionId: 1,
    sourceAppKnowledgeRevisionId: 99,
  }), "conflict");
});

test("never writes immutable published design-system versions", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  assert.equal(await seedDesignSystemWorkingCopy(input(undefined, calls)), "seeded");
  assert.equal(calls.some(({ sql }) => /design_system_versions/.test(sql)), false);
  assert.equal(calls.some(({ sql }) =>
    /design_systems/.test(sql) && /'automatic'/.test(sql)), true);
});
