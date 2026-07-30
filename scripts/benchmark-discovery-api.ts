import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import {
  summarizeTimings,
  type TimingSummary,
} from "./benchmark-flow-discovery.ts";

export { summarizeTimings } from "./benchmark-flow-discovery.ts";

export interface DiscoveryBenchmarkCase {
  id: string;
  url: string;
}

export interface DiscoveryBenchmarkResult extends TimingSummary {
  id: string;
  url: string;
  runs: number;
  status: number;
  warmupMs: number;
  decodedBytes: number;
  wireBytes: number | null;
  encoding: string | null;
}

export interface BenchmarkOptions {
  baseUrl: string;
  runs: number;
  format: "json" | "table";
}

type Environment = Record<string, string | undefined>;

function caseUrl(
  baseUrl: string,
  path: string,
  entries: readonly (readonly [string, string])[],
): string {
  const target = new URL(path, new URL(baseUrl));
  for (const [key, value] of entries) target.searchParams.append(key, value);
  return target.toString();
}

export function discoveryBenchmarkCases(baseUrl: string): DiscoveryBenchmarkCase[] {
  const apps = (id: string, filters: readonly string[] = []) => ({
    id,
    url: caseUrl(baseUrl, "/catalog", [
      ["platform", "web"],
      ["sort", "latest"],
      ["limit", "24"],
      ...filters.map((filter) => ["filter", filter] as const),
    ]),
  });
  const sites = (id: string, filters: readonly string[] = []) => ({
    id,
    url: caseUrl(baseUrl, "/sites", [
      ["platform", "web"],
      ["sort", "latest"],
      ["limit", "24"],
      ...filters.map((filter) => ["filter", filter] as const),
    ]),
  });
  const flows = (
    id: string,
    sort: "popular" | "grouped",
    extras: readonly (readonly [string, string])[] = [],
  ) => ({
    id,
    url: caseUrl(baseUrl, "/catalog/flows", [
      ["platform", "web"],
      ["sort", sort],
      ["limit", "12"],
      ...extras,
    ]),
  });
  return [
    apps("apps-latest"),
    apps("apps-category", ["categories.Shopping"]),
    apps("apps-combined", ["categories.Shopping", "screens.Checkout"]),
    sites("sites-latest"),
    sites("sites-combined", [
      "categories.Portfolio",
      "sections.Hero",
      "styles.Minimal",
    ]),
    flows("flows-popular", "popular"),
    flows("flows-grouped", "grouped"),
    flows("flows-parent-query", "popular", [["query", "settings"]]),
    flows("flows-child-query", "popular", [["query", "logging out"]]),
    flows("flows-group-filter", "popular", [["filter", "flowGroups.Settings"]]),
  ];
}

export function validateDiscoveryEnvelope(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid discovery envelope");
  }
  const envelope = value as Record<string, unknown>;
  const keys = Object.keys(envelope).sort();
  if (keys.join(",") !== "facets,items,nextCursor,totalCount") {
    throw new Error(
      "discovery envelope must contain exactly items, nextCursor, totalCount, and facets",
    );
  }
  if (!Array.isArray(envelope.items)
    || !Array.isArray(envelope.facets)
    || !(envelope.nextCursor === null || typeof envelope.nextCursor === "string")
    || !Number.isSafeInteger(envelope.totalCount)
    || Number(envelope.totalCount) < 0) {
    throw new Error("invalid discovery envelope");
  }
}

function optionValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const equalsValue = argv.find((argument) => argument.startsWith(prefix));
  if (equalsValue) {
    const value = equalsValue.slice(prefix.length);
    if (!value) throw new Error(`${name} requires a value`);
    return value;
  }
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export function parseBenchmarkOptions(
  argv: readonly string[],
  environment: Environment = process.env,
): BenchmarkOptions {
  const rawBaseUrl = optionValue(argv, "--base-url")
    ?? environment.DISCOVERY_API_URL
    ?? "http://127.0.0.1:3010";
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new Error("base URL must be an absolute HTTP(S) URL");
  }
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  const rawRuns = optionValue(argv, "--runs")
    ?? environment.DISCOVERY_BENCHMARK_RUNS
    ?? "10";
  const runs = Number(rawRuns);
  if (!Number.isInteger(runs) || runs < 1 || runs > 100) {
    throw new RangeError("runs must be an integer between 1 and 100");
  }
  const rawFormat = optionValue(argv, "--format");
  const format = argv.includes("--json") || rawFormat === "json" ? "json" : "table";
  if (rawFormat !== undefined && rawFormat !== "json" && rawFormat !== "table") {
    throw new Error("format must be json or table");
  }
  return { baseUrl: baseUrl.toString(), runs, format };
}

interface RequestMeasurement {
  elapsedMs: number;
  status: number;
  decodedBytes: number;
  wireBytes: number | null;
  encoding: string | null;
}

async function measureRequest(
  benchmarkCase: DiscoveryBenchmarkCase,
): Promise<RequestMeasurement> {
  const startedAt = performance.now();
  const response = await fetch(benchmarkCase.url, {
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip, br",
    },
  });
  const body = await response.arrayBuffer();
  const elapsedMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`${benchmarkCase.id} returned ${response.status}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
    validateDiscoveryEnvelope(parsed);
  } catch {
    throw new Error(`${benchmarkCase.id} returned an invalid discovery envelope`);
  }
  const contentLength = response.headers.get("content-length");
  const wireBytes = contentLength !== null && /^\d+$/.test(contentLength)
    ? Number(contentLength)
    : null;
  return {
    elapsedMs,
    status: response.status,
    decodedBytes: body.byteLength,
    wireBytes,
    encoding: response.headers.get("content-encoding"),
  };
}

export async function benchmarkDiscoveryApis(input: {
  baseUrl?: string;
  cases?: readonly DiscoveryBenchmarkCase[];
  runs: number;
}): Promise<DiscoveryBenchmarkResult[]> {
  if (!Number.isInteger(input.runs) || input.runs < 1 || input.runs > 100) {
    throw new RangeError("runs must be an integer between 1 and 100");
  }
  const cases = input.cases
    ?? discoveryBenchmarkCases(input.baseUrl ?? "http://127.0.0.1:3010");
  const results: DiscoveryBenchmarkResult[] = [];
  for (const benchmarkCase of cases) {
    const warmup = await measureRequest(benchmarkCase);
    const timings: number[] = [];
    let sample = warmup;
    for (let index = 0; index < input.runs; index += 1) {
      sample = await measureRequest(benchmarkCase);
      timings.push(sample.elapsedMs);
    }
    results.push({
      id: benchmarkCase.id,
      url: benchmarkCase.url,
      runs: input.runs,
      status: sample.status,
      warmupMs: Math.round(warmup.elapsedMs),
      ...summarizeTimings(timings),
      decodedBytes: sample.decodedBytes,
      wireBytes: sample.wireBytes,
      encoding: sample.encoding,
    });
  }
  return results;
}

export function formatBenchmarkTable(
  results: readonly DiscoveryBenchmarkResult[],
): string {
  const headings = [
    "case",
    "status",
    "min",
    "median",
    "p95",
    "max",
    "decoded",
    "wire",
  ];
  const rows = results.map((result) => [
    result.id,
    String(result.status),
    `${result.minMs}ms`,
    `${result.medianMs}ms`,
    `${result.p95Ms}ms`,
    `${result.maxMs}ms`,
    String(result.decodedBytes),
    result.wireBytes === null ? "-" : String(result.wireBytes),
  ]);
  const widths = headings.map((heading, index) =>
    Math.max(heading.length, ...rows.map((row) => row[index]!.length)));
  return [headings, ...rows]
    .map((row) => row
      .map((value, index) => value.padEnd(widths[index]!))
      .join("  ")
      .trimEnd())
    .join("\n");
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  environment: Environment = process.env,
): Promise<void> {
  const options = parseBenchmarkOptions(argv, environment);
  const results = await benchmarkDiscoveryApis({
    baseUrl: options.baseUrl,
    runs: options.runs,
  });
  console.log(options.format === "json"
    ? JSON.stringify(results, null, 2)
    : formatBenchmarkTable(results));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
