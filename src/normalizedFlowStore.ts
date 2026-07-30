import type pg from "pg";
import type { DesignFlow } from "./designSystem.ts";

export type FlowWriteClient = Pick<pg.PoolClient, "query">;

export interface CanonicalName {
  name: string;
  normalizedName: string;
}

export interface CanonicalFlowPath {
  root: CanonicalName;
  child?: CanonicalName;
}

interface StoredFlowRow {
  source_flow_id: string;
  title: string;
  source_category: string | null;
  description: string;
  tags: string[];
  steps: DesignFlow["steps"];
  provenance: DesignFlow["provenance"] | null;
  insights: DesignFlow["insights"] | null;
}

export function displayFlowName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizedFlowName(value: string): string {
  return displayFlowName(value).toLowerCase();
}

export function canonicalFlowPath(flow: DesignFlow): CanonicalFlowPath {
  const title = displayFlowName(flow.title);
  const titleIdentity = normalizedFlowName(title);
  const category = typeof flow.category === "string"
    ? displayFlowName(flow.category)
    : "";
  const categoryIdentity = normalizedFlowName(category);

  if (!category || categoryIdentity === titleIdentity) {
    return { root: { name: title, normalizedName: titleIdentity } };
  }
  return {
    root: { name: category, normalizedName: categoryIdentity },
    child: { name: title, normalizedName: titleIdentity },
  };
}

export function validateIncomingFlows(flows: DesignFlow[]): void {
  if (!Array.isArray(flows)) throw new Error("App flows must be an array");
  const sourceIds = new Set<string>();
  for (const flow of flows) {
    if (!flow || typeof flow !== "object") throw new Error("Flow must be an object");
    if (typeof flow.id !== "string" || !flow.id.trim()) {
      throw new Error("Flow id is required");
    }
    if (sourceIds.has(flow.id)) throw new Error("Flow source ids must be unique");
    sourceIds.add(flow.id);
    if (typeof flow.title !== "string" || !displayFlowName(flow.title)) {
      throw new Error("Flow title is required");
    }
    if (typeof flow.description !== "string") {
      throw new Error("Flow description must be a string");
    }
    if (!Array.isArray(flow.tags)) throw new Error("Flow tags must be an array");
    if (!Array.isArray(flow.steps)) throw new Error("Flow steps must be an array");
    if (flow.category !== undefined && typeof flow.category !== "string") {
      throw new Error("Flow category must be a string");
    }
  }
  try {
    JSON.stringify(flows);
  } catch {
    throw new Error("App flows must be JSON-serializable");
  }
}

function designFlow(row: StoredFlowRow): DesignFlow {
  return {
    id: row.source_flow_id,
    title: row.title,
    ...(row.source_category ? { category: row.source_category } : {}),
    description: row.description,
    tags: row.tags,
    steps: row.steps,
    ...(row.provenance ? { provenance: row.provenance } : {}),
    ...(row.insights ? { insights: row.insights } : {}),
  };
}

export async function readCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string },
): Promise<DesignFlow[]> {
  const result = await client.query<StoredFlowRow>(
    `SELECT source_flow_id, title, source_category, description,
       tags, steps, provenance, insights
     FROM app_flows
     WHERE app_id = $1 AND platform = $2
     ORDER BY position`,
    [input.appId, input.platform],
  );
  return result.rows.map(designFlow);
}

export async function readVersionFlows(
  client: FlowWriteClient,
  input: { versionId: number },
): Promise<DesignFlow[]> {
  const result = await client.query<StoredFlowRow>(
    `SELECT source_flow_id, title, source_category, description,
       tags, steps, provenance, insights
     FROM app_flow_versions
     WHERE version_id = $1
     ORDER BY position`,
    [input.versionId],
  );
  return result.rows.map(designFlow);
}

async function rootFlowId(
  client: FlowWriteClient,
  identity: CanonicalName,
): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO flows (name, normalized_name)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [identity.name, identity.normalizedName],
  );
  if (inserted.rows[0]) return Number(inserted.rows[0].id);
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM flows
     WHERE parent_id IS NULL AND normalized_name = $1`,
    [identity.normalizedName],
  );
  if (!existing.rows[0]) throw new Error("Canonical root Flow could not be resolved");
  return Number(existing.rows[0].id);
}

async function childFlowId(
  client: FlowWriteClient,
  parentId: number,
  identity: CanonicalName,
): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO flows (parent_id, name, normalized_name)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [parentId, identity.name, identity.normalizedName],
  );
  if (inserted.rows[0]) return Number(inserted.rows[0].id);
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM flows
     WHERE parent_id = $1 AND normalized_name = $2`,
    [parentId, identity.normalizedName],
  );
  if (!existing.rows[0]) throw new Error("Canonical child Flow could not be resolved");
  return Number(existing.rows[0].id);
}

async function canonicalFlowId(
  client: FlowWriteClient,
  flow: DesignFlow,
): Promise<number> {
  const path = canonicalFlowPath(flow);
  const rootId = await rootFlowId(client, path.root);
  return path.child ? childFlowId(client, rootId, path.child) : rootId;
}

async function shiftCurrentPositions(
  client: FlowWriteClient,
  input: { appId: number; platform: string; incomingCount: number },
): Promise<void> {
  const current = await client.query<{ max_position: number }>(
    `SELECT COALESCE(max(position), 0)::int AS max_position
     FROM app_flows WHERE app_id = $1 AND platform = $2`,
    [input.appId, input.platform],
  );
  const offset = Number(current.rows[0]?.max_position ?? 0) + input.incomingCount + 1;
  await client.query(
    `UPDATE app_flows SET position = position + $3
     WHERE app_id = $1 AND platform = $2`,
    [input.appId, input.platform, offset],
  );
}

async function writeCurrentRows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  for (const [index, flow] of input.flows.entries()) {
    const canonicalId = await canonicalFlowId(client, flow);
    const saved = await client.query<{ id: number }>(
      `INSERT INTO app_flows (
         app_id, platform, source_flow_id, position, title, source_category,
         description, tags, steps, provenance, insights
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb
       )
       ON CONFLICT (app_id, platform, source_flow_id) DO UPDATE SET
         position = EXCLUDED.position,
         title = EXCLUDED.title,
         source_category = EXCLUDED.source_category,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         steps = EXCLUDED.steps,
         provenance = EXCLUDED.provenance,
         insights = EXCLUDED.insights,
         updated_at = now()
       RETURNING id`,
      [
        input.appId,
        input.platform,
        flow.id,
        index + 1,
        flow.title,
        flow.category ?? null,
        flow.description,
        JSON.stringify(flow.tags),
        JSON.stringify(flow.steps),
        JSON.stringify(flow.provenance ?? null),
        JSON.stringify(flow.insights ?? null),
      ],
    );
    const appFlowId = Number(saved.rows[0].id);
    await client.query(
      "DELETE FROM app_flow_mappings WHERE app_flow_id = $1",
      [appFlowId],
    );
    await client.query(
      "INSERT INTO app_flow_mappings (app_flow_id, flow_id) VALUES ($1, $2)",
      [appFlowId, canonicalId],
    );
  }
}

async function replaceCurrentFlowsLocked(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  await shiftCurrentPositions(client, {
    appId: input.appId,
    platform: input.platform,
    incomingCount: input.flows.length,
  });
  await writeCurrentRows(client, input);
  await client.query(
    `DELETE FROM app_flows
     WHERE app_id = $1 AND platform = $2
       AND NOT (source_flow_id = ANY($3::text[]))`,
    [input.appId, input.platform, input.flows.map(({ id }) => id)],
  );
}

export async function replaceCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<void> {
  validateIncomingFlows(input.flows);
  const locked = await client.query(
    "SELECT id FROM apps WHERE id = $1 FOR UPDATE",
    [input.appId],
  );
  if (!locked.rowCount) throw new Error("Flow target app was not found");
  await replaceCurrentFlowsLocked(client, input);
}

export async function mergeCurrentFlows(
  client: FlowWriteClient,
  input: { appId: number; platform: string; flows: DesignFlow[] },
): Promise<DesignFlow[]> {
  validateIncomingFlows(input.flows);
  const locked = await client.query(
    "SELECT id FROM apps WHERE id = $1 FOR UPDATE",
    [input.appId],
  );
  if (!locked.rowCount) throw new Error("Flow target app was not found");
  const existing = await readCurrentFlows(client, input);
  const incoming = new Map(input.flows.map((flow) => [flow.id, flow]));
  const merged = existing.map((flow) => incoming.get(flow.id) ?? flow);
  const seen = new Set(existing.map(({ id }) => id));
  merged.push(...input.flows.filter(({ id }) => !seen.has(id)));
  await replaceCurrentFlowsLocked(client, { ...input, flows: merged });
  return merged;
}

export async function replaceVersionFlows(
  client: FlowWriteClient,
  input: { versionId: number; flows: DesignFlow[] },
): Promise<void> {
  validateIncomingFlows(input.flows);
  const locked = await client.query<{
    id: number;
    status: string;
    published_at: string | null;
  }>(
    "SELECT id, status, published_at FROM app_versions WHERE id = $1 FOR UPDATE",
    [input.versionId],
  );
  if (!locked.rowCount) throw new Error("Flow target version was not found");
  if (locked.rows[0]?.published_at != null || locked.rows[0]?.status === "published") {
    throw new Error("Published Flow versions are immutable; publish a new App version");
  }

  const current = await client.query<{ max_position: number }>(
    `SELECT COALESCE(max(position), 0)::int AS max_position
     FROM app_flow_versions WHERE version_id = $1`,
    [input.versionId],
  );
  const offset = Number(current.rows[0]?.max_position ?? 0) + input.flows.length + 1;
  await client.query(
    "UPDATE app_flow_versions SET position = position + $2 WHERE version_id = $1",
    [input.versionId, offset],
  );

  for (const [index, flow] of input.flows.entries()) {
    const canonicalId = await canonicalFlowId(client, flow);
    const saved = await client.query<{ id: number }>(
      `INSERT INTO app_flow_versions (
         version_id, source_flow_id, position, title, source_category,
         description, tags, steps, provenance, insights
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb
       )
       ON CONFLICT (version_id, source_flow_id) DO UPDATE SET
         position = EXCLUDED.position,
         title = EXCLUDED.title,
         source_category = EXCLUDED.source_category,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         steps = EXCLUDED.steps,
         provenance = EXCLUDED.provenance,
         insights = EXCLUDED.insights
       RETURNING id`,
      [
        input.versionId,
        flow.id,
        index + 1,
        flow.title,
        flow.category ?? null,
        flow.description,
        JSON.stringify(flow.tags),
        JSON.stringify(flow.steps),
        JSON.stringify(flow.provenance ?? null),
        JSON.stringify(flow.insights ?? null),
      ],
    );
    const versionFlowId = Number(saved.rows[0].id);
    await client.query(
      "DELETE FROM app_flow_version_mappings WHERE app_flow_version_id = $1",
      [versionFlowId],
    );
    await client.query(
      `INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
       VALUES ($1, $2)`,
      [versionFlowId, canonicalId],
    );
  }
  await client.query(
    `DELETE FROM app_flow_versions
     WHERE version_id = $1 AND NOT (source_flow_id = ANY($2::text[]))`,
    [input.versionId, input.flows.map(({ id }) => id)],
  );
}
