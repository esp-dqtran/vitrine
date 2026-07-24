import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import {
  createAppKnowledgeStore,
  type DatabaseQuery,
} from "./appKnowledgeStore.ts";
import type { AppKnowledgeSnapshot } from "./appKnowledge.ts";
import type { AppKnowledgeEvidenceManifestItem } from "./appKnowledgeEvidence.ts";

function result(rows: Record<string, unknown>[] = [], rowCount = rows.length): QueryResult<Record<string, unknown>> {
  return {
    command: "",
    rowCount,
    oid: 0,
    fields: [],
    rows,
  };
}

const manifest: AppKnowledgeEvidenceManifestItem[] = [{
  evidenceId: "SCREEN-1",
  imageId: 11,
  kind: "screen",
  eligibility: "eligible",
  reason: "screen_capture",
  object: {
    sha256: "b".repeat(64),
    byteSize: 1_024,
    contentType: "image/webp",
  },
}];

function snapshot(): AppKnowledgeSnapshot {
  const observed = {
    id: "language-layout",
    kind: "observed" as const,
    text: "The primary content uses a single column.",
    evidenceIds: ["SCREEN-1"],
    confidence: 0.9,
  };
  return {
    identity: {
      app: "Alpha",
      platform: "web",
      captureVersionId: 3,
      sourceSha256: "a".repeat(64),
      providerModel: "test-model",
      promptVersion: 1,
      generatedAt: "2026-07-24T00:00:00.000Z",
    },
    coverage: {
      total: 1,
      eligible: 1,
      analyzed: 1,
      cached: 0,
      quarantined: 0,
      skipped: 0,
      failed: 0,
      duplicateVisuals: 0,
      byKind: {
        screen: { total: 1, eligible: 1, analyzed: 1, cached: 0, quarantined: 0, failed: 0 },
        flow_step: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
        ui_element: { total: 0, eligible: 0, analyzed: 0, cached: 0, quarantined: 0, failed: 0 },
      },
      flowReferences: { total: 0, resolved: 0, uniqueImages: 0 },
    },
    screens: [{
      id: "screen-1",
      evidenceId: "SCREEN-1",
      pageType: "Dashboard",
      productArea: "Home",
      purpose: "Orient the user",
      viewport: "desktop",
      visibleText: ["Home"],
      theme: "light",
      visualHierarchy: ["Heading"],
      layoutPatterns: ["Single column"],
      contentPatterns: ["Summary"],
      imagery: [],
      icons: [],
      interactionPatterns: [],
      visibleStates: ["Default"],
      availableActions: [],
      systemFeedback: [],
      accessibilityObservations: [],
      claims: [],
      confidence: 0.9,
      reviewStatus: "needs_review",
    }],
    componentCandidates: [],
    designLanguage: {
      color: [],
      typography: [],
      spacing: [],
      radius: [],
      border: [],
      effects: [],
      layout: [observed],
      iconography: [],
      imagery: [],
      responsive: [],
      content: [],
      interaction: [],
    },
    flows: [],
    productKnowledge: {
      capabilities: [{ ...observed, id: "capability-home" }],
      featureRelationships: [],
      userJourneys: [],
      actorResponsibilities: [],
      requirements: [],
      acceptanceCriteria: [],
      edgeCases: [],
      dependencies: [],
      risks: [],
      successMetrics: [],
      guardrails: [],
      analyticsEvents: [],
      openQuestions: [],
    },
  };
}

test("parses an automatic job without a requesting user", async () => {
  const query: DatabaseQuery = async () => result([{
    id: 9,
    snapshot_id: 3,
    transport_job_id: 7,
    requested_by: null,
    request_origin: "automatic",
    status: "queued",
    stage: "preparing",
    done_count: 0,
    total_count: 1,
    synthesis_done_count: 0,
    synthesis_total_count: 2,
    cache_hit_count: 0,
    failed_count: 0,
    evidence_manifest: null,
    source_sha256: null,
    provider_model: "test-model",
    prompt_version: 1,
    cancel_requested: false,
    retry_failed_only: false,
    error_code: null,
    error_message: null,
    updated_at: "2026-07-24T00:00:00.000Z",
  }]);

  const job = await createAppKnowledgeStore(query).getJob(9);

  assert.equal(job?.requestedBy, null);
  assert.equal(job?.requestOrigin, "automatic");
  assert.equal(job?.synthesisDoneCount, 0);
  assert.equal(job?.synthesisTotalCount, 2);
});

test("parses a generated revision without a creating user", async () => {
  const content = snapshot();
  const query: DatabaseQuery = async (sql) => {
    if (sql.includes("FROM app_knowledge_snapshots s")) {
      return result([{
        id: 3,
        current_revision_id: 4,
        approved_revision_id: null,
        app_id: 1,
        app: "Alpha",
        platform_id: 2,
        platform: "web",
        capture_version_id: 3,
        version_number: 1,
      }]);
    }
    if (sql.includes("FROM app_knowledge_revisions r")) {
      return result([{
        id: 4,
        snapshot_id: 3,
        revision_number: 1,
        author_type: "generated",
        review_status: "draft",
        content,
        evidence_manifest: manifest,
        source_sha256: "a".repeat(64),
        provider_model: "test-model",
        prompt_version: 1,
        created_by: null,
        created_at: "2026-07-24T00:00:00.000Z",
      }]);
    }
    return result();
  };

  const view = await createAppKnowledgeStore(query).getAdminSnapshot(3);

  assert.equal(view?.currentRevision?.authorType, "generated");
  assert.equal(view?.currentRevision?.createdBy, null);
});

test("prepares deterministic design-system chunks and returns their durable state", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT chunk_key")) {
      return result([
        {
          chunk_key: "a".repeat(64),
          ordinal: 0,
          status: "pending",
          fragment: null,
          attempt_count: 0,
          error_code: null,
        },
        {
          chunk_key: "b".repeat(64),
          ordinal: 1,
          status: "complete",
          fragment: { components: [] },
          attempt_count: 1,
          error_code: null,
        },
      ]);
    }
    return result([], 1);
  };
  const store = createAppKnowledgeStore(query);

  const records = await store.prepareDesignSystemChunks(7, [
    { key: "a".repeat(64), ordinal: 0 },
    { key: "b".repeat(64), ordinal: 1 },
  ]);

  assert.deepEqual(records, [
    {
      key: "a".repeat(64),
      ordinal: 0,
      status: "pending",
      attemptCount: 0,
    },
    {
      key: "b".repeat(64),
      ordinal: 1,
      status: "complete",
      fragment: { components: [] },
      attemptCount: 1,
    },
  ]);
  assert.match(calls[0].sql, /INSERT INTO app_knowledge_design_system_chunks/);
  assert.match(calls[0].sql, /ON CONFLICT \(job_id, chunk_key\) DO NOTHING/);
  assert.deepEqual(calls[0].values, [
    7,
    ["a".repeat(64), "b".repeat(64)],
    [0, 1],
  ]);
});

test("records design-system chunk success and failure only for active jobs", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ id: 1 }], 1);
  };
  const store = createAppKnowledgeStore(query);

  await store.recordDesignSystemChunkResult(9, {
    key: "c".repeat(64),
    fragment: { designLanguage: { color: [] } },
    attemptCount: 2,
  });
  await store.recordDesignSystemChunkFailure(9, {
    key: "d".repeat(64),
    errorCode: "provider_timeout",
    attemptCount: 3,
  });

  assert.match(calls[0].sql, /j.status = 'running'/);
  assert.deepEqual(calls[0].values, [
    9,
    "c".repeat(64),
    JSON.stringify({ designLanguage: { color: [] } }),
    2,
  ]);
  assert.match(calls[1].sql, /synthesis_done_count = synthesis_done_count \+ 1/);
  assert.deepEqual(calls[1].values, [9]);
  assert.match(calls[2].sql, /status = 'failed'/);
  assert.deepEqual(calls[2].values, [
    9,
    "d".repeat(64),
    "provider_timeout",
    3,
  ]);
});

test("sets a bounded synthesis plan before chunk results advance progress", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ id: 9 }], 1);
  };
  const store = createAppKnowledgeStore(query);

  await store.setSynthesisPlan(9, 3, 1);

  assert.match(calls[0].sql, /synthesis_total_count = \$2/);
  assert.match(calls[0].sql, /synthesis_done_count = \$3/);
  assert.deepEqual(calls[0].values, [9, 3, 1]);
});

test("persists one verified crop and attaches it to the generated revision", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("INSERT INTO stored_objects")) {
      return result([{ object_key: values?.[0] }]);
    }
    if (sql.includes("INSERT INTO images")) {
      return result([{ id: 88 }]);
    }
    if (sql.includes("INSERT INTO app_knowledge_component_crops")) {
      return result([{ derived_image_id: 88 }]);
    }
    return result([{ id: 9 }], 1);
  };
  const store = createAppKnowledgeStore(query);
  const region = { x: 0.1, y: 0.2, width: 0.3, height: 0.2 };

  const imageId = await store.persistComponentCrop({
    sourceImageId: 11,
    region,
    providerModel: "gemini-2.5-pro",
    promptVersion: 2,
    jobId: 9,
    platformId: 2,
    componentFamily: "Button",
    componentVariant: "Primary",
    sourceSha256: "a".repeat(64),
    object: {
      key: `app-knowledge/component-crops/${"b".repeat(64)}.png`,
      sha256: "b".repeat(64),
      byteSize: 1_024,
      contentType: "image/png",
      accessClass: "protected",
    },
  });
  await store.attachCropsToRevision(9, 12);

  assert.equal(imageId, 88);
  assert.ok(calls.some(({ sql }) => /INSERT INTO stored_objects/.test(sql)));
  assert.ok(calls.some(({ sql }) => /INSERT INTO images/.test(sql)));
  assert.ok(calls.some(({ sql }) => /INSERT INTO app_knowledge_component_crops/.test(sql)));
  const attach = calls.find(({ sql }) => /SET revision_id = \$2/.test(sql));
  assert.deepEqual(attach?.values, [9, 12]);
});

test("finds a reusable crop by exact source region and model identity", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ derived_image_id: 77 }]);
  };
  const store = createAppKnowledgeStore(query);

  const imageId = await store.findComponentCrop({
    sourceImageId: 11,
    region: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 },
    providerModel: "gemini-2.5-pro",
    promptVersion: 2,
  });

  assert.equal(imageId, 77);
  assert.match(calls[0].sql, /source_image_id = \$1/);
  assert.deepEqual(calls[0].values, [
    11,
    0.1,
    0.2,
    0.3,
    0.2,
    "gemini-2.5-pro",
    2,
  ]);
});

test("records the safe working-copy seed outcome on a completed generation job", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result([{ id: 9 }], 1);
  };
  const store = createAppKnowledgeStore(query);

  await store.recordDesignSystemSeedOutcome(9, "conflict");

  assert.match(calls[0].sql, /design_system_seed_outcome = \$2/);
  assert.match(calls[0].sql, /status = 'done'/);
  assert.deepEqual(calls[0].values, [9, "conflict"]);
});
