import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCorpus,
  buildResearchPrompt,
  buildRepairPrompt,
  collectResearchPages,
  draftPlan,
  extractJson,
  fetchAndVerifyResearchSources,
  isResearchUrl,
  repairFlow,
  sanitizeDraft,
} from "./appResearch.ts";
import { parseCrawlPlan } from "./crawlPlan.ts";
import type { StepFailure } from "./smartCrawler.ts";

const HOME = "https://www.atlassian.com";

function listen(server: Server, host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      const { port } = server.address() as AddressInfo;
      resolve(`http://${host}:${port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("research url allowlist: same-site product/docs pages only", () => {
  assert.equal(isResearchUrl(HOME, "https://www.atlassian.com/software/jira"), true);
  assert.equal(isResearchUrl(HOME, "https://atlassian.com/solutions"), true);
  assert.equal(isResearchUrl(HOME, "/pricing"), true);
  assert.equal(isResearchUrl(HOME, "https://support.atlassian.com/jira/"), true);
  assert.equal(isResearchUrl(HOME, "https://developer.atlassian.com/cloud"), true);

  assert.equal(isResearchUrl(HOME, "https://www.atlassian.com/blog/announcement"), false); // path not allowlisted
  assert.equal(isResearchUrl(HOME, "https://twitter.com/atlassian"), false); // off-site
  assert.equal(isResearchUrl(HOME, "https://evilatlassian.com/docs"), false); // suffix trick
  assert.equal(isResearchUrl(HOME, "mailto:x@atlassian.com"), false);
});

test("research crawl rejects a non-http homepage", async () => {
  await assert.rejects(collectResearchPages("file:///tmp/astryx-secret"), /http/i);
});

test("verified research sources resolve every hop and enforce text size bounds", async () => {
  let fetches = 0;
  await assert.rejects(
    fetchAndVerifyResearchSources(["https://docs.example.test/start"], HOME, {
      resolveHostname: async () => ["127.0.0.1"],
      fetch: async () => {
        fetches++;
        return new Response("should not fetch");
      },
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    }),
    /public/i,
  );
  assert.equal(fetches, 0);

  await assert.rejects(
    fetchAndVerifyResearchSources(["https://docs.example.test/start"], HOME, {
      resolveHostname: async (hostname) => hostname === "docs.example.test" ? ["93.184.216.34"] : ["10.0.0.1"],
      fetch: async () => {
        fetches++;
        return new Response(null, { status: 302, headers: { location: "https://private.example.test/final" } });
      },
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    }),
    /public/i,
  );
  assert.equal(fetches, 1);

  await assert.rejects(
    fetchAndVerifyResearchSources(["https://docs.example.test/large"], HOME, {
      resolveHostname: async () => ["93.184.216.34"],
      fetch: async () => new Response("x".repeat(1_048_577), { headers: { "content-type": "text/html" } }),
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    }),
    /1 MiB/i,
  );

  const [source] = await fetchAndVerifyResearchSources(["https://docs.example.test/final"], HOME, {
    resolveHostname: async () => ["93.184.216.34"],
    fetch: async () => new Response("<title>Docs</title><main>Product help</main>", { headers: { "content-type": "text/html" } }),
    now: () => new Date("2026-07-16T00:00:00.000Z"),
  });
  assert.deepEqual(source, {
    url: "https://docs.example.test/final",
    title: "Docs",
    retrievedAt: "2026-07-16T00:00:00.000Z",
    text: "<title>Docs</title><main>Product help</main>",
  });
});

test("research crawl never follows a main-frame redirect to a disallowed host", async () => {
  const sentinel = "SSRF_SECRET_SENTINEL_7f3c9a";
  let secretHits = 0;
  const secretServer = createServer((_request, response) => {
    secretHits++;
    response.setHeader("content-type", "text/html");
    response.end(`<main>${sentinel}</main>`);
  });
  const secretOrigin = await listen(secretServer, "localhost");
  const homepageServer = createServer((_request, response) => {
    response.statusCode = 302;
    response.setHeader("location", `${secretOrigin}/private`);
    response.end();
  });
  const homepage = await listen(homepageServer, "127.0.0.1");
  try {
    const pages = await collectResearchPages(homepage);
    assert.equal(secretHits, 0, "disallowed main-frame request must be aborted before reaching the other host");
    assert.ok(!pages.some((page) => page.url.startsWith(secretOrigin) || page.text.includes(sentinel)));
  } finally {
    await Promise.all([close(homepageServer), close(secretServer)]);
  }
});

test("research crawl blocks a disallowed host after an allowed redirect hop", async () => {
  const sentinel = "MULTIHOP_SSRF_SECRET_SENTINEL_a903e1";
  let secretHits = 0;
  const secretServer = createServer((_request, response) => {
    secretHits++;
    response.setHeader("content-type", "text/html");
    response.end(`<main>${sentinel}</main>`);
  });
  const secretOrigin = await listen(secretServer, "localhost");
  const homepageServer = createServer((request, response) => {
    response.statusCode = 302;
    response.setHeader("location", request.url === "/" ? "/docs/hop" : `${secretOrigin}/private`);
    response.end();
  });
  const homepage = await listen(homepageServer, "127.0.0.1");
  try {
    const pages = await collectResearchPages(homepage);
    assert.equal(secretHits, 0, "every redirect Location must be approved before the next request");
    assert.ok(!pages.some((page) => page.url.startsWith(secretOrigin) || page.text.includes(sentinel)));
  } finally {
    await Promise.all([close(homepageServer), close(secretServer)]);
  }
});

test("research crawl skips an allowed redirect loop within a bounded number of requests", async () => {
  let hits = 0;
  const homepageServer = createServer((request, response) => {
    hits++;
    response.statusCode = 302;
    response.setHeader("location", request.url === "/" ? "/docs/hop" : "/");
    response.end();
  });
  const homepage = await listen(homepageServer, "127.0.0.1");
  const started = performance.now();
  try {
    assert.deepEqual(await collectResearchPages(homepage), []);
    assert.ok(hits <= 10, `redirect loop made ${hits} requests`);
    assert.ok(performance.now() - started < 45_000, "redirect loop must terminate within one browser navigation timeout budget");
  } finally {
    await close(homepageServer); // completes only after the collector's browser is closed
  }
});

test("research crawl preserves the logical final URL for an ordinary allowed redirect", async () => {
  let finalHits = 0;
  const homepageServer = createServer((request, response) => {
    if (request.url === "/") {
      response.statusCode = 302;
      response.setHeader("location", "/docs/final");
      response.end();
      return;
    }
    finalHits++;
    response.setHeader("content-type", "text/html");
    response.end("<main>Allowed final page</main>");
  });
  const homepage = await listen(homepageServer, "127.0.0.1");
  try {
    const pages = await collectResearchPages(homepage);
    assert.equal(finalHits, 1, "the prefetched final response must not be fetched again by Chromium");
    assert.deepEqual(pages, [{ url: `${homepage}/docs/final`, text: "Allowed final page" }]);
  } finally {
    await close(homepageServer);
  }
});

test("corpus truncates per page and overall", () => {
  const pages = [
    { url: "https://x.com/a", text: "a".repeat(50_000) },
    { url: "https://x.com/b", text: "b".repeat(50_000) },
    { url: "https://x.com/c", text: "c".repeat(50_000) },
    { url: "https://x.com/d", text: "d".repeat(50_000) },
    { url: "https://x.com/e", text: "e".repeat(50_000) },
    { url: "https://x.com/f", text: "f".repeat(50_000) },
    { url: "https://x.com/g", text: "g".repeat(50_000) },
    { url: "https://x.com/h", text: "h".repeat(50_000) },
  ];
  const corpus = buildCorpus(pages);
  assert.ok(corpus.length <= 60_000);
  assert.ok(corpus.includes("===== https://x.com/a ====="));
  assert.ok(!corpus.includes("h".repeat(10))); // later pages dropped, not squeezed
});

test("extractJson strips fences and prose", () => {
  assert.equal(extractJson('Here you go:\n```json\n{"a":1}\n```\nHope that helps!'), '{"a":1}');
  assert.throws(() => extractJson("no json here"), /no JSON object/);
});

const validReply = JSON.stringify({
  app: "wrong-name",
  revision: 99,
  startUrl: "https://elsewhere.com",
  domain: "Team tools.",
  sources: [HOME],
  reviewed: true, // model lies — sanitize must flatten these
  flows: [
    {
      id: "browse",
      title: "Browse products",
      description: "d",
      safe: true,
      requiredSecrets: [],
      steps: [
        {
          id: "open-software",
          action: "goto",
          url: "/software",
          safety: "read",
          expected: { state: "Software", url: "https://elsewhere.com/software" },
        },
      ],
    },
  ],
});

test("research prompt describes the revisioned observable and secret-safe contract", () => {
  const prompt = buildResearchPrompt("atlassian", HOME, "corpus");
  assert.match(prompt, /"revision": 1/);
  assert.match(prompt, /"reviewed": false/);
  assert.match(prompt, /"requiredSecrets": \[\]/);
  assert.match(prompt, /"id": "<stable-step-id>"/);
  assert.match(prompt, /"safety": "read"/);
  assert.match(prompt, /"page": "same"/);
  assert.match(prompt, /"expected"[\s\S]*"state"/);
  assert.match(prompt, /role\+name[\s\S]*text[\s\S]*CSS/i);
  assert.match(prompt, /at least one[\s\S]*(url|urlPattern)[\s\S]*(visible|hidden)/i);
  assert.match(prompt, /page alone/i);
  assert.match(prompt, /\$\[A-Z\]\[A-Z0-9_\]\*/);
  assert.match(prompt, /locatorReason/);
  assert.match(prompt, /optionalReason/);
  assert.match(prompt, /safe flow[\s\S]*only[\s\S]*read/i);
});

test("sanitizeDraft never trusts the model with revision, safety fields, or identity", () => {
  const plan = sanitizeDraft(parseCrawlPlan(validReply), "atlassian", HOME);
  assert.equal(plan.app, "atlassian");
  assert.equal(plan.startUrl, HOME);
  assert.equal(plan.revision, 1);
  assert.equal(plan.reviewed, false);
  assert.ok(plan.flows.every((f) => f.safe === false));
  assert.ok(plan.flows.every((f) => f.steps.every((step) => step.safety === "side-effect")));
  assert.deepEqual(plan.flows[0].steps[0].expected, { state: "Software", url: "https://elsewhere.com/software" });
  assert.deepEqual(plan.flows[0].requiredSecrets, []);
});

test("draftPlan re-asks exactly once on invalid output, then succeeds or gives up", async () => {
  // first reply invalid, second valid -> succeeds after one retry
  let calls = 0;
  const flaky = async (prompt: string) => {
    calls++;
    if (calls === 1) return "sorry, no json";
    assert.ok(prompt.includes("failed validation"), "retry prompt must carry the validator error");
    return validReply;
  };
  const plan = await draftPlan("atlassian", HOME, "corpus", flaky);
  assert.equal(calls, 2);
  assert.equal(plan.flows.length, 1);

  // always invalid -> gives up after the single retry without echoing credential-like reply text
  let stubborn = 0;
  const sentinel = "UNIQUE_CREDENTIAL_SENTINEL_d44f90";
  await assert.rejects(
    draftPlan("atlassian", HOME, "corpus", async () => {
      stubborn++;
      return `still not json ${sentinel}`;
    }),
    (error: unknown) =>
      error instanceof Error &&
      /after a retry[\s\S]*Reply contains no JSON object/.test(error.message) &&
      !error.message.includes(sentinel) &&
      !error.message.includes("raw reply")
  );
  assert.equal(stubborn, 2);
});

function repairFixture() {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-repair-"));
  const plan = {
    app: "atlassian",
    revision: 3,
    startUrl: HOME,
    domain: "Team tools.",
    sources: [`${HOME}/software`],
    reviewed: true,
    flows: [
      {
        id: "browse",
        title: "Browse",
        description: "Browse products.",
        safe: true,
        requiredSecrets: [],
        steps: [
          {
            id: "open-software",
            action: "goto",
            url: "/software",
            safety: "read",
            expected: { state: "Software", url: `${HOME}/software` },
          },
          {
            id: "open-product",
            action: "click",
            text: "Old label",
            safety: "read",
            expected: { state: "Product", visible: { text: "Product details" } },
          },
        ],
      },
    ],
  };
  const path = join(dataDir, "crawl-plans", "atlassian.json");
  mkdirSync(join(dataDir, "crawl-plans"), { recursive: true });
  writeFileSync(path, JSON.stringify(plan));
  const failure: StepFailure = {
    flow: "browse",
    flowTitle: "Browse",
    stepIndex: 1,
    stepId: "open-product",
    step: plan.flows[0].steps[1] as StepFailure["step"],
    locator: { text: "Old label" },
    currentUrl: `${HOME}/software`,
    expected: plan.flows[0].steps[1]!.expected,
    errorClass: "TimeoutError",
    error: "Timeout",
    screenshot: join(dataDir, "missing.png"),
  };
  mkdirSync(join(dataDir, "crawl-reports", "atlassian"), { recursive: true });
  writeFileSync(join(dataDir, "crawl-reports", "atlassian", "report.json"), JSON.stringify({ app: "atlassian", failures: [failure] }));
  return { dataDir, failure, path, plan };
}

const repairedStep = (extra: Record<string, unknown> = {}) => ({
  id: "open-product",
  action: "click",
  role: "link",
  name: "New label",
  safety: "read",
  expected: { state: "New product", urlPattern: `${HOME}/software/*` },
  ...extra,
});

async function rejectsRepairWithoutWriting(replacement: Record<string, unknown>, expected: RegExp): Promise<void> {
  const { dataDir, path } = repairFixture();
  const before = readFileSync(path, "utf8");
  let confirmations = 0;
  try {
    await assert.rejects(
      repairFlow(
        "atlassian",
        "browse",
        async () => JSON.stringify(replacement),
        async () => {
          confirmations++;
          return true;
        },
        dataDir
      ),
      expected
    );
    assert.equal(confirmations, 0, "invalid candidate must fail before confirmation");
    assert.equal(readFileSync(path, "utf8"), before, "invalid candidate must not change the plan file");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("repairFlow rejects a changed replacement id without writing", async () => {
  await rejectsRepairWithoutWriting(repairedStep({ id: "renamed-product" }), /replacement id.*open-product/i);
});

test("repairFlow rejects a duplicate replacement id without writing", async () => {
  await rejectsRepairWithoutWriting(repairedStep({ id: "open-software" }), /replacement id.*open-product/i);
});

test("repairFlow rejects a side-effect replacement in a safe flow without writing", async () => {
  await rejectsRepairWithoutWriting(repairedStep({ safety: "side-effect" }), /side-effect.*safe flow/i);
});

test("repairFlow rejects an unmatched secret reference without writing", async () => {
  await rejectsRepairWithoutWriting(
    repairedStep({ action: "fill", role: "textbox", name: "Email", value: "$NEW_SECRET" }),
    /requiredSecrets.*NEW_SECRET/
  );
});

test("repairFlow preserves a concurrently changed plan and cleans its atomic temp file", async () => {
  const { dataDir, path, plan } = repairFixture();
  const newerPlan = { ...structuredClone(plan), revision: 4, reviewed: false, domain: "Concurrent curator edit." };
  const newerBytes = JSON.stringify(newerPlan, null, 2);
  try {
    await assert.rejects(
      repairFlow(
        "atlassian",
        "browse",
        async () => JSON.stringify(repairedStep()),
        async () => {
          writeFileSync(path, newerBytes);
          return true;
        },
        dataDir
      ),
      /changed during repair/i
    );
    assert.equal(readFileSync(path, "utf8"), newerBytes);
    assert.deepEqual(readdirSync(join(dataDir, "crawl-plans")), ["atlassian.json"]);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("repairFlow patches the failed step only on confirmation", async () => {
  const { dataDir, failure, path, plan } = repairFixture();

  const ask = async (prompt: string) => {
    assert.ok(prompt.includes('"Old label"'), "repair prompt must include the failed step");
    assert.ok(prompt.includes("Timeout"));
    assert.match(prompt, /"id"/);
    assert.match(prompt, /"safety"/);
    assert.match(prompt, /"expected"/);
    return JSON.stringify(repairedStep());
  };

  // declined -> untouched
  assert.equal(await repairFlow("atlassian", "browse", ask, async () => false, dataDir), false);
  let onDisk = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(onDisk.flows[0].steps[1].text, "Old label");
  assert.equal(onDisk.revision, 3);
  assert.equal(onDisk.reviewed, true);

  // confirmed -> patched into a new unreviewed revision
  assert.equal(await repairFlow("atlassian", "browse", ask, async () => true, dataDir), true);
  onDisk = JSON.parse(readFileSync(path, "utf8"));
  const expectedPlan = structuredClone(plan);
  expectedPlan.revision = 4;
  expectedPlan.reviewed = false;
  expectedPlan.flows[0].steps[1] = repairedStep() as never;
  assert.deepEqual(onDisk, expectedPlan, "repair must change only the target step, revision, and reviewed state");

  const repairPrompt = buildRepairPrompt(failure, plan.flows[0].steps as never);
  assert.ok(repairPrompt.includes("raw JSON only"));
  assert.ok(repairPrompt.includes('"expected"'));
  rmSync(dataDir, { recursive: true, force: true });
});
