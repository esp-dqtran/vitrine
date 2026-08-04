import { pool } from "../../../src/db.ts";
import { createJwtAuth, jwtAuthConfigFromEnv } from "../../../src/jwtAuth.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import { projectDocumentAllowedOrigins } from "./config.ts";
import { createProjectDocumentCollaborationService } from "./server.ts";
import { startProjectDocumentCollaboration } from "./start.ts";

const PORT = Number(process.env.PORT ?? 3013);
const allowedOrigins = projectDocumentAllowedOrigins(process.env);
const auth = createJwtAuth(jwtAuthConfigFromEnv(process.env));
const store = createProjectDocumentStore();
const collaboration = createProjectDocumentCollaborationService({
  allowedOrigins,
  async authenticate({ token }) {
    const authToken = token || undefined;
    if (!authToken) return undefined;
    const user = await auth.verifyAuthToken(authToken);
    return user ? { userId: user.id, email: user.email } : undefined;
  },
  async authorize(identity, collaborationDocumentId) {
    const access = await store.accessDocument(identity.userId, collaborationDocumentId);
    return access ? { documentId: access.documentId, role: access.role } : undefined;
  },
  load: (collaborationDocumentId) => store.loadRealtimeState(collaborationDocumentId),
  store: (collaborationDocumentId, state) =>
    store.storeRealtimeState(collaborationDocumentId, state),
});

await startProjectDocumentCollaboration({
  assertMigrations: () => assertMigrationsCurrent(pool),
  start: async () => {
    await collaboration.listen(PORT);
    console.log(`[project-document-collab] listening on :${PORT}`);
  },
});
