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

test("Cloudflare deploys preserve dashboard-managed production bindings", async () => {
  const source = await readDeploymentFile("package.json");
  const scripts = (JSON.parse(source) as { scripts?: Record<string, string> }).scripts;
  assert.match(scripts?.["deploy:cloudflare"] ?? "", /wrangler deploy --keep-vars/);
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
      headers: {
        authorization: "Bearer signed.jwt.token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ cursor: "next" }),
    }),
    { ASSETS: assets, API_ORIGIN: "https://api.example.com" },
  );

  assert.equal(response.status, 202);
  assert.equal(forwarded?.url, "https://api.example.com/catalog?limit=24");
  assert.equal(forwarded?.method, "POST");
  assert.equal(forwarded?.headers.get("authorization"), "Bearer signed.jwt.token");
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

test("Cloudflare gives immutable and landing assets explicit browser caching", async () => {
  const headers = await readDeploymentFile("public/_headers");
  assert.match(
    headers,
    /\/assets\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/,
  );
  assert.match(
    headers,
    /\/landing\/\*[\s\S]*Cache-Control: public, max-age=604800, stale-while-revalidate=86400/,
  );
  assert.match(
    headers,
    /\/favicon\.svg[\s\S]*Cache-Control: public, max-age=604800, stale-while-revalidate=86400/,
  );
  assert.doesNotMatch(headers, /^\/\*$/m);
});

test("Cloudflare edge-caches only successful explicitly public API responses", async () => {
  const module = await import("./cloudflareFrontendWorker.ts").catch(() => null);
  assert.ok(module, "cloudflareFrontendWorker.ts must exist");

  const stored = new Map<string, Response>();
  const edgeCache = {
    match: async (request: Request) => stored.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=14400");
      stored.set(request.url, new Response(response.body, {
        status: response.status,
        headers,
      }));
    },
  };
  let originCalls = 0;
  const worker = module.createCloudflareFrontendWorker(async (request: Request) => {
    originCalls += 1;
    if (new URL(request.url).pathname === "/auth/me") {
      return Response.json({ user: null }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json({ total: 42 }, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  }, edgeCache);
  const environment = {
    ASSETS: { fetch: async () => new Response("asset") },
    API_ORIGIN: "https://api.vitrines.ai",
  };

  const first = await worker.fetch(
    new Request("https://vitrines.ai/api/catalog/stats"),
    environment,
  );
  const second = await worker.fetch(
    new Request("https://vitrines.ai/api/catalog/stats"),
    environment,
  );
  await worker.fetch(new Request("https://vitrines.ai/api/auth/me"), environment);
  await worker.fetch(new Request("https://vitrines.ai/api/auth/me"), environment);

  assert.equal(first.headers.get("x-vitrines-edge-cache"), "MISS");
  assert.equal(second.headers.get("x-vitrines-edge-cache"), "HIT");
  assert.equal(second.headers.get("cache-control"), "public, max-age=600");
  assert.equal(second.headers.has("x-vitrines-origin-cache-control"), false);
  assert.deepEqual(await second.json(), { total: 42 });
  assert.equal(originCalls, 3);
  assert.equal(stored.size, 1);
});

test("Cloudflare does not cache public-route errors or origin no-store responses", async () => {
  const module = await import("./cloudflareFrontendWorker.ts").catch(() => null);
  assert.ok(module, "cloudflareFrontendWorker.ts must exist");

  const stored = new Map<string, Response>();
  const edgeCache = {
    match: async (request: Request) => stored.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      stored.set(request.url, response.clone());
    },
  };
  let originCalls = 0;
  const worker = module.createCloudflareFrontendWorker(async (request: Request) => {
    originCalls += 1;
    const url = new URL(request.url);
    if (url.pathname === "/catalog/facet-preview") {
      return Response.json({ error: "invalid facet preview" }, {
        status: 400,
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }
    return Response.json({ items: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }, edgeCache);
  const environment = {
    ASSETS: { fetch: async () => new Response("asset") },
    API_ORIGIN: "https://api.vitrines.ai",
  };

  await worker.fetch(
    new Request("https://vitrines.ai/api/catalog/facet-preview"),
    environment,
  );
  await worker.fetch(
    new Request("https://vitrines.ai/api/catalog/facet-preview"),
    environment,
  );
  await worker.fetch(
    new Request("https://vitrines.ai/api/sites?refresh=1"),
    environment,
  );
  await worker.fetch(
    new Request("https://vitrines.ai/api/sites?refresh=1"),
    environment,
  );

  assert.equal(originCalls, 4);
  assert.equal(stored.size, 0);
});

test("no Railway config remains now that the API isn't deployed there", async () => {
  const source = await readDeploymentFile("railway.json");
  assert.equal(source, "", "railway.json should not exist");
});
