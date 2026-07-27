import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readDeploymentFile = async (path: string): Promise<string> =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8").catch(() => "");

test("Cloudflare serves the SPA and runs the Worker first for API routes", async () => {
  const source = await readDeploymentFile("wrangler.jsonc");
  assert.notEqual(source, "", "wrangler.jsonc must exist");

  const config = JSON.parse(source) as {
    main?: string;
    assets?: {
      directory?: string;
      binding?: string;
      not_found_handling?: string;
      run_worker_first?: string[];
    };
  };

  assert.equal(config.main, "src/cloudflareFrontendWorker.ts");
  assert.deepEqual(config.assets, {
    directory: "./dist",
    binding: "ASSETS",
    not_found_handling: "single-page-application",
    run_worker_first: ["/api", "/api/*"],
  });
  assert.doesNotMatch(source, /API_ORIGIN/);
});

test("Cloudflare proxies API requests without changing the frontend API contract", async () => {
  const module = await import("./cloudflareFrontendWorker.ts").catch(() => null);
  assert.ok(module, "cloudflareFrontendWorker.ts must exist");

  let forwarded: Request | undefined;
  const worker = module.createCloudflareFrontendWorker(async (request: Request) => {
    forwarded = request;
    return new Response("proxied", { status: 202 });
  });
  const assets = {
    fetch: async () => new Response("asset"),
  };

  const response = await worker.fetch(
    new Request("https://app.example.com/api/catalog?limit=24", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor: "next" }),
    }),
    { ASSETS: assets, API_ORIGIN: "https://api.example.com" },
  );

  assert.equal(response.status, 202);
  assert.equal(forwarded?.url, "https://api.example.com/catalog?limit=24");
  assert.equal(forwarded?.method, "POST");
  assert.equal(await forwarded?.text(), JSON.stringify({ cursor: "next" }));
});

test("Cloudflare keeps non-API requests on static assets and fails closed without an API origin", async () => {
  const module = await import("./cloudflareFrontendWorker.ts").catch(() => null);
  assert.ok(module, "cloudflareFrontendWorker.ts must exist");
  const { createCloudflareFrontendWorker } = module;
  let assetUrl = "";
  const worker = createCloudflareFrontendWorker(async () => {
    throw new Error("proxy should not run");
  });
  const assets = {
    fetch: async (request: Request) => {
      assetUrl = request.url;
      return new Response("asset");
    },
  };

  const assetResponse = await worker.fetch(
    new Request("https://app.example.com/apps/mercor"),
    { ASSETS: assets, API_ORIGIN: "https://api.example.com" },
  );
  const missingOriginResponse = await worker.fetch(
    new Request("https://app.example.com/api/health"),
    { ASSETS: assets },
  );

  assert.equal(await assetResponse.text(), "asset");
  assert.equal(assetUrl, "https://app.example.com/apps/mercor");
  assert.equal(missingOriginResponse.status, 503);
  assert.deepEqual(await missingOriginResponse.json(), {
    error: "API origin is not configured",
  });
});

test("Railway deploys the API Dockerfile, migrates first, and checks real readiness", async () => {
  const source = await readDeploymentFile("railway.json");
  assert.notEqual(source, "", "railway.json must exist");

  const config = JSON.parse(source) as {
    build?: { builder?: string; dockerfilePath?: string };
    deploy?: {
      preDeployCommand?: string[];
      healthcheckPath?: string;
      healthcheckTimeout?: number;
      restartPolicyType?: string;
      restartPolicyMaxRetries?: number;
    };
  };

  assert.deepEqual(config.build, {
    builder: "DOCKERFILE",
    dockerfilePath: "services/api/Dockerfile",
  });
  assert.deepEqual(config.deploy, {
    preDeployCommand: ["node --experimental-strip-types scripts/migrate.ts"],
    healthcheckPath: "/ready",
    healthcheckTimeout: 300,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  });

  const dockerfile = await readDeploymentFile("services/api/Dockerfile");
  assert.match(dockerfile, /RUN npm ci --omit=dev/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
  assert.match(
    dockerfile,
    /CMD \["node", "--experimental-strip-types", "services\/api\/src\/index\.ts"\]/,
  );
  assert.doesNotMatch(dockerfile, /npx/);
});
