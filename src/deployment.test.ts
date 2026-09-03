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
    // Without a run_worker_first entry the static-asset router answers first
    // and single-page-application handling returns index.html, so the media
    // handler never runs. Every public media prefix needs one.
    run_worker_first: [
      "/api",
      "/api/*",
      "/assets/icons/*",
      "/assets/thumbnails/*",
      "/assets/sites/*",
      "/assets/ui-elements/*",
    ],
  });
  assert.doesNotMatch(source, /API_ORIGIN/);
});

test("Cloudflare deploys preserve dashboard-managed production bindings", async () => {
  const source = await readDeploymentFile("package.json");
  const scripts = (JSON.parse(source) as { scripts?: Record<string, string> }).scripts;
  assert.match(scripts?.["deploy:cloudflare"] ?? "", /wrangler deploy --keep-vars/);
  assert.match(scripts?.["deploy:cloudflare:dry-run"] ?? "", /wrangler deploy --dry-run --keep-vars/);
});

test("production deploy commands use the guarded release script", async () => {
  const packageSource = await readDeploymentFile("package.json");
  const scripts = (JSON.parse(packageSource) as { scripts?: Record<string, string> }).scripts;
  assert.equal(scripts?.deploy, "bash scripts/deploy.sh all");
  assert.equal(scripts?.["deploy:api"], "bash scripts/deploy.sh api");
  assert.equal(scripts?.["deploy:web"], "bash scripts/deploy.sh web");
  assert.equal(scripts?.["deploy:production:dry-run"], "bash scripts/deploy.sh all --dry-run");

  const deployScript = await readDeploymentFile("scripts/deploy.sh");
  assert.match(deployScript, /git diff --quiet HEAD --/);
  assert.match(deployScript, /wrangler deploy --keep-vars/);
  assert.match(deployScript, /wrangler deploy --dry-run --keep-vars/);
  assert.match(deployScript, /preflight_migrations/);
  assert.match(deployScript, /APP_URL='\$app_url' is not the canonical production origin/);
  assert.match(
    deployScript,
    /docker run --rm --env-file '\$ENV_FILE' '\$IMAGE:\$sha'[\s\\]*node --experimental-strip-types scripts\/migrate\.ts/,
  );
  assert.ok(
    deployScript.indexOf('say "Apply database migrations"')
      < deployScript.indexOf('say "Swap container'),
  );
  assert.match(deployScript, /vitrines-designer-canvas-collab/);
  assert.match(deployScript, /CANVAS_COLLAB_HEALTH_URL/);
  assert.match(deployScript, /--env-file '\$ENV_FILE' -e PORT=3012 -p '\$CANVAS_COLLAB_PORT_BIND'/);
  assert.match(deployScript, /caddy validate/);

  const caddyfile = await readDeploymentFile("deploy/vitrines-api.Caddyfile");
  assert.match(caddyfile, /path \/api\/designer-canvas-collaboration/);
  assert.match(caddyfile, /reverse_proxy @designerCanvasCollaboration 127\.0\.0\.1:3012/);
});

test("the API image declares every root runtime dependency it imports", async () => {
  const packageSource = await readDeploymentFile("services/api/package.json");
  const packageJson = JSON.parse(packageSource) as { dependencies?: Record<string, string> };

  assert.equal(packageJson.dependencies?.["ffmpeg-static"], "5.3.0");
});

test("the frontend declares runtime dependencies imported by bundled artifacts", async () => {
  const packageSource = await readDeploymentFile("package.json");
  const packageJson = JSON.parse(packageSource) as { dependencies?: Record<string, string> };
  const pullWindow = await readDeploymentFile(
    "artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/PullWindow.jsx",
  );
  const repoExplorer = await readDeploymentFile(
    "artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/src/components/RepoExplorer.jsx",
  );
  const meliusScrollProvider = await readDeploymentFile(
    "artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/MeliusScrollProvider.jsx",
  );

  assert.match(pullWindow, /from ["']motion\/react["']/);
  assert.match(packageJson.dependencies?.motion ?? "", /^\^13\./);
  assert.match(repoExplorer, /from ["']@phosphor-icons\/react["']/);
  assert.equal(packageJson.dependencies?.["@phosphor-icons/react"], "2.1.10");
  assert.match(meliusScrollProvider, /from ["']lenis["']/);
  assert.equal(packageJson.dependencies?.lenis, "1.3.26");
});

test("production releases are not triggered by GitHub Actions", async () => {
  const workflow = await readDeploymentFile(".github/workflows/deploy-production.yml");
  assert.equal(workflow, "");
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
    new Request("https://app.example.com/api/apps?limit=24", {
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
  assert.equal(forwarded?.url, "https://api.example.com/apps?limit=24");
  assert.equal(forwarded?.method, "POST");
  assert.equal(forwarded?.headers.get("authorization"), "Bearer signed.jwt.token");
  assert.equal(await forwarded?.text(), JSON.stringify({ cursor: "next" }));
});

test("Cloudflare preserves the collaboration WebSocket gateway path for Caddy", async () => {
  const module = await import("./cloudflareFrontendWorker.ts").catch(() => null);
  assert.ok(module, "cloudflareFrontendWorker.ts must exist");

  let forwarded: Request | undefined;
  const worker = module.createCloudflareFrontendWorker(async (request: Request) => {
    forwarded = request;
    // Node's Response constructor deliberately excludes the WebSocket-only
    // 101 status. This mock only verifies the forwarded upgrade request.
    return new Response("proxied");
  });

  await worker.fetch(
    new Request(
      "https://vitrines.ai/api/designer-canvas-collaboration?projectId=project-1&canvasId=canvas-1",
      { headers: { "sec-websocket-protocol": "vitrines-bearer, signed.jwt.token" } },
    ),
    {
      ASSETS: { fetch: async () => new Response("asset") },
      API_ORIGIN: "https://api.vitrines.ai",
    },
  );

  assert.equal(
    forwarded?.url,
    "https://api.vitrines.ai/api/designer-canvas-collaboration?projectId=project-1&canvasId=canvas-1",
  );
  assert.equal(
    forwarded?.headers.get("sec-websocket-protocol"),
    "vitrines-bearer, signed.jwt.token",
  );
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
    new Request("https://vitrines.ai/api/apps/stats"),
    environment,
  );
  const second = await worker.fetch(
    new Request("https://vitrines.ai/api/apps/stats"),
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
    if (url.pathname === "/apps/facet-preview") {
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
    new Request("https://vitrines.ai/api/apps/facet-preview"),
    environment,
  );
  await worker.fetch(
    new Request("https://vitrines.ai/api/apps/facet-preview"),
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

test("Cloudflare serves only public media prefixes straight from R2", async () => {
  const module = await import("./cloudflareFrontendWorker.ts");
  const { publicMediaKey } = module;

  // Public: already shown to signed-out visitors on the catalog.
  assert.equal(publicMediaKey("/assets/thumbnails/1/abc.jpg"), "thumbnails/1/abc.jpg");
  assert.equal(
    publicMediaKey("/assets/sites/abc/versions/def/preview/ghi/9.webp"),
    "sites/abc/versions/def/preview/ghi/9.webp",
  );
  assert.equal(
    publicMediaKey("/assets/sites/abc/versions/def/poster/ghi/9.webp"),
    "sites/abc/versions/def/poster/ghi/9.webp",
  );

  // A Site version keeps its card media next to the paid product. Full-page
  // screenshots, section crops, the capture graph and the analysis evidence
  // must stay behind the API's entitlement checks.
  assert.equal(publicMediaKey("/assets/sites/abc/versions/def/page/ghi/9.webp"), null);
  assert.equal(publicMediaKey("/assets/sites/abc/versions/def/section/ghi/9.webp"), null);
  assert.equal(publicMediaKey("/assets/sites/abc/versions/def/source/ghi/9.json"), null);
  assert.equal(publicMediaKey("/assets/sites/abc/versions/def/analysis/ghi/9.json"), null);
  assert.equal(publicMediaKey("/assets/sites/abc/versions/def/mobile/ghi/9.mp4"), null);
  assert.equal(publicMediaKey("/assets/sites/9/preview.webp"), null, "malformed site keys are not public");
  assert.equal(publicMediaKey("/assets/ui-elements/3/x.png"), "ui-elements/3/x.png");
  assert.equal(publicMediaKey("/assets/icons/7/abc.webp"), "icons/7/abc.webp");

  // Private: full-resolution screens sit behind the unlock paywall, and
  // research assets are user-owned. Neither may be reachable this way.
  assert.equal(publicMediaKey("/assets/images/1/secret.png"), null);
  assert.equal(publicMediaKey("/assets/research/1/private.png"), null);
  assert.equal(publicMediaKey("/assets/"), null);
  assert.equal(publicMediaKey("/assets/../images/1/secret.png"), null);
  assert.equal(publicMediaKey("/assets/thumbnails/../images/1/secret.png"), null);
  assert.equal(publicMediaKey("/assets/%2e%2e/images/1/secret.png"), null);
  assert.equal(publicMediaKey("/api/apps"), null);

  // A prefix the asset router answers first is a prefix this Worker never sees.
  const routes = (JSON.parse(await readDeploymentFile("wrangler.jsonc")) as {
    assets?: { run_worker_first?: string[] };
  }).assets?.run_worker_first ?? [];
  for (const prefix of module.PUBLIC_MEDIA_PREFIXES) {
    assert.ok(routes.includes(`/assets/${prefix}*`), `${prefix} needs a run_worker_first route`);
  }

  const worker = module.createCloudflareFrontendWorker(async () => new Response("api"));
  const assets = { fetch: async () => new Response("asset") };

  // A private prefix must never reach the bucket at all.
  let reads = 0;
  const media = { get: async () => { reads++; return null; } };
  const denied = await worker.fetch(
    new Request("https://vitrines.ai/assets/images/1/secret.png"),
    { ASSETS: assets, MEDIA: media } as never,
  );
  assert.equal(reads, 0, "private prefixes must not hit R2");
  assert.equal(denied.status, 200, "unmatched paths fall through to static assets");

  // Database object keys omit the store's write prefix, so the Worker has to
  // add it back — without this the bucket read misses every time.
  let requestedKey: string | null = null;
  const served = await worker.fetch(
    new Request("https://vitrines.ai/assets/thumbnails/1/abc.jpg"),
    {
      ASSETS: assets,
      MEDIA_PREFIX: "prod",
      MEDIA: {
        get: async (key: string) => {
          requestedKey = key;
          return {
            body: null,
            httpMetadata: { contentType: "image/jpeg" },
            writeHttpMetadata: (headers: Headers) => headers.set("content-type", "image/jpeg"),
          };
        },
      },
    } as never,
  );
  assert.equal(requestedKey, "prod/thumbnails/1/abc.jpg");
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("Accept-Ranges"), "bytes");
  assert.equal(served.headers.get("X-Content-Type-Options"), "nosniff");

  // Video elements request byte ranges. Answering with the whole file makes
  // seeking impossible, so a Range request must come back as a 206.
  assert.deepEqual(module.parseByteRange("bytes=0-1023"), { offset: 0, length: 1024 });
  assert.deepEqual(module.parseByteRange("bytes=512-"), { offset: 512 });
  assert.deepEqual(module.parseByteRange("bytes=-256"), { suffix: 256 });
  assert.equal(module.parseByteRange("bytes=0-1023, 2048-4095"), null, "multi-range falls back to the full body");
  assert.equal(module.parseByteRange(null), null);

  let rangeOptions: unknown = null;
  const partial = await worker.fetch(
    new Request("https://vitrines.ai/assets/sites/a/versions/b/preview/c/9.webm", {
      headers: { range: "bytes=100-199" },
    }),
    {
      ASSETS: assets,
      MEDIA_PREFIX: "prod",
      MEDIA: {
        get: async (_key: string, options?: unknown) => {
          rangeOptions = options;
          return {
            body: null,
            size: 5_000,
            range: { offset: 100, length: 100 },
            httpMetadata: { contentType: "video/webm" },
            writeHttpMetadata: (headers: Headers) => headers.set("content-type", "video/webm"),
          };
        },
      },
    } as never,
  );
  assert.deepEqual(rangeOptions, { range: { offset: 100, length: 100 } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Range"), "bytes 100-199/5000");
  assert.equal(partial.headers.get("Content-Length"), "100");
  assert.equal(partial.headers.get("X-Content-Type-Options"), "nosniff");

  // Content-addressed keys never change, so a repeat request must come from the
  // colo cache instead of paying for another R2 read.
  const entries = new Map<string, Response>();
  const cachingWorker = module.createCloudflareFrontendWorker(
    async () => new Response("api"),
    {
      match: async (request: Request) => entries.get(request.url),
      put: async (request: Request, response: Response) => {
        entries.set(request.url, response);
      },
    },
  );
  let bucketReads = 0;
  const cachedEnvironment = {
    ASSETS: assets,
    MEDIA_PREFIX: "prod",
    MEDIA: {
      get: async () => {
        bucketReads += 1;
        return {
          body: null,
          httpMetadata: { contentType: "image/webp" },
          writeHttpMetadata: (headers: Headers) => headers.set("content-type", "image/webp"),
        };
      },
    },
  } as never;
  const iconRequest = () => new Request("https://vitrines.ai/assets/icons/7/abc.webp");
  await cachingWorker.fetch(iconRequest(), cachedEnvironment);
  const repeat = await cachingWorker.fetch(iconRequest(), cachedEnvironment);
  assert.equal(bucketReads, 1, "a cached image must not read R2 again");
  assert.equal(repeat.headers.get("content-type"), "image/webp");
  assert.equal(served.headers.get("content-type"), "image/jpeg");
  assert.match(served.headers.get("Cache-Control") ?? "", /immutable/);
});
