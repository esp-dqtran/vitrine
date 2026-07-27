# Hierarchical Flow Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace aggregate JSONB flow arrays with hierarchical canonical `flows`, row-level current and historical app flows, and N-N mapping tables while preserving every existing flow.

**Architecture:** Add one forward PostgreSQL migration that renames the legacy aggregate tables, creates the normalized schema, stages and validates current plus historical JSON rows, derives deterministic parent/child taxonomy nodes, and removes the legacy tables only after all invariants pass. Extend the migration contract test and disposable-database verifier so both empty installs and legacy upgrades prove the replacement is lossless.

**Tech Stack:** PostgreSQL SQL migrations, Node.js 22, TypeScript, `node:test`, `pg`

---

## Repository constraints

- Work directly on `main`.
- Do not create a branch or worktree.
- Preserve all unrelated dirty-worktree changes.
- Do not commit or push unless the user explicitly asks. Commit checkpoints are
  therefore intentionally omitted from this plan.
- Do not update crawler, API, store, or UI logic in this work.

## File map

- Create `migrations/0034_hierarchical_flow_data.sql`
  - Owns the destructive schema replacement, backfill, validation, trigger
    repair, and public-preview function repair.
- Create `src/hierarchicalFlowMigration.test.ts`
  - Owns the static migration contract and guards against accidental weakening
    of the backfill/invariants.
- Modify `src/migrations.test.ts`
  - Adds migration 0034 to the contiguous schema-contract registry.
- Modify `tests/fixtures/current-schema-upgrade.sql`
  - Supplies categorized, uncategorized, self-named, cross-app spelling, and
    historical fixtures for a real legacy-to-normalized upgrade.
- Modify `scripts/verify-migrations.ts`
  - Separates schema-changing flow tables from protected legacy tables and
    asserts the exact normalized result after an upgrade.

### Task 1: Add the failing migration contract tests

**Files:**

- Create: `src/hierarchicalFlowMigration.test.ts`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the dedicated failing contract test**

Create `src/hierarchicalFlowMigration.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../migrations/0034_hierarchical_flow_data.sql",
  import.meta.url,
);

test("0034 replaces aggregate flow arrays with hierarchical row storage", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE app_flows RENAME TO legacy_app_flows/);
  assert.match(
    migration,
    /ALTER TABLE app_flow_versions RENAME TO legacy_app_flow_versions/,
  );
  assert.match(migration, /CREATE TABLE flows \(/);
  assert.match(migration, /parent_id BIGINT REFERENCES flows\(id\)/);
  assert.match(migration, /CREATE UNIQUE INDEX flows_root_name_unique/);
  assert.match(migration, /CREATE UNIQUE INDEX flows_child_name_unique/);
  assert.match(migration, /CREATE TABLE app_flows \(/);
  assert.match(migration, /source_flow_id TEXT NOT NULL/);
  assert.match(migration, /source_category TEXT/);
  assert.match(migration, /position INTEGER NOT NULL/);
  assert.match(migration, /CREATE TABLE app_flow_mappings \(/);
  assert.match(migration, /PRIMARY KEY \(app_flow_id, flow_id\)/);
  assert.match(migration, /CREATE TABLE app_flow_versions \(/);
  assert.match(migration, /CREATE TABLE app_flow_version_mappings \(/);
});

test("0034 derives exact normalized parents and children from both snapshots", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /jsonb_array_elements\(legacy\.flows\)/);
  assert.match(migration, /WITH ORDINALITY AS item\(value, position\)/);
  assert.match(migration, /\[\[:space:\]\]\+/);
  assert.match(migration, /lower\(regexp_replace\(btrim\(/);
  assert.match(migration, /source_kind = 'current'/);
  assert.match(migration, /source_kind = 'version'/);
  assert.match(migration, /source_category IS NULL/);
  assert.match(
    migration,
    /staged\.normalized_category = staged\.normalized_title/,
  );
  assert.match(migration, /ROW_NUMBER\(\) OVER \(/);
  assert.match(migration, /ORDER BY occurrence_count DESC, name ASC/);
});

test("0034 aborts before dropping legacy data when invariants fail", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /Legacy app_flows\.flows must be JSON arrays/);
  assert.match(migration, /Legacy app_flow_versions\.flows must be JSON arrays/);
  assert.match(migration, /Current flow source IDs must be unique per app and platform/);
  assert.match(migration, /Historical flow source IDs must be unique per version/);
  assert.match(migration, /Current flow row count mismatch/);
  assert.match(migration, /Historical flow row count mismatch/);
  assert.match(migration, /Current flow mapping count mismatch/);
  assert.match(migration, /Historical flow mapping count mismatch/);
  assert.match(migration, /Flow content mismatch/);
  assert.match(migration, /Flow hierarchy contains a self-reference/);
  assert.match(migration, /DROP TABLE legacy_app_flow_versions/);
  assert.match(migration, /DROP TABLE legacy_app_flows/);
});

test("0034 repairs database-owned flow dependencies", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TRIGGER app_flow_versions_search_queue/);
  assert.match(migration, /EXECUTE FUNCTION enqueue_search_from_version_child/);
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION refresh_public_facet_previews\(target_version_id INTEGER\)/,
  );
  assert.doesNotMatch(migration, /jsonb_array_elements\(afv\.flows\)/);
  assert.match(migration, /jsonb_array_elements\(afv\.steps\)/);
  assert.match(migration, /concat_ws\(' ', afv\.title, afv\.description, afv\.tags::text\)/);
});
```

- [ ] **Step 2: Register migration 0034 in the general contract test**

Append this entry to `migrationDefinitions` in `src/migrations.test.ts`:

```ts
  {
    file: "0034_hierarchical_flow_data.sql",
    patterns: [
      /CREATE TABLE flows/,
      /CREATE TABLE app_flows/,
      /CREATE TABLE app_flow_mappings/,
      /CREATE TABLE app_flow_versions/,
      /CREATE TABLE app_flow_version_mappings/,
      /DROP TABLE legacy_app_flow_versions/,
      /DROP TABLE legacy_app_flows/,
    ],
  },
```

- [ ] **Step 3: Run the focused tests and confirm the expected failure**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/hierarchicalFlowMigration.test.ts src/migrations.test.ts
```

Expected: FAIL because `migrations/0034_hierarchical_flow_data.sql` does not
exist.

### Task 2: Implement the destructive normalized migration

**Files:**

- Create: `migrations/0034_hierarchical_flow_data.sql`

- [ ] **Step 1: Add source validation and rename the legacy tables**

Start the migration with the following SQL. Do not add `BEGIN` or `COMMIT`;
`applyMigrations()` already wraps every migration in a transaction.

```sql
LOCK TABLE app_flows, app_flow_versions IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM app_flows WHERE jsonb_typeof(flows) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Legacy app_flows.flows must be JSON arrays';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_flow_versions
    WHERE jsonb_typeof(flows) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Legacy app_flow_versions.flows must be JSON arrays';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS app_flow_versions_search_queue ON app_flow_versions;
ALTER TABLE app_flows RENAME CONSTRAINT app_flows_pkey
  TO legacy_app_flows_pkey;
ALTER TABLE app_flow_versions RENAME CONSTRAINT app_flow_versions_pkey
  TO legacy_app_flow_versions_pkey;
ALTER TABLE app_flows RENAME TO legacy_app_flows;
ALTER TABLE app_flow_versions RENAME TO legacy_app_flow_versions;
```

- [ ] **Step 2: Create the final row-level schema**

Add:

```sql
CREATE TABLE flows (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES flows(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  normalized_name TEXT NOT NULL CHECK (btrim(normalized_name) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX flows_root_name_unique
  ON flows (normalized_name)
  WHERE parent_id IS NULL;
CREATE UNIQUE INDEX flows_child_name_unique
  ON flows (parent_id, normalized_name)
  WHERE parent_id IS NOT NULL;
CREATE INDEX flows_parent_idx ON flows (parent_id, name);

CREATE TABLE app_flows (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_flow_id TEXT NOT NULL CHECK (btrim(source_flow_id) <> ''),
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  source_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL CHECK (jsonb_typeof(tags) = 'array'),
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  provenance JSONB,
  insights JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, platform, source_flow_id),
  UNIQUE (app_id, platform, position)
);

CREATE INDEX app_flows_scope_position_idx
  ON app_flows (app_id, platform, position);

CREATE TABLE app_flow_mappings (
  app_flow_id BIGINT NOT NULL REFERENCES app_flows(id) ON DELETE CASCADE,
  flow_id BIGINT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  PRIMARY KEY (app_flow_id, flow_id)
);
CREATE INDEX app_flow_mappings_flow_idx
  ON app_flow_mappings (flow_id, app_flow_id);

CREATE TABLE app_flow_versions (
  id BIGSERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  source_flow_id TEXT NOT NULL CHECK (btrim(source_flow_id) <> ''),
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  source_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL CHECK (jsonb_typeof(tags) = 'array'),
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  provenance JSONB,
  insights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, source_flow_id),
  UNIQUE (version_id, position)
);

CREATE INDEX app_flow_versions_version_position_idx
  ON app_flow_versions (version_id, position);

CREATE TABLE app_flow_version_mappings (
  app_flow_version_id BIGINT NOT NULL
    REFERENCES app_flow_versions(id) ON DELETE CASCADE,
  flow_id BIGINT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  PRIMARY KEY (app_flow_version_id, flow_id)
);
CREATE INDEX app_flow_version_mappings_flow_idx
  ON app_flow_version_mappings (flow_id, app_flow_version_id);
```

- [ ] **Step 3: Stage current and historical JSON rows**

Add one temporary staging table and populate it from both legacy sources:

```sql
CREATE TEMP TABLE flow_migration_rows (
  source_kind TEXT NOT NULL CHECK (source_kind IN ('current', 'version')),
  app_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  version_id INTEGER,
  source_flow_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  source_category TEXT,
  normalized_title TEXT NOT NULL,
  normalized_category TEXT,
  description TEXT NOT NULL,
  tags JSONB NOT NULL,
  steps JSONB NOT NULL,
  provenance JSONB,
  insights JSONB,
  source_timestamp TIMESTAMPTZ NOT NULL
) ON COMMIT DROP;

INSERT INTO flow_migration_rows (
  source_kind, app_id, platform, version_id, source_flow_id, position,
  title, source_category, normalized_title, normalized_category,
  description, tags, steps, provenance, insights, source_timestamp
)
SELECT
  'current', legacy.app_id, legacy.platform, NULL,
  item.value->>'id', item.position::integer,
  item.value->>'title',
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE item.value->>'category'
  END,
  lower(regexp_replace(btrim(item.value->>'title'), '[[:space:]]+', ' ', 'g')),
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE lower(regexp_replace(
      btrim(item.value->>'category'), '[[:space:]]+', ' ', 'g'
    ))
  END,
  item.value->>'description',
  item.value->'tags',
  item.value->'steps',
  item.value->'provenance',
  item.value->'insights',
  legacy.updated_at
FROM legacy_app_flows legacy
CROSS JOIN LATERAL jsonb_array_elements(legacy.flows)
  WITH ORDINALITY AS item(value, position);

INSERT INTO flow_migration_rows (
  source_kind, app_id, platform, version_id, source_flow_id, position,
  title, source_category, normalized_title, normalized_category,
  description, tags, steps, provenance, insights, source_timestamp
)
SELECT
  'version', version.app_id, version.platform, legacy.version_id,
  item.value->>'id', item.position::integer,
  item.value->>'title',
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE item.value->>'category'
  END,
  lower(regexp_replace(btrim(item.value->>'title'), '[[:space:]]+', ' ', 'g')),
  CASE
    WHEN NULLIF(btrim(item.value->>'category'), '') IS NULL THEN NULL
    ELSE lower(regexp_replace(
      btrim(item.value->>'category'), '[[:space:]]+', ' ', 'g'
    ))
  END,
  item.value->>'description',
  item.value->'tags',
  item.value->'steps',
  item.value->'provenance',
  item.value->'insights',
  legacy.created_at
FROM legacy_app_flow_versions legacy
JOIN app_versions version ON version.id = legacy.version_id
CROSS JOIN LATERAL jsonb_array_elements(legacy.flows)
  WITH ORDINALITY AS item(value, position);
```

- [ ] **Step 4: Validate required fields and source identities**

Add explicit validation before inserting final rows:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE NULLIF(btrim(source_flow_id), '') IS NULL
       OR NULLIF(btrim(title), '') IS NULL
       OR description IS NULL
       OR jsonb_typeof(tags) IS DISTINCT FROM 'array'
       OR jsonb_typeof(steps) IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Flow rows require id, title, description, tag array, and step array';
  END IF;

  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE source_kind = 'current'
    GROUP BY app_id, platform, source_flow_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Current flow source IDs must be unique per app and platform';
  END IF;

  IF EXISTS (
    SELECT 1 FROM flow_migration_rows
    WHERE source_kind = 'version'
    GROUP BY version_id, source_flow_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Historical flow source IDs must be unique per version';
  END IF;
END;
$$;
```

- [ ] **Step 5: Insert deterministic root and child taxonomy rows**

Use frequency first and lexical order as the deterministic spelling rule:

```sql
WITH root_candidates AS (
  SELECT
    CASE
      WHEN normalized_category IS NOT NULL
       AND normalized_category <> normalized_title
        THEN regexp_replace(
          btrim(source_category), '[[:space:]]+', ' ', 'g'
        )
      ELSE regexp_replace(btrim(title), '[[:space:]]+', ' ', 'g')
    END AS name,
    CASE
      WHEN normalized_category IS NOT NULL
       AND normalized_category <> normalized_title
        THEN normalized_category
      ELSE normalized_title
    END AS normalized_name
  FROM flow_migration_rows
),
spellings AS (
  SELECT normalized_name, name, count(*) AS occurrence_count
  FROM root_candidates
  GROUP BY normalized_name, name
),
ranked AS (
  SELECT normalized_name, name,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY occurrence_count DESC, name ASC
    ) AS spelling_rank
  FROM spellings
)
INSERT INTO flows (parent_id, name, normalized_name)
SELECT NULL, name, normalized_name
FROM ranked
WHERE spelling_rank = 1;

WITH child_candidates AS (
  SELECT
    normalized_category AS parent_normalized_name,
    normalized_title,
    regexp_replace(btrim(title), '[[:space:]]+', ' ', 'g') AS name
  FROM flow_migration_rows
  WHERE normalized_category IS NOT NULL
    AND normalized_category <> normalized_title
),
spellings AS (
  SELECT parent_normalized_name, normalized_title, name,
    count(*) AS occurrence_count
  FROM child_candidates
  GROUP BY parent_normalized_name, normalized_title, name
),
ranked AS (
  SELECT parent_normalized_name, normalized_title, name,
    ROW_NUMBER() OVER (
      PARTITION BY parent_normalized_name, normalized_title
      ORDER BY occurrence_count DESC, name ASC
    ) AS spelling_rank
  FROM spellings
)
INSERT INTO flows (parent_id, name, normalized_name)
SELECT parent.id, ranked.name, ranked.normalized_title
FROM ranked
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = ranked.parent_normalized_name
WHERE ranked.spelling_rank = 1;
```

- [ ] **Step 6: Insert current rows and N-N mappings**

```sql
INSERT INTO app_flows (
  app_id, platform, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, updated_at
)
SELECT
  app_id, platform, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, source_timestamp
FROM flow_migration_rows
WHERE source_kind = 'current';

INSERT INTO app_flow_mappings (app_flow_id, flow_id)
SELECT app_flow.id, child.id
FROM flow_migration_rows staged
JOIN app_flows app_flow
  ON app_flow.app_id = staged.app_id
 AND app_flow.platform = staged.platform
 AND app_flow.source_flow_id = staged.source_flow_id
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = staged.normalized_category
JOIN flows child
  ON child.parent_id = parent.id
 AND child.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'current'
  AND staged.normalized_category IS NOT NULL
  AND staged.normalized_category <> staged.normalized_title;

INSERT INTO app_flow_mappings (app_flow_id, flow_id)
SELECT app_flow.id, root.id
FROM flow_migration_rows staged
JOIN app_flows app_flow
  ON app_flow.app_id = staged.app_id
 AND app_flow.platform = staged.platform
 AND app_flow.source_flow_id = staged.source_flow_id
JOIN flows root
  ON root.parent_id IS NULL
 AND root.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'current'
  AND (
    staged.normalized_category IS NULL
    OR staged.normalized_category = staged.normalized_title
  );
```

- [ ] **Step 7: Insert historical rows and N-N mappings**

```sql
INSERT INTO app_flow_versions (
  version_id, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, created_at
)
SELECT
  version_id, source_flow_id, position, title, source_category,
  description, tags, steps, provenance, insights, source_timestamp
FROM flow_migration_rows
WHERE source_kind = 'version';

INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
SELECT app_flow_version.id, child.id
FROM flow_migration_rows staged
JOIN app_flow_versions app_flow_version
  ON app_flow_version.version_id = staged.version_id
 AND app_flow_version.source_flow_id = staged.source_flow_id
JOIN flows parent
  ON parent.parent_id IS NULL
 AND parent.normalized_name = staged.normalized_category
JOIN flows child
  ON child.parent_id = parent.id
 AND child.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'version'
  AND staged.normalized_category IS NOT NULL
  AND staged.normalized_category <> staged.normalized_title;

INSERT INTO app_flow_version_mappings (app_flow_version_id, flow_id)
SELECT app_flow_version.id, root.id
FROM flow_migration_rows staged
JOIN app_flow_versions app_flow_version
  ON app_flow_version.version_id = staged.version_id
 AND app_flow_version.source_flow_id = staged.source_flow_id
JOIN flows root
  ON root.parent_id IS NULL
 AND root.normalized_name = staged.normalized_title
WHERE staged.source_kind = 'version'
  AND (
    staged.normalized_category IS NULL
    OR staged.normalized_category = staged.normalized_title
  );
```

- [ ] **Step 8: Add losslessness and hierarchy invariants**

Add a `DO` block that raises the exact contract-test messages:

```sql
DO $$
BEGIN
  IF (SELECT count(*) FROM app_flows) <>
     (SELECT count(*) FROM flow_migration_rows WHERE source_kind = 'current')
  THEN
    RAISE EXCEPTION 'Current flow row count mismatch';
  END IF;

  IF (SELECT count(*) FROM app_flow_versions) <>
     (SELECT count(*) FROM flow_migration_rows WHERE source_kind = 'version')
  THEN
    RAISE EXCEPTION 'Historical flow row count mismatch';
  END IF;

  IF EXISTS (
    SELECT app_flow_id
    FROM app_flow_mappings
    GROUP BY app_flow_id
    HAVING count(*) <> 1
  ) OR (SELECT count(*) FROM app_flow_mappings) <>
       (SELECT count(*) FROM app_flows)
  THEN
    RAISE EXCEPTION 'Current flow mapping count mismatch';
  END IF;

  IF EXISTS (
    SELECT app_flow_version_id
    FROM app_flow_version_mappings
    GROUP BY app_flow_version_id
    HAVING count(*) <> 1
  ) OR (SELECT count(*) FROM app_flow_version_mappings) <>
       (SELECT count(*) FROM app_flow_versions)
  THEN
    RAISE EXCEPTION 'Historical flow mapping count mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM flows WHERE parent_id = id) THEN
    RAISE EXCEPTION 'Flow hierarchy contains a self-reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM flow_migration_rows staged
    JOIN app_flows migrated
      ON migrated.app_id = staged.app_id
     AND migrated.platform = staged.platform
     AND migrated.source_flow_id = staged.source_flow_id
    WHERE staged.source_kind = 'current'
      AND (
        migrated.position IS DISTINCT FROM staged.position
        OR migrated.title IS DISTINCT FROM staged.title
        OR migrated.source_category IS DISTINCT FROM staged.source_category
        OR migrated.description IS DISTINCT FROM staged.description
        OR migrated.tags IS DISTINCT FROM staged.tags
        OR migrated.steps IS DISTINCT FROM staged.steps
        OR migrated.provenance IS DISTINCT FROM staged.provenance
        OR migrated.insights IS DISTINCT FROM staged.insights
      )
  ) OR EXISTS (
    SELECT 1
    FROM flow_migration_rows staged
    JOIN app_flow_versions migrated
      ON migrated.version_id = staged.version_id
     AND migrated.source_flow_id = staged.source_flow_id
    WHERE staged.source_kind = 'version'
      AND (
        migrated.position IS DISTINCT FROM staged.position
        OR migrated.title IS DISTINCT FROM staged.title
        OR migrated.source_category IS DISTINCT FROM staged.source_category
        OR migrated.description IS DISTINCT FROM staged.description
        OR migrated.tags IS DISTINCT FROM staged.tags
        OR migrated.steps IS DISTINCT FROM staged.steps
        OR migrated.provenance IS DISTINCT FROM staged.provenance
        OR migrated.insights IS DISTINCT FROM staged.insights
      )
  ) THEN
    RAISE EXCEPTION 'Flow content mismatch';
  END IF;
END;
$$;
```

- [ ] **Step 9: Repair the search trigger and public facet preview function**

Recreate the trigger on the new historical row table:

```sql
CREATE TRIGGER app_flow_versions_search_queue
AFTER INSERT OR UPDATE OR DELETE ON app_flow_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_search_from_version_child();
```

Copy `refresh_public_facet_previews(target_version_id INTEGER)` from
`migrations/0026_public_facet_previews.sql` into migration 0034. Keep its screen
and element branches unchanged. Replace only its flow `candidates` CTE with:

```sql
  WITH facets(facet_value) AS (
    VALUES ('Setting Up'), ('Searching & Finding'), ('Filtering & Sorting'),
      ('Resetting Password'), ('Reporting')
  ),
  candidates AS (
    SELECT target_version_id AS version_id, facets.facet_value,
      image.id AS image_id, afv.position AS flow_ordinal,
      step.position AS step_ordinal, evidence.position AS evidence_ordinal
    FROM app_flow_versions afv
    CROSS JOIN facets
    CROSS JOIN LATERAL jsonb_array_elements(afv.steps)
      WITH ORDINALITY AS step(value, position)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(step.value->'evidence', '[]'::jsonb)
    ) WITH ORDINALITY AS evidence(value, position)
    JOIN version_images version_image
      ON version_image.version_id = afv.version_id
     AND evidence.value ~ '^[1-9][0-9]*$'
     AND version_image.image_id = evidence.value::integer
    JOIN images image
      ON image.id = version_image.image_id
     AND image.kind IN ('screen', 'flow_step')
    WHERE afv.version_id = target_version_id
      AND lower(concat_ws(
        ' ', afv.title, afv.description, afv.tags::text
      )) LIKE '%' || lower(facets.facet_value) || '%'
      AND EXISTS (
        SELECT 1
        FROM stored_objects object
        WHERE object.object_key = COALESCE(
          image.thumbnail_object_key, image.object_key
        )
          AND object.access_class IN ('protected', 'public-preview')
      )
  ),
  deduplicated AS (
    SELECT DISTINCT ON (facet_value, image_id)
      version_id, facet_value, image_id, flow_ordinal, step_ordinal,
      evidence_ordinal
    FROM candidates
    ORDER BY facet_value, image_id, flow_ordinal, step_ordinal,
      evidence_ordinal
  ),
  ranked AS (
    SELECT version_id, facet_value, image_id,
      ROW_NUMBER() OVER (
        PARTITION BY facet_value
        ORDER BY flow_ordinal, step_ordinal, evidence_ordinal, image_id
      ) AS rank
    FROM deduplicated
  )
  INSERT INTO public_facet_previews (
    version_id, facet_group, facet_value, rank, image_id
  )
  SELECT version_id, 'flows', facet_value, rank::integer, image_id
  FROM ranked
  WHERE rank <= 3;
```

- [ ] **Step 10: Drop legacy storage only after validation**

Finish the migration with:

```sql
DROP TABLE legacy_app_flow_versions;
DROP TABLE legacy_app_flows;
```

- [ ] **Step 11: Run the focused contract tests**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/hierarchicalFlowMigration.test.ts src/migrations.test.ts
```

Expected: PASS.

### Task 3: Add real upgrade fixtures and normalized-data assertions

**Files:**

- Modify: `tests/fixtures/current-schema-upgrade.sql`
- Modify: `scripts/verify-migrations.ts`

- [ ] **Step 1: Expand the current-flow upgrade fixture**

Replace the existing `app_flows` fixture array with:

```sql
INSERT INTO app_flows (app_id, flows, updated_at)
VALUES
  (101, '[
    {
      "id":"settings-password",
      "title":"Changing password",
      "category":"Settings",
      "description":"Change the account password",
      "tags":["account"],
      "steps":[{"label":"Save","evidence":[301]}]
    },
    {
      "id":"search",
      "title":"  Searching   products ",
      "description":"Search without a category",
      "tags":["search"],
      "steps":[]
    },
    {
      "id":"self-settings",
      "title":"Settings",
      "category":" settings ",
      "description":"Self-named root",
      "tags":[],
      "steps":[]
    }
  ]', '2025-01-09T00:00:00Z');
```

- [ ] **Step 2: Expand both historical snapshots with complete immutable flows**

Replace the existing `app_flow_versions` fixture with:

```sql
INSERT INTO app_flow_versions (version_id, flows, created_at)
VALUES
  (501, '[
    {
      "id":"settings-password",
      "title":"Changing password",
      "category":"settings",
      "description":"Published password flow",
      "tags":["account"],
      "steps":[{"label":"Save","evidence":[301]}]
    }
  ]', '2025-01-03T00:00:00Z'),
  (502, '[
    {
      "id":"settings-password",
      "title":"Changing password",
      "category":"Settings",
      "description":"Draft password flow",
      "tags":["account","draft"],
      "steps":[{"label":"Save","evidence":[302]}],
      "provenance":{"source":"fixture"},
      "insights":{"purpose":"fixture"}
    },
    {
      "id":"search",
      "title":"Searching products",
      "description":"Draft search flow",
      "tags":["search"],
      "steps":[]
    }
  ]', '2025-01-04T00:00:00Z');
```

- [ ] **Step 3: Separate schema-changing flow tables from protected tables**

In `scripts/verify-migrations.ts`:

1. Remove `app_flows` and `app_flow_versions` from `TABLE_ORDER`.
2. Remove `app_flows: ["platform"]` from `ADDED_COLUMNS`.
3. Add:

```ts
const FLOW_TABLES = [
  "app_flow_mappings",
  "app_flow_version_mappings",
  "app_flow_versions",
  "app_flows",
  "flows",
] as const;
```

4. Include `...FLOW_TABLES` in `expectedTables` inside
   `verifyEmptyDatabase()`.
5. Complete the legacy-hash exclusions for columns populated by later
   migrations:

```ts
  app_versions: ["platform", "screen_count", "ui_element_count"],
  design_systems: [
    "origin",
    "platform",
    "capture_version_id",
    "source_app_knowledge_revision_id",
    "generated_at",
  ],
```

- [ ] **Step 4: Assert the exact upgraded hierarchy and content**

Add this function above `verifyUpgradeDatabase()`:

```ts
async function assertHierarchicalFlowUpgrade(pool: pg.Pool): Promise<void> {
  const counts = await pool.query<{
    roots: number;
    children: number;
    current_rows: number;
    current_mappings: number;
    version_rows: number;
    version_mappings: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM flows WHERE parent_id IS NULL) AS roots,
    (SELECT count(*)::integer FROM flows WHERE parent_id IS NOT NULL) AS children,
    (SELECT count(*)::integer FROM app_flows) AS current_rows,
    (SELECT count(*)::integer FROM app_flow_mappings) AS current_mappings,
    (SELECT count(*)::integer FROM app_flow_versions) AS version_rows,
    (SELECT count(*)::integer FROM app_flow_version_mappings) AS version_mappings`);

  assert.deepEqual(counts.rows[0], {
    roots: 2,
    children: 1,
    current_rows: 3,
    current_mappings: 3,
    version_rows: 3,
    version_mappings: 3,
  });

  const hierarchy = await pool.query<{
    parent: string | null;
    name: string;
    normalized_name: string;
  }>(`SELECT parent.name AS parent, child.name, child.normalized_name
     FROM flows child
     LEFT JOIN flows parent ON parent.id = child.parent_id
     ORDER BY parent.name NULLS FIRST, child.name`);

  assert.deepEqual(hierarchy.rows, [
    { parent: null, name: "Searching products", normalized_name: "searching products" },
    { parent: null, name: "Settings", normalized_name: "settings" },
    { parent: "Settings", name: "Changing password", normalized_name: "changing password" },
  ]);

  const preserved = await pool.query<{
    source_flow_id: string;
    position: number;
    source_category: string | null;
    steps: unknown;
  }>(`SELECT source_flow_id, position, source_category, steps
     FROM app_flows
     WHERE app_id = 101 AND platform = 'web'
     ORDER BY position`);

  assert.equal(preserved.rows[0].source_flow_id, "settings-password");
  assert.equal(preserved.rows[0].source_category, "Settings");
  assert.deepEqual(preserved.rows[0].steps, [{
    label: "Save",
    evidence: [301],
  }]);
  assert.equal(preserved.rows[1].source_flow_id, "search");
  assert.equal(preserved.rows[1].position, 2);
  assert.equal(preserved.rows[2].source_flow_id, "self-settings");

  const aggregateColumns = await pool.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('app_flows', 'app_flow_versions')
       AND column_name = 'flows'`,
  );
  assert.equal(aggregateColumns.rows[0].count, 0);

  const appCategories = await pool.query<{ count: number }>(
    `SELECT count(*)::integer AS count
     FROM app_categories
     WHERE app_id = 101`,
  );
  assert.equal(appCategories.rows[0].count, 1);

  const sequences = await pool.query<{
    flows_valid: boolean;
    app_flows_valid: boolean;
    app_flow_versions_valid: boolean;
  }>(`SELECT
    (SELECT last_value >= COALESCE((SELECT max(id) FROM flows), 0)
       FROM flows_id_seq) AS flows_valid,
    (SELECT last_value >= COALESCE((SELECT max(id) FROM app_flows), 0)
       FROM app_flows_id_seq) AS app_flows_valid,
    (SELECT last_value >= COALESCE((SELECT max(id) FROM app_flow_versions), 0)
       FROM app_flow_versions_id_seq) AS app_flow_versions_valid`);
  assert.deepEqual(sequences.rows[0], {
    flows_valid: true,
    app_flows_valid: true,
    app_flow_versions_valid: true,
  });
}
```

Call it in `verifyUpgradeDatabase()` immediately after
`assert.deepEqual(after.hashes, before.hashes, ...)`:

```ts
    await assertHierarchicalFlowUpgrade(pool);
```

- [ ] **Step 5: Run the TypeScript verifier tests**

Run:

```bash
node --experimental-strip-types --test --test-concurrency=1 \
  src/hierarchicalFlowMigration.test.ts src/migrations.test.ts
```

Expected: PASS.

### Task 4: Verify empty installs and legacy upgrades against disposable PostgreSQL

**Files:**

- Verify only; no additional files expected.

- [ ] **Step 1: Run static migration validation**

Run:

```bash
node --env-file=.env --experimental-strip-types scripts/check-migrations.ts
```

Expected: if the configured database is already at migration 0034,
`{"status":"ok","current":true}`. If it is still at migration 0033, the command
must report exactly one pending migration; this is expected before Task 5.

- [ ] **Step 2: Run disposable empty-install and upgrade verification**

Run with an operator URL that is explicitly safe for temporary databases:

```bash
MIGRATION_TEST_DATABASE_URL="$MIGRATION_TEST_DATABASE_URL" \
MIGRATION_TEST_ALLOW_DROP=1 \
npm run db:verify
```

Expected:

- `migrationHead` is `34` for both `empty` and `upgrade`.
- `rerunApplied` is `0` for both.
- The verifier creates and removes only database names matching
  `astryx_migration_test_<32 lowercase hex characters>`.

- [ ] **Step 3: Run the complete test suite**

Run:

```bash
npm test
```

Expected: PASS with no failures.

- [ ] **Step 4: Check formatting and unintended edits**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Only the five migration/spec/plan files named
in this plan should be newly changed by this work; all pre-existing unrelated
dirty files remain untouched.

### Task 5: Back up, apply, and verify the migration on the configured database

**Files:**

- No source changes.

- [ ] **Step 1: Capture the pre-migration flow counts**

Run:

```bash
node --env-file=.env --input-type=module -e '
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::integer
       FROM app_flows af
       CROSS JOIN LATERAL jsonb_array_elements(af.flows)) AS current_flows,
      (SELECT count(*)::integer
       FROM app_flow_versions afv
       CROSS JOIN LATERAL jsonb_array_elements(afv.flows)) AS historical_flows
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await pool.end();
}
'
```

Expected from the latest read-only inspection:

```json
{"current_flows":105378,"historical_flows":105013}
```

If the counts have changed, record the new values and use them for the
post-migration comparison.

- [ ] **Step 2: Create a recoverable backup**

Run:

```bash
FLOW_MIGRATION_BACKUP_DIR="$(mktemp -d)"
BACKUP_DIR="$FLOW_MIGRATION_BACKUP_DIR" \
BACKUP_BASENAME="before-hierarchical-flow-migration" \
node --env-file=.env --experimental-strip-types scripts/db-backup.ts
```

Expected: JSON with `"status":"ok"` and the backup artifact paths. Retain the
printed directory until post-migration verification succeeds.

- [ ] **Step 3: Apply migration 0034**

Run:

```bash
node --env-file=.env --experimental-strip-types scripts/migrate.ts
```

Expected:

```json
{"status":"ok","appliedVersions":[34]}
```

- [ ] **Step 4: Verify normalized counts and mapping invariants**

Run:

```bash
node --env-file=.env --input-type=module -e '
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::integer FROM app_flows) AS current_flows,
      (SELECT count(*)::integer FROM app_flow_mappings) AS current_mappings,
      (SELECT count(*)::integer FROM app_flow_versions) AS historical_flows,
      (SELECT count(*)::integer FROM app_flow_version_mappings)
        AS historical_mappings,
      (SELECT count(*)::integer FROM flows WHERE parent_id IS NULL)
        AS root_flows,
      (SELECT count(*)::integer FROM flows WHERE parent_id IS NOT NULL)
        AS child_flows,
      (SELECT count(*)::integer FROM flows WHERE parent_id = id)
        AS self_references,
      (
        SELECT count(*)::integer
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('app_flows', 'app_flow_versions')
          AND column_name = 'flows'
      ) AS aggregate_columns
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await pool.end();
}
'
```

Expected:

- `current_flows` equals the pre-migration current count.
- `current_mappings` equals `current_flows`.
- `historical_flows` equals the pre-migration historical count.
- `historical_mappings` equals `historical_flows`.
- `self_references` is `0`.
- `aggregate_columns` is `0`.

- [ ] **Step 5: Confirm migration state**

Run:

```bash
node --env-file=.env --experimental-strip-types scripts/check-migrations.ts
```

Expected:

```json
{"status":"ok","current":true}
```

Do not remove the backup in this task. Report its path to the user so they can
decide when it is safe to delete.
