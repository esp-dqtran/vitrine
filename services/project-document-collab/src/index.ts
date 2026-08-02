import { resolveSession } from "../../../src/authStore.ts";
import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import { cookieValue, SESSION_COOKIE } from "../../api/src/sessionCookie.ts";
import { projectDocumentAllowedOrigins } from "./config.ts";
import { createProjectDocumentCollaborationService } from "./server.ts";
import { startProjectDocumentCollaboration } from "./start.ts";

const PORT = Number(process.env.PORT ?? 3013);
const allowedOrigins = projectDocumentAllowedOrigins(process.env);
const store = createProjectDocumentStore();
const collaboration = createProjectDocumentCollaborationService({
  allowedOrigins,
  async authenticate({ token, cookie }) {
    const sessionToken = cookieValue(cookie, SESSION_COOKIE) ?? (token || undefined);
    if (!sessionToken) return undefined;
    const user = await resolveSession(sessionToken);
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
