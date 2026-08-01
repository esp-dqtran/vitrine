# BlockSuite + OctoBase Integration Implementation Plan

> **Required sub-skills:** Use `superpowers:test-driven-development` before each implementation task and `superpowers:verification-before-completion` before claiming the milestone is complete.

**Goal:** Prove that one owner-scoped Astryx Project document can use the official BlockSuite Page and Edgeless editors over one CRDT document, persist through an unchanged OctoBase service, and reload without affecting the existing Feature Document workflow.

**Architecture:** Astryx owns the Project route, metadata, authorization, and a same-origin WebSocket gateway. The browser creates one BlockSuite `Doc`, mounts Page or Edgeless against that same instance, persists its `spaceDoc` locally with Y IndexedDB, and synchronizes that `spaceDoc` through the Astryx gateway. The gateway validates the Astryx session and Project/document ownership before proxying the connection to a private OctoBase workspace. OctoBase remains an unchanged separate service.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8, Express, Node HTTP upgrade handling, PostgreSQL, BlockSuite `0.19.5`, Yjs `13.6.31`, `y-websocket` `3.0.0`, `y-indexeddb` `9.0.12`, `http-proxy` `1.18.1`, OctoBase commit `58f3bbdf97f391a535e772d32828a484376c4159`, Docker Compose.

**Execution status (2026-07-30):** Tasks 1-12 are implemented and the
owner-scoped integration proof passes. Automated verification, Page/Canvas
mounting and shared text, browser reload, OctoBase stop/start recovery,
authorization gates, and unchanged legacy Feature Documents are verified.
The individual Edgeless toolbar gesture matrix still requires a short human
pass before the feature flag is widened. See
`docs/verification/blocksuite-octobase-integration.md`.

---

## Execution rules

- Work directly on `main`, as required by this repository.
- Preserve all unrelated staged and unstaged changes.
- Do not create a branch or worktree.
- Do not commit or push unless the user explicitly authorizes it. The checkpoint labels below are suggested commit boundaries only.
- Do not edit, vendor, patch, or fork BlockSuite or OctoBase.
- Do not use `patch-package`, Cargo patches owned by Astryx, or copied upstream source.
- Stop after Task 3 if the unchanged BlockSuite/OctoBase pair fails the compatibility gate.
- Do not touch existing Feature Document tables, routes, providers, components, or data.
- The feature is disabled by default and restricted to one configured test Project.

## Pinned compatibility set

| Dependency | Exact pin | Reason |
| --- | --- | --- |
| `@blocksuite/presets` | `0.19.5` | Official Page and Edgeless editor presets |
| `@blocksuite/blocks` | `0.19.5` | `AffineSchemas` and official editor block specs |
| `@blocksuite/store` | `0.19.5` | Must match the preset dependency graph |
| `yjs` | `13.6.31` | Satisfies BlockSuite and provider peer ranges |
| `y-websocket` | `3.0.0` | Standard Yjs WebSocket client |
| `y-indexeddb` | `9.0.12` | Browser-local CRDT persistence |
| `http-proxy` | `1.18.1` | Transparent binary WebSocket proxy |
| OctoBase | `58f3bbdf97f391a535e772d32828a484376c4159` | Last verified official commit before `apps/cloud` was removed from the Cargo workspace |
| Rust builder | `1.72.1-bookworm` | Matches the 2023 OctoBase dependency set and avoids current-Rust failures in `time 0.3.22` |

OctoBase `main` at `276e0e94719a652483119c5fea16be13293ee21c` is not the candidate for this proof: `cargo metadata --manifest-path apps/cloud/Cargo.toml` fails because `apps/cloud` expects the root workspace but is no longer a workspace member. Using the older official commit is preferable to modifying upstream build files.

## Save-state semantics for the proof

The selected Yjs WebSocket protocol confirms synchronization and connectivity but does not acknowledge every durable server write. The UI states therefore mean:

- `Saving`: the local Y document changed and the quiet-period timer has not completed.
- `Saved`: the IndexedDB provider is ready, the WebSocket provider has completed its sync handshake, the socket is connected, and no local update has occurred for 500 ms.
- `Offline`: a local copy is available but the WebSocket is disconnected.
- `Save failed`: editor/provider initialization or a provider error failed.

This is an integration-proof status, not a production durability receipt. A future production design must add a server checkpoint/acknowledgement contract before claiming per-edit durable saves.

---

### Task 1: Pin dependencies and record the upstream boundary

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/projectDocumentCompatibility.ts`
- Create: `src/projectDocumentCompatibility.test.ts`
- Create: `docs/licenses/blocksuite-octobase-integration.md`

- [ ] **Step 1: Write the failing compatibility-manifest test**

Create `src/projectDocumentCompatibility.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOCKSUITE_VERSION,
  INTEGRATION_VERSION,
  OCTOBASE_COMMIT,
} from "./projectDocumentCompatibility.ts";

test("pins the approved BlockSuite and OctoBase compatibility set", () => {
  assert.equal(BLOCKSUITE_VERSION, "0.19.5");
  assert.equal(
    OCTOBASE_COMMIT,
    "58f3bbdf97f391a535e772d32828a484376c4159",
  );
  assert.equal(
    INTEGRATION_VERSION,
    "blocksuite-0.19.5_octobase-58f3bbdf97f391a535e772d32828a484376c4159",
  );
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --experimental-strip-types --test src/projectDocumentCompatibility.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `src/projectDocumentCompatibility.ts`.

- [ ] **Step 3: Install exact packages**

Run:

```bash
npm install --save-exact \
  @blocksuite/presets@0.19.5 \
  @blocksuite/blocks@0.19.5 \
  @blocksuite/store@0.19.5 \
  yjs@13.6.31 \
  y-websocket@3.0.0 \
  y-indexeddb@9.0.12 \
  http-proxy@1.18.1 \
  ws@8.21.1

npm install --save-dev --save-exact \
  @types/http-proxy@1.17.17 \
  @types/ws@8.18.1
```

Expected: `package.json` and `package-lock.json` contain exact versions without `^` or `~` for these direct dependencies.

- [ ] **Step 4: Add the compatibility constants**

Create `src/projectDocumentCompatibility.ts`:

```ts
export const BLOCKSUITE_VERSION = "0.19.5" as const;
export const OCTOBASE_COMMIT =
  "58f3bbdf97f391a535e772d32828a484376c4159" as const;
export const INTEGRATION_VERSION =
  `blocksuite-${BLOCKSUITE_VERSION}_octobase-${OCTOBASE_COMMIT}` as const;
export const PROJECT_DOCUMENT_KEY = "main" as const;
export const BLOCKSUITE_DOC_ID = "main" as const;
```

- [ ] **Step 5: Add the source and license record**

Create `docs/licenses/blocksuite-octobase-integration.md` with:

- the exact package names and versions;
- BlockSuite’s published MPL-2.0 license;
- OctoBase’s published AGPL-3.0 license;
- the exact OctoBase source URL:
  `https://github.com/toeverything/OctoBase/tree/58f3bbdf97f391a535e772d32828a484376c4159`;
- a statement that Astryx does not modify either upstream;
- a statement that this proof is not production licensing approval;
- a required legal review before any production rollout.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
node --experimental-strip-types --test src/projectDocumentCompatibility.test.ts
npm ls @blocksuite/presets @blocksuite/blocks @blocksuite/store yjs y-websocket y-indexeddb http-proxy
```

Expected: one passing test and one resolved version for each direct package, with every BlockSuite package at `0.19.5`.

**Checkpoint label:** `chore: pin blocksuite octobase compatibility set`

---

### Task 2: Run unchanged OctoBase behind a private Compose profile

**Files:**

- Create: `services/octobase/Dockerfile`
- Create: `services/octobase/init/01-create-binary-database.sql`
- Create: `services/octobase/healthcheck.mjs`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Write a failing image/source assertion**

Create `services/octobase/healthcheck.mjs`:

```js
const base = process.env.OCTOBASE_URL ?? "http://127.0.0.1:3020";
const response = await fetch(`${base}/api/healthz`);
if (!response.ok) {
  throw new Error(`OctoBase health check returned ${response.status}`);
}
console.log("OctoBase health check passed");
```

Run:

```bash
OCTOBASE_URL=http://127.0.0.1:3020 node services/octobase/healthcheck.mjs
```

Expected: connection failure because no OctoBase service exists yet.

- [ ] **Step 2: Add the immutable upstream builder**

Create `services/octobase/Dockerfile`:

```dockerfile
FROM rust:1.72.1-bookworm AS builder

ARG OCTOBASE_COMMIT=58f3bbdf97f391a535e772d32828a484376c4159
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    clang \
    cmake \
    git \
    libclang-dev \
    libssl-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/toeverything/OctoBase.git /src/octobase \
  && cd /src/octobase \
  && git checkout --detach "${OCTOBASE_COMMIT}" \
  && test "$(git rev-parse HEAD)" = "${OCTOBASE_COMMIT}"

WORKDIR /src/octobase
RUN cargo build \
  --locked \
  --release \
  --package affine-cloud \
  --no-default-features \
  --features affine

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/octobase/target/release/affine-cloud /usr/local/bin/affine-cloud
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/affine-cloud"]
```

The wrapper only selects and builds an official commit. It does not alter the checked-out source.

- [ ] **Step 3: Create OctoBase’s second database**

OctoBase derives document storage by appending `_binary` to `DATABASE_URL`. Create `services/octobase/init/01-create-binary-database.sql`:

```sql
CREATE DATABASE octobase_binary;
```

- [ ] **Step 4: Add private Compose services**

Add these services to `docker-compose.yml`:

```yaml
  octobase-postgres:
    profiles: ["project-docs"]
    image: postgres:17-bookworm
    environment:
      POSTGRES_DB: octobase
      POSTGRES_USER: octobase
      POSTGRES_PASSWORD: ${OCTOBASE_DATABASE_PASSWORD:-octobase-local-password}
    volumes:
      - octobase-postgres-data:/var/lib/postgresql/data
      - ./services/octobase/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U octobase -d octobase"]
      interval: 5s
      timeout: 5s
      retries: 20

  octobase:
    profiles: ["project-docs"]
    build:
      context: .
      dockerfile: services/octobase/Dockerfile
      args:
        OCTOBASE_COMMIT: 58f3bbdf97f391a535e772d32828a484376c4159
    environment:
      DATABASE_URL: postgres://octobase:${OCTOBASE_DATABASE_PASSWORD:-octobase-local-password}@octobase-postgres:5432/octobase
      SIGN_KEY: ${OCTOBASE_SIGN_KEY:-octobase-local-sign-key}
      JWST_DEV: "true"
      FIREBASE_PROJECT_ID: astryx-project-docs
      MAIL_ACCOUNT: ""
      MAIL_PASSWORD: ""
    ports:
      - "127.0.0.1:${OCTOBASE_HOST_PORT:-3020}:3000"
    depends_on:
      octobase-postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "http://127.0.0.1:3000/api/healthz"]
      interval: 10s
      timeout: 5s
      retries: 20
    restart: on-failure
```

Do not expose OctoBase on a public interface. The loopback port exists only for the compatibility script.

Add to `volumes`:

```yaml
  octobase-postgres-data:
```

- [ ] **Step 5: Document disabled-by-default environment values**

Add to `.env.example`:

```dotenv
PROJECT_DOCUMENTS_ENABLED=false
PROJECT_DOCUMENTS_TEST_PROJECT_ID=
VITE_PROJECT_DOCUMENTS_ENABLED=false
VITE_PROJECT_DOCUMENTS_TEST_PROJECT_ID=
OCTOBASE_URL=http://127.0.0.1:3020
OCTOBASE_SERVICE_EMAIL=astryx-integration@localhost.test
OCTOBASE_SERVICE_PASSWORD=
OCTOBASE_DATABASE_PASSWORD=
OCTOBASE_SIGN_KEY=
```

- [ ] **Step 6: Build and verify the unchanged service**

Run:

```bash
docker compose --profile project-docs build octobase
docker compose --profile project-docs up -d octobase-postgres octobase
OCTOBASE_URL=http://127.0.0.1:3020 node services/octobase/healthcheck.mjs
docker compose --profile project-docs exec -T octobase-postgres \
  psql -U octobase -d postgres -Atc \
  "SELECT datname FROM pg_database WHERE datname IN ('octobase','octobase_binary') ORDER BY datname"
```

Expected:

```text
OctoBase health check passed
octobase
octobase_binary
```

**Checkpoint label:** `build: add pinned unmodified octobase service`

---

### Task 3: Prove BlockSuite `spaceDoc` round-trips through OctoBase

**This is a hard stop gate. Do not begin Task 4 until it passes.**

**Files:**

- Create: `scripts/verify-blocksuite-octobase.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the compatibility script**

The script must:

1. authenticate with `DebugCreateUser`, falling back to `DebugLoginUser`;
2. create a fresh OctoBase workspace with `POST /api/workspace`;
3. create a BlockSuite collection with `AffineSchemas`;
4. create a deterministic BlockSuite doc named `main`;
5. connect `doc.spaceDoc`, not the collection root, with `WebsocketProvider`;
6. wait for the provider’s first `sync: true`;
7. add Page, Surface, Note, and Paragraph blocks only after the first sync;
8. set the paragraph text to `Astryx OctoBase compatibility sentinel`;
9. disconnect and destroy the first client;
10. create an entirely new BlockSuite collection and reconnect;
11. assert that the sentinel and root block are restored;
12. change the paragraph from the second client, reconnect a third client, and assert the second value;
13. exit non-zero on timeout, missing subdocument state, duplicate root, or provider error.

Use this initialization helper inside the script:

```ts
import { AffineSchemas } from "@blocksuite/blocks/schemas";
import { DocCollection, Schema, type Doc } from "@blocksuite/store";

function emptyBlockSuiteDoc(): Doc {
  const schema = new Schema().register(AffineSchemas);
  const collection = new DocCollection({ schema });
  collection.meta.initialize();
  const doc = collection.createDoc({ id: "main" });
  doc.load();
  return doc;
}

function initializeBlocks(doc: Doc, text: string): void {
  if (doc.root) throw new Error("Compatibility workspace was not empty");
  const pageId = doc.addBlock("affine:page", {});
  doc.addBlock("affine:surface", {}, pageId);
  const noteId = doc.addBlock("affine:note", {}, pageId);
  doc.addBlock(
    "affine:paragraph",
    { text: new doc.Text(text) },
    noteId,
  );
}
```

Use `WebSocket` from `ws` through the provider’s `WebSocketPolyfill` option. Use the upstream URL:

```ts
new WebsocketProvider(
  `${octobaseUrl.replace(/^http/, "ws")}/api/sync`,
  workspaceId,
  doc.spaceDoc,
  {
    params: { token },
    protocols: ["AFFiNE"],
    WebSocketPolyfill: WebSocket,
  },
);
```

- [ ] **Step 2: Add the script command**

Add to `package.json`:

```json
"verify:blocksuite-octobase": "node --env-file-if-exists=.env --import tsx scripts/verify-blocksuite-octobase.ts"
```

- [ ] **Step 3: Run the compatibility gate twice**

Run:

```bash
OCTOBASE_URL=http://127.0.0.1:3020 \
OCTOBASE_SERVICE_EMAIL=astryx-integration@localhost.test \
OCTOBASE_SERVICE_PASSWORD=local-compatibility-password \
npm run verify:blocksuite-octobase

OCTOBASE_URL=http://127.0.0.1:3020 \
OCTOBASE_SERVICE_EMAIL=astryx-integration@localhost.test \
OCTOBASE_SERVICE_PASSWORD=local-compatibility-password \
npm run verify:blocksuite-octobase
```

Expected from each run:

```text
BlockSuite 0.19.5 / OctoBase compatibility passed
```

- [ ] **Step 4: Enforce the stop condition**

If either run fails:

- retain the script and failure evidence;
- do not edit BlockSuite or OctoBase;
- do not proceed with Astryx route, metadata, or UI implementation;
- report the exact failed protocol/document invariant to the user;
- decide separately whether to test another official version pair or remove OctoBase from the architecture.

**Checkpoint label:** `test: prove blocksuite octobase round trip`

---

### Task 4: Add owner-scoped Project document metadata

**Files:**

- Create: `migrations/0043_project_documents.sql`
- Modify: `src/migrations.test.ts`
- Create: `src/projectDocument.ts`
- Create: `src/projectDocumentStore.ts`
- Create: `src/projectDocumentStore.test.ts`

- [ ] **Step 1: Add failing migration and store tests**

Test these invariants:

- migration `0043` creates `project_documents`;
- a Project may have multiple keyed documents;
- `(project_id, document_key)` is unique, not `project_id` by itself;
- `last_editor_mode` accepts only `page` or `edgeless`;
- load/update queries require document ID, Project ID, and owner user ID;
- creation selects ownership from `research_projects` instead of trusting a caller-supplied owner;
- mode updates do not revise or mutate the Research Project.

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/projectDocumentStore.test.ts
```

Expected: missing migration/store failures.

- [ ] **Step 3: Add the migration**

Create `migrations/0043_project_documents.sql`:

```sql
CREATE TABLE project_documents (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  octobase_document_id TEXT NOT NULL UNIQUE,
  last_editor_mode TEXT NOT NULL DEFAULT 'page'
    CHECK (last_editor_mode IN ('page', 'edgeless')),
  integration_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, document_key)
);

CREATE INDEX project_documents_owner_project_idx
  ON project_documents(owner_user_id, project_id);
```

Add the `0043_project_documents.sql` patterns to `src/migrations.test.ts`.

- [ ] **Step 4: Add the domain model**

Create `src/projectDocument.ts`:

```ts
export type ProjectDocumentMode = "page" | "edgeless";

export interface ProjectDocument {
  id: number;
  projectId: number;
  ownerUserId: number;
  documentKey: string;
  title: string;
  octobaseDocumentId: string;
  lastEditorMode: ProjectDocumentMode;
  integrationVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentBootstrap {
  document: Omit<ProjectDocument, "octobaseDocumentId">;
  created: boolean;
  syncBaseUrl: string;
}
```

The API type intentionally omits `octobaseDocumentId`; the browser receives only the Astryx document ID and same-origin gateway URL.

- [ ] **Step 5: Implement the store**

Expose:

```ts
export interface ProjectDocumentStore {
  findByKey(
    userId: number,
    projectId: number,
    documentKey: string,
  ): Promise<ProjectDocument | undefined>;
  createForOwnedProject(
    userId: number,
    projectId: number,
    input: {
      documentKey: string;
      title: string;
      octobaseDocumentId: string;
      integrationVersion: string;
    },
  ): Promise<ProjectDocument | undefined>;
  findOwned(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined>;
  updateMode(
    userId: number,
    projectId: number,
    documentId: number,
    mode: ProjectDocumentMode,
  ): Promise<ProjectDocument | undefined>;
}
```

Use a single `INSERT ... SELECT` from `research_projects`:

```sql
INSERT INTO project_documents (
  project_id,
  owner_user_id,
  document_key,
  title,
  octobase_document_id,
  integration_version
)
SELECT rp.id, rp.user_id, $3, $4, $5, $6
FROM research_projects rp
WHERE rp.id = $1 AND rp.user_id = $2
ON CONFLICT (project_id, document_key) DO NOTHING
RETURNING *
```

- [ ] **Step 6: Run migration/store tests**

Run:

```bash
node --experimental-strip-types --test \
  src/migrations.test.ts \
  src/projectDocumentStore.test.ts
npm run db:check
```

Expected: tests pass; `db:check` reports migration files are valid or reports only that the live database has one expected pending migration before it is applied.

**Checkpoint label:** `feat: add project document metadata`

---

### Task 5: Add the private OctoBase service client

**Files:**

- Create: `services/api/src/octobaseClient.ts`
- Create: `services/api/src/octobaseClient.test.ts`
- Modify: `services/api/src/config.ts`

- [ ] **Step 1: Write failing client tests**

Cover:

- configuration is disabled when Project documents are disabled;
- service email/password are required when enabled;
- `DebugCreateUser` is attempted once;
- an existing user falls back to `DebugLoginUser`;
- access tokens are cached only until 60 seconds before JWT expiry;
- workspace creation sends `Authorization: Bearer`, `Content-Type: application/octet-stream`, and `Content-Length: 0`;
- OctoBase response bodies and credentials never appear in public errors.

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/octobaseClient.test.ts
```

Expected: missing module failure.

- [ ] **Step 3: Implement the client port**

Use this public contract:

```ts
export interface OctoBaseClient {
  accessToken(): Promise<string>;
  createWorkspace(): Promise<string>;
}

export interface OctoBaseConfig {
  url: string;
  serviceEmail: string;
  servicePassword: string;
}
```

Authentication payloads:

```ts
const createPayload = {
  type: "DebugCreateUser",
  name: "Astryx Integration",
  avatar_url: null,
  email: config.serviceEmail,
  password: config.servicePassword,
};

const loginPayload = {
  type: "DebugLoginUser",
  email: config.serviceEmail,
  password: config.servicePassword,
};
```

Never return the token through an Astryx REST response.

- [ ] **Step 4: Run client tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/octobaseClient.test.ts
```

Expected: all OctoBase client tests pass.

**Checkpoint label:** `feat: add private octobase client`

---

### Task 6: Add bootstrap and editor-mode REST endpoints

**Files:**

- Create: `services/api/src/projectDocuments.ts`
- Create: `services/api/src/projectDocuments.test.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Write failing route tests**

Cover:

- every route returns `404` when `PROJECT_DOCUMENTS_ENABLED` is false;
- every route returns `404` outside `PROJECT_DOCUMENTS_TEST_PROJECT_ID`;
- an unauthenticated request returns `401` through the existing API boundary;
- the first owner bootstrap creates an OctoBase workspace and metadata row;
- a repeated bootstrap returns the same document and does not create another workspace;
- another user receives `404`, not document metadata;
- the response omits `octobaseDocumentId` and OctoBase tokens;
- mode patch accepts only `page` or `edgeless`;
- mode patch is owner- and Project-scoped.

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/projectDocuments.test.ts
```

Expected: missing route module failure.

- [ ] **Step 3: Mount the routes**

Use:

```text
POST  /research-projects/:projectId/document
PATCH /research-projects/:projectId/document/:documentId/mode
```

Bootstrap response:

```json
{
  "document": {
    "id": 41,
    "projectId": 7,
    "ownerUserId": 3,
    "documentKey": "main",
    "title": "Project notes",
    "lastEditorMode": "page",
    "integrationVersion": "blocksuite-0.19.5_octobase-58f3bbdf97f391a535e772d32828a484376c4159",
    "createdAt": "2026-07-30T00:00:00.000Z",
    "updatedAt": "2026-07-30T00:00:00.000Z"
  },
  "created": true,
  "syncBaseUrl": "/api/project-document-sync/7"
}
```

On a unique-key race, reload the existing row and return it. If a workspace was created but the Astryx row was not inserted, log only the orphan workspace ID and never expose credentials.

- [ ] **Step 4: Add dependencies to `ApiDeps`**

Add:

```ts
projectDocumentsEnabled: process.env.PROJECT_DOCUMENTS_ENABLED === "true",
projectDocumentsTestProjectId: Number(
  process.env.PROJECT_DOCUMENTS_TEST_PROJECT_ID,
),
projectDocumentStore: createProjectDocumentStore(),
octobaseClient: createOctoBaseClient(octobaseConfigFromEnv(process.env)),
```

Only construct the real OctoBase client when the feature is enabled and configuration is valid. Tests inject a fake client.

- [ ] **Step 5: Run focused REST tests**

Run:

```bash
node --experimental-strip-types --test \
  services/api/src/projectDocuments.test.ts \
  services/api/src/researchProjects.test.ts
```

Expected: all new and existing Project API tests pass.

**Checkpoint label:** `feat: add project document bootstrap api`

---

### Task 7: Add the authenticated same-origin WebSocket gateway

**Files:**

- Create: `services/api/src/sessionCookie.ts`
- Create: `services/api/src/sessionCookie.test.ts`
- Create: `services/api/src/projectDocumentSync.ts`
- Create: `services/api/src/projectDocumentSync.test.ts`
- Create: `services/api/src/server.ts`
- Create: `services/api/src/server.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/index.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Extract and test cookie parsing**

Move the existing cookie parsing logic and cookie name into `sessionCookie.ts`:

```ts
export const SESSION_COOKIE = "astryx_session";

export function cookieValue(
  header: string | undefined,
  name: string,
): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
```

Keep existing HTTP authentication behavior unchanged.

- [ ] **Step 2: Write failing upgrade tests**

Cover:

- non-matching paths are ignored;
- malformed Project/document IDs close the socket;
- missing, invalid, expired, or signed-in-elsewhere sessions close before proxying;
- disabled flag and non-test Project close before proxying;
- cross-user, cross-Project, and missing-document requests close before proxying;
- authorized requests rewrite only to `/api/sync/:octobaseId?token=...`;
- the browser never sees the OctoBase token;
- upstream failure closes the socket and removes listeners;
- the gateway revalidates the original Astryx session every 30 seconds;
- an expired or revoked session closes an already-open downstream socket;
- gateway shutdown disposes the proxy.

- [ ] **Step 3: Implement the gateway**

Use the public factory:

```ts
export interface ProjectDocumentSyncGateway {
  handleUpgrade(
    request: import("node:http").IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer,
  ): Promise<void>;
  close(): void;
}
```

Recognize:

```text
/project-document-sync/:projectId/:documentId
```

Authorization order:

1. parse positive IDs;
2. confirm feature flag and test Project;
3. read `astryx_session`;
4. resolve the session;
5. require `authenticated`;
6. call `store.findOwned(user.id, projectId, documentId)`;
7. obtain a short-lived OctoBase service token;
8. rewrite the upstream path;
9. call `proxy.ws`.

After proxying, retain only the original Astryx session token and downstream
socket. Re-run `resolveSessionState` every 30 seconds. Destroy the downstream
socket as soon as the result is not `authenticated`, and clear the interval on
`close` or `error`.

Create the proxy with:

```ts
createProxyServer({
  target: octobaseUrl,
  ws: true,
  changeOrigin: false,
});
```

Before proxying:

```ts
request.url =
  `/api/sync/${encodeURIComponent(document.octobaseDocumentId)}` +
  `?token=${encodeURIComponent(token)}`;
```

- [ ] **Step 4: Create one HTTP server for Express and upgrades**

`services/api/src/server.ts` should call `createServer(app)`, attach one `upgrade` listener, and expose the server plus gateway cleanup.

Replace:

```ts
createApiApp(deps).listen(PORT, callback);
```

with:

```ts
const app = createApiApp(deps);
const { server } = createApiServer(app, syncGateway);
server.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
```

- [ ] **Step 5: Enable Vite WebSocket proxying**

Change the existing `/api` proxy:

```ts
"/api": {
  target: API_TARGET,
  ws: true,
  rewrite: (path) => path.replace(/^\/api/, ""),
},
```

- [ ] **Step 6: Run gateway tests**

Run:

```bash
node --experimental-strip-types --test \
  services/api/src/sessionCookie.test.ts \
  services/api/src/projectDocumentSync.test.ts \
  services/api/src/server.test.ts \
  services/api/src/app.test.ts
```

Expected: all tests pass and existing HTTP API tests still work with `app.listen()` where they do not need upgrades.

**Checkpoint label:** `feat: add authenticated project document sync gateway`

---

### Task 8: Build the BlockSuite runtime adapter

**Files:**

- Create: `src/vitrine/projectDocumentRuntime.ts`
- Create: `src/vitrine/projectDocumentRuntime.test.ts`
- Create: `src/vitrine/projectDocumentStatus.ts`
- Create: `src/vitrine/projectDocumentStatus.test.ts`

- [ ] **Step 1: Write failing pure-state tests**

Cover:

- initial state is `Saving`;
- provider sync plus IndexedDB readiness becomes `Saved`;
- a local update becomes `Saving`;
- 500 ms of quiet while connected becomes `Saved`;
- disconnect becomes `Offline`;
- reconnect does not become `Saved` until sync completes;
- provider/initialization errors become `Save failed`;
- cleanup destroys both providers and the collection;
- existing local content can open offline;
- an empty existing document never initializes before remote sync;
- a newly created bootstrap initializes blocks exactly once after remote sync.

- [ ] **Step 2: Implement the state reducer**

Create `src/vitrine/projectDocumentStatus.ts`:

```ts
export type ProjectDocumentSaveState =
  | "Saved"
  | "Saving"
  | "Offline"
  | "Save failed";

export interface ProjectDocumentSyncState {
  indexedDbReady: boolean;
  connected: boolean;
  synced: boolean;
  dirty: boolean;
  disconnected: boolean;
  failed: boolean;
}

export function projectDocumentSaveState(
  state: ProjectDocumentSyncState,
): ProjectDocumentSaveState {
  if (state.failed) return "Save failed";
  if (state.disconnected) return "Offline";
  if (!state.indexedDbReady || !state.synced || state.dirty) return "Saving";
  if (!state.connected) return "Saving";
  return "Saved";
}
```

The initial state sets `disconnected: false`, so startup is `Saving`. A provider
`disconnected` status sets it to `true`; a successful connection resets it to
`false`.

- [ ] **Step 3: Implement the runtime**

The runtime must create:

```ts
const schema = new Schema().register(AffineSchemas);
const collection = new DocCollection({ schema });
collection.meta.initialize();
const doc = collection.createDoc({ id: BLOCKSUITE_DOC_ID });
doc.load();

const indexedDb = new IndexeddbPersistence(
  `astryx-project-document-${bootstrap.document.id}`,
  doc.spaceDoc,
);

const websocket = new WebsocketProvider(
  `${window.location.origin.replace(/^http/, "ws")}${bootstrap.syncBaseUrl}`,
  String(bootstrap.document.id),
  doc.spaceDoc,
  { protocols: ["AFFiNE"] },
);
```

Initialization rule:

```ts
function initializeBlankDocument(doc: Doc): void {
  if (doc.root) return;
  const pageId = doc.addBlock("affine:page", {});
  doc.addBlock("affine:surface", {}, pageId);
  const noteId = doc.addBlock("affine:note", {}, pageId);
  doc.addBlock("affine:paragraph", {}, noteId);
}
```

- If IndexedDB restores a root, mount it immediately and reconnect.
- If there is no local root, wait for WebSocket `sync: true`.
- After sync, initialize only when `doc.root` is still absent.
- Never replace an unreadable or mount-failing document with a new blank one.

Expose:

```ts
export interface ProjectDocumentRuntime {
  doc: Doc;
  subscribe(listener: () => void): () => void;
  snapshot(): ProjectDocumentSaveState;
  recoveryUpdate(): Uint8Array;
  dispose(): void;
}
```

Implement `recoveryUpdate()` with `Y.encodeStateAsUpdate(doc.spaceDoc)`. It is
an export-only recovery path; it must never be applied automatically over an
existing OctoBase document.

- [ ] **Step 4: Run runtime tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/projectDocumentStatus.test.ts \
  src/vitrine/projectDocumentRuntime.test.ts
```

Expected: all runtime lifecycle, initialization, and state tests pass.

**Checkpoint label:** `feat: add blocksuite project document runtime`

---

### Task 9: Add the experimental Project Docs screen

**Files:**

- Create: `src/vitrine/projectDocumentsApi.ts`
- Create: `src/vitrine/projectDocumentsApi.test.ts`
- Create: `src/vitrine/components/ProjectDocumentWorkspace.tsx`
- Create: `src/vitrine/components/ProjectDocumentWorkspace.css`
- Create: `src/vitrine/ProjectDocumentWorkspace.test.tsx`

- [ ] **Step 1: Write failing API and component tests**

Cover:

- bootstrap calls `POST /api/research-projects/:projectId/document`;
- mode update calls the owner-scoped mode endpoint;
- the screen renders `Page` and `Canvas` controls;
- `page` mounts official `PageEditor`;
- `edgeless` mounts official `EdgelessEditor`;
- switching removes only the editor element and retains the runtime/doc instance;
- save-state text is visible and accessible;
- the mount container has a non-zero height for Edgeless;
- cleanup disposes editor elements and runtime once;
- error state exposes `Retry`;
- error state can download the current local Yjs update as
  `astryx-project-document-${documentId}.yjs`;
- the screen contains no generation, synthesis, AI, template, sharing, or migration action.

- [ ] **Step 2: Implement the API adapter**

Expose:

```ts
export function bootstrapProjectDocument(
  projectId: number,
): Promise<ProjectDocumentBootstrap>;

export function updateProjectDocumentMode(
  projectId: number,
  documentId: number,
  mode: ProjectDocumentMode,
): Promise<void>;
```

- [ ] **Step 3: Mount official editor elements**

Use a single runtime stored in a `useRef`. On mode changes:

```ts
import { effects } from "@blocksuite/presets/effects";

if (!customElements.get("page-editor")) effects();

const editor =
  mode === "page"
    ? new PageEditor()
    : new EdgelessEditor();
editor.doc = runtime.doc;
host.replaceChildren(editor);
```

Cleanup for a mode change removes the editor element but does not dispose the runtime. Route unmount disposes the runtime.

If editor mounting fails, keep the runtime alive and offer `Download recovery
snapshot`. Build the file from `runtime.recoveryUpdate()` with MIME type
`application/octet-stream`; do not reset or reinitialize the document.

- [ ] **Step 4: Add focused layout**

Required CSS:

```css
.project-document-page {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.project-document-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.project-document-editor {
  min-height: 0;
  height: calc(100vh - 64px);
  overflow: hidden;
}

.project-document-editor > page-editor,
.project-document-editor > edgeless-editor {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: Run frontend tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/projectDocumentsApi.test.ts
npx tsx --test src/vitrine/ProjectDocumentWorkspace.test.tsx
```

Expected: API and component tests pass.

**Checkpoint label:** `feat: add experimental project docs workspace`

---

### Task 10: Add Project navigation, route guards, and feature flags

**Files:**

- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/researchProjectsApi.test.ts`
- Modify: `src/vitrine/routeAccess.ts`
- Modify: `src/vitrine/routeAccess.test.ts`
- Modify: `src/vitrine/routeDecision.ts`
- Modify: `src/vitrine/routeDecision.test.ts`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`
- Modify: `src/vitrine/components/ResearchProjectPage.tsx`
- Modify: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Write failing route and visibility tests**

Expected route:

```ts
{ name: "project-document", projectId: 17 }
```

Expected path:

```text
/projects/17/docs
```

Cover:

- invalid and non-positive IDs return `not-found`;
- Project Docs requires authentication;
- Research Projects disabled makes it unavailable;
- Project Docs disabled makes it unavailable;
- a different Project from the configured test Project makes it unavailable;
- the Docs entry is absent when disabled;
- the Docs entry appears only in the configured Project;
- existing `/projects/:id` and Feature Document routes are unchanged.

- [ ] **Step 2: Add the route**

Match `/projects/:id/docs` before `/projects/:id`.

Add `project-document` to authenticated route names and to the exhaustive route decision.

- [ ] **Step 3: Lazy-load the workspace**

Add:

```ts
const ProjectDocumentWorkspace = lazy(() =>
  import("./components/ProjectDocumentWorkspace").then((module) => ({
    default: module.ProjectDocumentWorkspace,
  })),
);
```

Read:

```ts
const projectDocumentsEnabled =
  import.meta.env.VITE_PROJECT_DOCUMENTS_ENABLED === "true";
const projectDocumentsTestProjectId = Number(
  import.meta.env.VITE_PROJECT_DOCUMENTS_TEST_PROJECT_ID,
);
```

Render the workspace only when:

```ts
projectDocumentsEnabled
  && route.projectId === projectDocumentsTestProjectId
```

- [ ] **Step 4: Add the Project entry**

In `ResearchProjectPage`, add an `Experimental Docs` button beside the Project heading only when the same frontend conditions pass. Navigate to:

```ts
navigate({ name: "project-document", projectId: workspace.id });
```

- [ ] **Step 5: Run route and Project tests**

Run:

```bash
node --experimental-strip-types --test \
  src/vitrine/router.test.ts \
  src/vitrine/researchProjectsApi.test.ts \
  src/vitrine/routeAccess.test.ts \
  src/vitrine/routeDecision.test.ts \
  src/vitrine/App.boundary.test.ts
npx tsx --test src/vitrine/ResearchProjects.test.tsx
```

Expected: all route, guard, and Project rendering tests pass.

**Checkpoint label:** `feat: route experimental docs inside projects`

---

### Task 11: Wire runtime configuration without changing default deployment

**Files:**

- Modify: `docker-compose.yml`
- Modify: `services/api/Dockerfile`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add API environment wiring**

Add to the `api` service:

```yaml
      PROJECT_DOCUMENTS_ENABLED: ${PROJECT_DOCUMENTS_ENABLED:-false}
      PROJECT_DOCUMENTS_TEST_PROJECT_ID: ${PROJECT_DOCUMENTS_TEST_PROJECT_ID:-}
      OCTOBASE_URL: ${OCTOBASE_URL:-http://octobase:3000}
      OCTOBASE_SERVICE_EMAIL: ${OCTOBASE_SERVICE_EMAIL:-astryx-integration@localhost.test}
      OCTOBASE_SERVICE_PASSWORD: ${OCTOBASE_SERVICE_PASSWORD:-}
```

Do not add a hard `depends_on: octobase` to the default API service, because OctoBase is profile-gated and the feature is disabled by default.

- [ ] **Step 2: Document the local proof startup**

Add a README section with this order:

```bash
docker compose --profile project-docs up -d octobase-postgres octobase
npm run db:migrate
npm run service:api
PORT=5173 \
VITRINE_API_TARGET=http://127.0.0.1:3010 \
VITE_RESEARCH_PROJECTS_ENABLED=true \
VITE_PROJECT_DOCUMENTS_ENABLED=true \
VITE_PROJECT_DOCUMENTS_TEST_PROJECT_ID=1 \
npm run dev
```

Document that the API process also needs:

```dotenv
RESEARCH_PROJECTS_ENABLED=true
PROJECT_DOCUMENTS_ENABLED=true
PROJECT_DOCUMENTS_TEST_PROJECT_ID=1
OCTOBASE_URL=http://127.0.0.1:3020
OCTOBASE_SERVICE_EMAIL=astryx-integration@localhost.test
OCTOBASE_SERVICE_PASSWORD=local-compatibility-password
```

- [ ] **Step 3: Verify disabled-by-default behavior**

Run without Project document flags:

```bash
npm run build
npm test
```

Expected: build and tests pass; no Project displays `Experimental Docs`.

**Checkpoint label:** `docs: add project docs integration runbook`

---

### Task 12: Run the complete integration acceptance matrix

**Files:**

- Create: `docs/verification/blocksuite-octobase-integration.md`
- Modify only if a test exposes a defect in Astryx-owned integration code.

- [ ] **Step 1: Run automated verification**

Run:

```bash
npm run verify:blocksuite-octobase
npm test
npm run build
git diff --check
```

Expected:

- compatibility script passes;
- all Node and TSX tests pass;
- Vite build passes;
- no whitespace errors.

- [ ] **Step 2: Verify no upstream modification**

Run:

```bash
git status --short
git diff -- package.json package-lock.json services/octobase docs/licenses
rg -n '"@blocksuite/(presets|blocks|store)": "(\\^|~)' package.json
rg -n 'patch-package|patches/' package.json package-lock.json services src
```

Expected:

- no copied BlockSuite or OctoBase source;
- no floating direct BlockSuite pins;
- no patch mechanism;
- the OctoBase Dockerfile checks out the exact official commit.

- [ ] **Step 3: Verify Page and Canvas behavior manually**

In the enabled test Project:

1. open `Experimental Docs`;
2. enter rich text in Page;
3. switch to Canvas;
4. create a note, shape, connector, freehand drawing, frame, and group;
5. move and resize the elements;
6. alter layer ordering;
7. switch back to Page and confirm shared note text remains;
8. switch to Canvas and confirm graphical state remains;
9. reload the browser and confirm all state remains;
10. reopen the Project and confirm the last-used mode remains.

- [ ] **Step 4: Verify service restart**

Run:

```bash
docker compose --profile project-docs restart octobase
```

Expected:

- UI becomes `Offline`;
- the local document remains visible;
- after OctoBase returns healthy, UI reconnects;
- a full page reload restores the Page and Canvas state.

- [ ] **Step 5: Verify authorization and failure behavior**

Check:

- a second Astryx user receives `404` for bootstrap and cannot upgrade the sync socket;
- a different Project ID cannot open the document;
- deleting/expiring the Astryx session stops new sync connections;
- an already-open sync connection closes within 30 seconds after session
  expiry or revocation;
- disabling `PROJECT_DOCUMENTS_ENABLED` hides REST and rejects upgrades;
- stopping OctoBase never replaces the document with a blank one;
- a mount error shows Retry, offers a local recovery snapshot, and preserves
  IndexedDB/OctoBase state.

- [ ] **Step 6: Verify legacy Feature Documents are untouched**

Run:

```bash
node --experimental-strip-types --test \
  src/featureDocumentStore.test.ts \
  services/api/src/featureDocuments.test.ts
git diff -- \
  migrations/0015_feature_documents.sql \
  src/featureDocument.ts \
  src/featureDocumentStore.ts \
  services/api/src/featureDocuments.ts \
  src/vitrine/components/FeatureDocumentPage.tsx
```

Expected: Feature Document tests pass and the diff is empty.

- [ ] **Step 7: Record evidence**

Create `docs/verification/blocksuite-octobase-integration.md` containing:

- exact package versions and OctoBase commit;
- compatibility script output;
- automated test/build output;
- browser and service-restart results;
- authorization test results;
- unsupported or missing Edgeless tools, if any;
- the save-state semantic limitation;
- the legal-review requirement;
- the explicit result: `pass` or `blocked`.

- [ ] **Step 8: Final scope audit**

Confirm the implementation contains none of:

- Feature Document migration;
- content generation;
- Notion/Confluence/AFFiNE import;
- custom Astryx blocks;
- attachments;
- sharing;
- revisions;
- collaboration UI;
- production rollout.

**Checkpoint label:** `test: verify blocksuite octobase integration proof`

---

## Completion criteria

The implementation is complete only if all of these are true:

1. Task 3 proves the unchanged pinned pair can round-trip BlockSuite `spaceDoc` state.
2. Only the configured Project owner can bootstrap and sync the document.
3. Page and Edgeless mount against the same in-memory `Doc`.
4. Mode switching never serializes, converts, or duplicates the document.
5. Page content and the validated Edgeless toolset survive browser reload and OctoBase restart.
6. Local state survives OctoBase downtime without blank-document overwrite.
7. BlockSuite and OctoBase are exact, unmodified upstream pins.
8. Existing Feature Documents remain unchanged and pass their tests.
9. The feature remains disabled by default and limited to one test Project.
10. Verification evidence records the save-state limitation and production legal-review boundary.
