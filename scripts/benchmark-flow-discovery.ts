import { pathToFileURL } from "node:url";

export interface TimingSummary {
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface FlowDiscoveryBenchmarkMeasurement extends TimingSummary {
  url: string;
  totalCount: number;
  decodedBytes: number;
}

export function flowDiscoveryBenchmarkViolations(
  measurements: readonly FlowDiscoveryBenchmarkMeasurement[],
): string[] {
  return measurements.flatMap((measurement) => {
    const violations = [];
    if (!Number.isSafeInteger(measurement.totalCount) || measurement.totalCount < 1) {
      violations.push(`${measurement.url}: no results`);
    }
    if (measurement.p95Ms > 250) {
      violations.push(`${measurement.url}: p95 ${measurement.p95Ms}ms exceeds 250ms`);
    }
    if (measurement.decodedBytes > 100_000) {
      violations.push(`${measurement.url}: ${measurement.decodedBytes} bytes exceeds 100000`);
    }
    return violations;
  });
}

export function summarizeTimings(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) throw new RangeError("at least one timing is required");
  const sorted = [...samples].sort((left, right) => left - right);
  const medianIndex = (sorted.length - 1) / 2;
  const lower = sorted[Math.floor(medianIndex)]!;
  const upper = sorted[Math.ceil(medianIndex)]!;
  return {
    minMs: Math.round(sorted[0]!),
    medianMs: Math.round((lower + upper) / 2),
    p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]!),
    maxMs: Math.round(sorted.at(-1)!),
  };
}

export function flowDiscoveryBenchmarkUrls(baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const route = new URL("/catalog/flows", base);
  const url = (input: {
    platform: "web" | "ios" | "android";
    sort: "popular" | "grouped";
    query?: string;
    filter?: string;
  }) => {
    const target = new URL(route);
    target.searchParams.set("platform", input.platform);
    target.searchParams.set("limit", "12");
    target.searchParams.set("facets", "summary");
    target.searchParams.set("sort", input.sort);
    if (input.query) target.searchParams.set("query", input.query);
    if (input.filter) target.searchParams.set("filter", input.filter);
    return target.toString();
  };
  return [
    url({ platform: "web", sort: "popular" }),
    url({ platform: "ios", sort: "popular" }),
    url({ platform: "android", sort: "popular" }),
    url({ platform: "web", sort: "grouped" }),
    url({ platform: "web", sort: "popular", query: "settings" }),
    url({
      platform: "web",
      sort: "popular",
      query: "checkout with payment method selection",
    }),
    url({ platform: "web", sort: "popular", filter: "flowGroups.Settings" }),
  ];
}

async function request(url: string) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, br" },
  });
  const body = await response.arrayBuffer();
  const envelope = JSON.parse(new TextDecoder().decode(body)) as {
    totalCount?: unknown;
  };
  const elapsedMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return {
    elapsedMs,
    decodedBytes: body.byteLength,
    encodedBytes: Number(response.headers.get("content-length")) || null,
    encoding: response.headers.get("content-encoding"),
    totalCount: Number(envelope.totalCount),
  };
}

async function main() {
  const baseArg = process.argv.find((argument) => argument.startsWith("--base-url="));
  const runsArg = process.argv.find((argument) => argument.startsWith("--runs="));
  const baseUrl = baseArg?.slice("--base-url=".length)
    ?? process.env.DISCOVERY_API_URL
    ?? "http://127.0.0.1:3011";
  const runs = Math.min(100, Math.max(1, Number(runsArg?.slice("--runs=".length) ?? 10)));
  const output = [];
  for (const url of flowDiscoveryBenchmarkUrls(baseUrl)) {
    const warmup = await request(url);
    const samples = [];
    let payload: Awaited<ReturnType<typeof request>> | undefined;
    for (let index = 0; index < runs; index += 1) {
      payload = await request(url);
      samples.push(payload.elapsedMs);
    }
    output.push({
      url,
      runs,
      warmupMs: Math.round(warmup.elapsedMs),
      ...summarizeTimings(samples),
      decodedBytes: payload!.decodedBytes,
      encodedBytes: payload!.encodedBytes,
      encoding: payload!.encoding,
      totalCount: payload!.totalCount,
    });
  }
  console.log(JSON.stringify(output, null, 2));
  const violations = flowDiscoveryBenchmarkViolations(output);
  if (violations.length > 0) throw new Error(violations.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
