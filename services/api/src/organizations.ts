import type express from "express";
import type { OrganizationStore } from "../../../src/organizationStore.ts";

export interface OrganizationRouteDependencies {
  store: OrganizationStore;
  enabled: boolean;
}

function asyncRoute(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => { handler(req, res).catch(next); };
}

const positiveId = (value: unknown): number | undefined => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

const memberRoles = new Set(["admin", "member"]);

export function mountOrganizationRoutes(app: express.Express, deps: OrganizationRouteDependencies): void {
  app.use("/organizations", (_req, res, next) => {
    if (!deps.enabled) res.status(404).json({ error: "Not found" });
    else next();
  });

  app.get("/organizations", asyncRoute(async (_req, res) => {
    res.json(await deps.store.listForUser(res.locals.user.id));
  }));

  app.post("/organizations", asyncRoute(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 120) {
      res.status(400).json({ error: "invalid organization name" });
      return;
    }
    res.status(201).json(await deps.store.createOrganization(res.locals.user.id, name));
  }));

  app.get("/organizations/:id/members", asyncRoute(async (req, res) => {
    const orgId = positiveId(req.params.id);
    if (!orgId) { res.status(400).json({ error: "invalid organization id" }); return; }
    const members = await deps.store.listMembers(orgId, res.locals.user.id);
    if (!members) { res.status(404).json({ error: "organization not found" }); return; }
    res.json(members);
  }));

  app.post("/organizations/:id/members", asyncRoute(async (req, res) => {
    const orgId = positiveId(req.params.id);
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const role = req.body?.role;
    if (!orgId || !email || !memberRoles.has(role)) {
      res.status(400).json({ error: "invalid member request" });
      return;
    }
    const result = await deps.store.addMemberByEmail(orgId, res.locals.user.id, email, role);
    if (result.status === "user_not_found") { res.status(404).json({ error: "no user with that email" }); return; }
    if (result.status === "forbidden") { res.status(403).json({ error: "not permitted" }); return; }
    res.status(201).json(result.member);
  }));

  app.delete("/organizations/:id/members/:userId", asyncRoute(async (req, res) => {
    const orgId = positiveId(req.params.id);
    const targetUserId = positiveId(req.params.userId);
    if (!orgId || !targetUserId) { res.status(400).json({ error: "invalid member request" }); return; }
    const removed = await deps.store.removeMember(orgId, res.locals.user.id, targetUserId);
    if (!removed) { res.status(403).json({ error: "not permitted" }); return; }
    res.status(204).end();
  }));
}
