import { resolveSession } from "../../../src/authStore.ts";
import { pool } from "../../../src/db.ts";
import { assertMigrationsCurrent } from "../../../src/migrations.ts";
import { createResearchProjectStore } from "../../../src/researchProjectStore.ts";
import { cookieValue, SESSION_COOKIE } from "../../api/src/sessionCookie.ts";
import { designerCanvasAllowedOrigins } from "./config.ts";
import { createDesignerCanvasCollaborationService } from "./server.ts";
import { startDesignerCanvasCollaboration } from "./start.ts";

const PORT = Number(process.env.PORT ?? 3012);
const allowedOrigins = designerCanvasAllowedOrigins(process.env);
const store = createResearchProjectStore();
const collaboration = createDesignerCanvasCollaborationService({
  allowedOrigins,
  async authenticate(request) {
    const token = cookieValue(request.headers.cookie, SESSION_COOKIE);
    if (!token) return undefined;
    const user = await resolveSession(token);
    return user ? { userId: user.id, name: user.email } : undefined;
  },
  async canAccessProject(identity, projectId) {
    return Boolean(await store.getProject(identity.userId, projectId));
  },
});

await startDesignerCanvasCollaboration({
  assertMigrations: () => assertMigrationsCurrent(pool),
  start: () => {
    collaboration.server.listen(PORT, () => {
      console.log(`[designer-canvas-collab] listening on :${PORT}`);
    });
  },
});
