import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  benchmarkDiscoveryApis,
  discoveryBenchmarkCases,
  formatBenchmarkTable,
  parseBenchmarkOptions,
  summarizeTimings,
  validateDiscoveryEnvelope,
} from "./benchmark-discovery-api.ts";

test("reuses the nearest-rank timing summary for even and tail samples", () => {
  assert.deepEqual(summarizeTimings([9.4, 1.2, 5.1, 3.3]), {
    minMs: 1,
    medianMs: 4,
    p95Ms: 9,
    maxMs: 9,
  });
});

test("builds representative Apps, Sites, and Flows discovery cases", () => {
  const cases = discoveryBenchmarkCases("http://127.0.0.1:3010/");
  assert.deepEqual(cases.map(({ id, url }) => ({ id, url })), [
    {
      id: "apps-latest",
      url: "http://127.0.0.1:3010/catalog?platform=web&sort=latest&limit=24",
    },
    {
      id: "apps-category",
      url: "http://127.0.0.1:3010/catalog?platform=web&sort=latest&limit=24&filter=categories.Shopping",
    },
    {
      id: "apps-combined",
      url: "http://127.0.0.1:3010/catalog?platform=web&sort=latest&limit=24&filter=categories.Shopping&filter=screens.Checkout",
    },
    {
      id: "sites-latest",
      url: "http://127.0.0.1:3010/sites?platform=web&sort=latest&limit=24",
    },
    {
      id: "sites-combined",
      url: "http://127.0.0.1:3010/sites?platform=web&sort=latest&limit=24&filter=categories.Portfolio&filter=sections.Hero&filter=styles.Minimal",
    },
    {
      id: "flows-popular",
      url: "http://127.0.0.1:3010/catalog/flows?platform=web&sort=popular&limit=12",
    },
    {
      id: "flows-grouped",
      url: "http://127.0.0.1:3010/catalog/flows?platform=web&sort=grouped&limit=12",
    },
    {
      id: "flows-parent-query",
      url: "http://127.0.0.1:3010/catalog/flows?platform=web&sort=popular&limit=12&query=settings",
    },
    {
      id: "flows-child-query",
      url: "http://127.0.0.1:3010/catalog/flows?platform=web&sort=popular&limit=12&query=logging+out",
    },
    {
      id: "flows-group-filter",
      url: "http://127.0.0.1:3010/catalog/flows?platform=web&sort=popular&limit=12&filter=flowGroups.Settings",
    },
  ]);
});

test("parses spaced and equals CLI options before environment defaults", () => {
  assert.deepEqual(parseBenchmarkOptions(
    ["--base-url", "http://127.0.0.1:3011", "--runs=3", "--json"],
    { DISCOVERY_API_URL: "http://ignored.test", DISCOVERY_BENCHMARK_RUNS: "8" },
  ), {
    baseUrl: "http://127.0.0.1:3011/",
    runs: 3,
    format: "json",
  });
  assert.deepEqual(parseBenchmarkOptions([], {
    DISCOVERY_API_URL: "http://api.test/root",
    DISCOVERY_BENCHMARK_RUNS: "2",
  }), {
    baseUrl: "http://api.test/root/",
    runs: 2,
    format: "table",
  });
});

test("rejects malformed options and malformed discovery envelopes", () => {
  assert.throws(
    () => parseBenchmarkOptions(["--runs=0"], {}),
    /runs must be an integer between 1 and 100/,
  );
  assert.throws(
    () => parseBenchmarkOptions(["--runs"], {}),
    /--runs requires a value/,
  );
  assert.throws(
    () => parseBenchmarkOptions(["--base-url"], {}),
    /--base-url requires a value/,
  );
  assert.throws(
    () => parseBenchmarkOptions(["--base-url", "not a url"], {}),
    /base URL/,
  );
  assert.throws(
    () => validateDiscoveryEnvelope({
      items: [],
      nextCursor: null,
      totalCount: 0,
      facets: [],
      extra: true,
    }),
    /exactly items, nextCursor, totalCount, and facets/,
  );
  assert.throws(
    () => validateDiscoveryEnvelope({
      items: [],
      nextCursor: 1,
      totalCount: -1,
      facets: {},
    }),
    /invalid discovery envelope/,
  );
});

test("warms once, runs N times, consumes bodies, and reports payload and status", async () => {
  const seenAcceptEncoding: string[] = [];
  let requests = 0;
  const body = JSON.stringify({
    items: [],
    nextCursor: null,
    totalCount: 0,
    facets: [],
  });
  const server = createServer((request, response) => {
    requests += 1;
    seenAcceptEncoding.push(String(request.headers["accept-encoding"]));
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.setHeader("content-length", Buffer.byteLength(body));
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const cases = discoveryBenchmarkCases(`http://127.0.0.1:${address.port}`).slice(0, 1);
    const results = await benchmarkDiscoveryApis({
      cases,
      runs: 2,
    });
    assert.equal(requests, 3);
    assert.deepEqual(seenAcceptEncoding, ["gzip, br", "gzip, br", "gzip, br"]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.id, "apps-latest");
    assert.equal(results[0]?.runs, 2);
    assert.equal(results[0]?.status, 200);
    assert.equal(results[0]?.decodedBytes, Buffer.byteLength(body));
    assert.equal(results[0]?.wireBytes, Buffer.byteLength(body));
    assert.equal(results[0]?.encoding, null);
    assert.match(formatBenchmarkTable(results), /apps-latest/);
    assert.match(formatBenchmarkTable(results), /p95/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});

test("fails on non-2xx and malformed discovery responses", async () => {
  let status = 503;
  const server = createServer((_request, response) => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(status === 200
      ? JSON.stringify({ items: [], nextCursor: null, totalCount: 0 })
      : JSON.stringify({ error: "unavailable" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const cases = [{
      id: "failure",
      url: `http://127.0.0.1:${address.port}/catalog`,
    }];
    await assert.rejects(
      benchmarkDiscoveryApis({ cases, runs: 1 }),
      /failure returned 503/,
    );
    status = 200;
    await assert.rejects(
      benchmarkDiscoveryApis({ cases, runs: 1 }),
      /failure returned an invalid discovery envelope/,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});
