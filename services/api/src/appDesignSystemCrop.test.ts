import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { createApiApp } from "./app.ts";

async function serve(): Promise<{ base: string; server: Server }> {
  const snapshot = {
    app: "linear",
    generatedAt: "2026-07-24T00:00:00.000Z",
    tokens: [],
    components: [{
      id: "button",
      name: "Button",
      category: "Action",
      description: "Primary action",
      variants: [{
        id: "primary",
        name: "Primary",
        description: "Filled button",
        evidence: [7],
        occurrences: [{
          imageId: 7,
          cropImageId: 88,
          coordinateSpace: "normalized" as const,
          region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        }],
      }],
    }],
    flows: [],
  };
  const app = createApiApp({
    resolveSession: async () => ({
      id: 1,
      email: "admin@example.com",
      role: "admin" as const,
    }),
    getDesignSystem: async () => snapshot,
    getAppFlows: async () => [],
    appImages: async (_app, kinds) => kinds?.includes("ui_element")
      ? [{
          id: 88,
          app: "linear",
          platform: "web",
          image_url: "capture:fedcba9876543210",
          description: "Button crop",
        }]
      : [{
          id: 7,
          app: "linear",
          platform: "web",
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Form",
        }],
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server failed");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

test("admin Design System hydrates referenced crop media without storage fields", async (t) => {
  const { base, server } = await serve();
  t.after(() => new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${base}/design-systems/linear?platform=web`, {
    headers: { cookie: "astryx_session=admin" },
  });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    components: Array<{
      variants: Array<{
        occurrences: Array<{ crop: Record<string, unknown> }>;
      }>;
    }>;
  };
  const crop = body.components[0].variants[0].occurrences[0].crop;
  assert.equal(crop.imageId, 88);
  assert.equal(crop.imageUrl, "/api/media/linear/fedcba9876543210");
  assert.equal("objectKey" in crop, false);
  assert.equal("key" in crop, false);
});
