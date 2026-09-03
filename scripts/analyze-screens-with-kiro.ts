import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  closePool,
  query,
  saveScreenAnalysis,
} from "../src/db.ts";
import { createKiroCliScreenAnalyzer } from "../src/kiroCliScreenAnalyzer.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import {
  createObjectStore,
  objectStoreConfigFromEnvironment,
} from "../src/objectStoreConfig.ts";

interface Options {
  app?: string;
  platform: "ios" | "android" | "web";
  versionNumber?: number;
  limit: number;
  concurrency: number;
  output?: string;
  allowEmpty: boolean;
  force: boolean;
  latestPublished: boolean;
  dryRun: boolean;
}

interface ScreenSource {
  id: number;
  app: string;
  platform: Options["platform"];
  versionNumber: number;
  imageUrl: string;
  object: ObjectMetadata;
}

interface ScreenResult {
  imageId: number;
  status: "complete" | "failed";
  pageType?: string;
  productArea?: string;
  error?: string;
}

function usage(): never {
  throw new Error(
    "Usage: node --env-file=.env --import tsx scripts/analyze-screens-with-kiro.ts "
    + "(--app <name> --version <number> | --latest-published) --platform <ios|android|web> "
    + "[--concurrency 3] [--limit 5000] [--output <path>] [--allow-empty] [--force] [--dry-run]",
  );
}

function positive(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be positive`);
  }
  return parsed;
}

export function options(args: string[]): Options {
  const values = new Map<string, string>();
  let allowEmpty = false;
  let force = false;
  let latestPublished = false;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--allow-empty") {
      allowEmpty = true;
      continue;
    }
    if (argument === "--force") {
      force = true;
      continue;
    }
    if (argument === "--latest-published") {
      latestPublished = true;
      continue;
    }
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (!argument.startsWith("--") || !args[index + 1]) usage();
    values.set(argument, args[index + 1]);
    index += 1;
  }
  const app = values.get("--app")?.trim();
  const platform = values.get("--platform");
  if (!["ios", "android", "web"].includes(platform ?? "")) usage();
  const versionNumber = values.has("--version") ? positive(values.get("--version"), "version") : undefined;
  if (latestPublished ? (app || versionNumber) : (!app || !versionNumber)) usage();
  if (latestPublished && force) {
    throw new Error("--force requires an exact --app and --version scope");
  }
  const limit = positive(values.get("--limit") ?? "5000", "limit");
  const concurrency = positive(values.get("--concurrency") ?? "3", "concurrency");
  if (limit > 20_000) throw new Error("limit cannot exceed 20000");
  if (concurrency > 8) throw new Error("concurrency cannot exceed 8");
  return {
    app,
    platform: platform as Options["platform"],
    versionNumber,
    limit,
    concurrency,
    output: values.has("--output")
      ? resolve(values.get("--output")!)
      : latestPublished
        ? undefined
        : resolve(`data/screen-analysis/${app}-${platform}-v${versionNumber}-kiro.json`),
    allowEmpty,
    force,
    latestPublished,
    dryRun,
  };
}

async function listSources(selected: Options): Promise<ScreenSource[]> {
  interface SourceRow {
    id: number;
    app: string;
    platform: Options["platform"];
    version_number: number;
    image_url: string;
    object_key: string;
    sha256: string;
    byte_size: string | number;
    content_type: ObjectMetadata["contentType"];
    access_class: ObjectMetadata["accessClass"];
  }

  interface VersionRow {
    id: number;
    app: string;
    platform: Options["platform"];
    version_number: number;
  }

  const versions = selected.latestPublished
    ? await query<VersionRow>(
      `SELECT DISTINCT ON (av.app_id)
         av.id, selected_app.name AS app, av.platform, av.version_number
       FROM app_versions av
       JOIN apps selected_app ON selected_app.id = av.app_id
       WHERE av.platform = $1
         AND av.status = 'published'
       ORDER BY av.app_id, av.version_number DESC`,
      [selected.platform],
    )
    : await query<VersionRow>(
      `SELECT av.id, selected_app.name AS app, av.platform, av.version_number
       FROM app_versions av
       JOIN apps selected_app ON selected_app.id = av.app_id
       WHERE selected_app.name = $1
         AND av.platform = $2
         AND av.version_number = $3
       LIMIT 1`,
      [selected.app, selected.platform, selected.versionNumber],
    );

  const orderedVersions = versions.rows.sort((left, right) =>
    left.app.localeCompare(right.app, undefined, { sensitivity: "base" })
      || left.version_number - right.version_number
  );
  let rows: SourceRow[] = [];
  for (const version of orderedVersions) {
    const result = await query<SourceRow>(
      `SELECT i.id, $2::text AS app, $3::text AS platform,
         $4::integer AS version_number, i.image_url,
         so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
       FROM version_images vi
       JOIN images i ON i.id = vi.image_id
       JOIN stored_objects so ON so.object_key = i.object_key
       WHERE vi.version_id = $1
         AND i.kind = 'screen'
         AND ($5::boolean OR i.analysis IS NULL)
       ORDER BY i.id
       LIMIT $6`,
      [
        version.id,
        version.app,
        version.platform,
        version.version_number,
        selected.force,
        selected.limit,
      ],
    );
    if (result.rows.length > 0) {
      rows = result.rows;
      break;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    app: row.app,
    platform: row.platform,
    versionNumber: row.version_number,
    imageUrl: row.image_url,
    object: {
      key: row.object_key,
      sha256: row.sha256,
      byteSize: Number(row.byte_size),
      contentType: row.content_type,
      accessClass: row.access_class,
    },
  }));
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

function safeFilenamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

async function verifiedSource(source: ScreenSource, store: ObjectStore): Promise<Buffer> {
  const object = await store.get(source.object.key);
  const digest = createHash("sha256").update(object.body).digest("hex");
  if (
    !sameMetadata(source.object, object.metadata)
    || object.body.byteLength !== source.object.byteSize
    || digest !== source.object.sha256
  ) {
    throw new Error("source_object_mismatch");
  }
  return object.body;
}

export async function run(): Promise<void> {
  const selected = options(process.argv.slice(2));
  const sources = await listSources(selected);
  if (selected.dryRun) {
    console.log(JSON.stringify({
      mode: selected.latestPublished ? "latest-published" : "app-version",
      app: selected.app ?? null,
      platform: selected.platform,
      versionNumber: selected.versionNumber ?? null,
      force: selected.force,
      selected: sources.length,
      limit: selected.limit,
      sample: sources.slice(0, 20).map(({ id, app, platform, versionNumber }) => ({
        imageId: id,
        app,
        platform,
        versionNumber,
      })),
    }, null, 2));
    return;
  }
  if (sources.length === 0) {
    if (selected.allowEmpty) {
      console.log("No matching unanalyzed screen images remain");
      return;
    }
    throw new Error("No matching unanalyzed screen images were found");
  }

  const target = sources[0];
  const lastSource = sources[sources.length - 1];
  const reportOutput = selected.output ?? resolve(
    `data/screen-analysis/latest-published-${target.platform}-${safeFilenamePart(target.app)}`
    + `-v${target.versionNumber}-${target.id}-${lastSource.id}-kiro.json`,
  );

  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const analyzer = createKiroCliScreenAnalyzer(process.env);
  const abortController = new AbortController();
  const results = new Array<ScreenResult>(sources.length);
  let nextIndex = 0;
  let terminationSignal: NodeJS.Signals | undefined;
  const terminate = (signal: NodeJS.Signals): void => {
    if (terminationSignal) return;
    terminationSignal = signal;
    console.warn(`Received ${signal}; aborting active Kiro screen-analysis workers`);
    abortController.abort();
  };
  const onSigterm = (): void => terminate("SIGTERM");
  const onSigint = (): void => terminate("SIGINT");
  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);

  console.log(
    `Analyzing ${sources.length} ${target.app} ${target.platform} v${target.versionNumber} `
    + `screen(s) with ${Math.min(selected.concurrency, sources.length)} Kiro worker(s) `
    + `using ${analyzer.model}`,
  );

  const processSource = async (index: number): Promise<void> => {
    const source = sources[index];
    try {
      const analysis = await analyzer.analyze({
        body: await verifiedSource(source, store),
        platform: source.platform,
        signal: abortController.signal,
      });
      await saveScreenAnalysis(source.id, analysis);
      results[index] = {
        imageId: source.id,
        status: "complete",
        pageType: analysis.pageType,
        productArea: analysis.productArea,
      };
      console.log(
        `[${index + 1}/${sources.length}] screen ${source.id}: `
        + `${analysis.pageType} / ${analysis.productArea}`,
      );
    } catch (error) {
      const message = (error as Error).message || "screen_analysis_failed";
      results[index] = { imageId: source.id, status: "failed", error: message };
      console.warn(`[${index + 1}/${sources.length}] screen ${source.id}: ${message}`);
      if (
        message === "Kiro CLI could not be started"
        || message.includes("aborted")
        || message.includes("source_object_mismatch")
      ) {
        abortController.abort();
        throw error;
      }
    }
  };

  const worker = async (): Promise<void> => {
    while (!abortController.signal.aborted) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= sources.length) return;
      await processSource(index);
    }
  };

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(selected.concurrency, sources.length) },
        () => worker(),
      ),
    );
    if (terminationSignal) {
      throw new Error(`Screen analysis interrupted by ${terminationSignal}`);
    }
  } finally {
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
    const report = {
      mode: selected.latestPublished ? "latest-published" : "app-version",
      app: target.app,
      platform: target.platform,
      versionNumber: target.versionNumber,
      providerModel: analyzer.model,
      generatedAt: new Date().toISOString(),
      requested: selected.limit,
      selected: sources.length,
      completed: results.filter((result) => result?.status === "complete").length,
      failed: results.filter((result) => result?.status === "failed").length,
      unfinished: results.filter((result) => result === undefined).length,
      results: results.filter(Boolean),
    };
    await mkdir(dirname(reportOutput), { recursive: true });
    await writeFile(reportOutput, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Wrote ${reportOutput}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } finally {
    await closePool();
  }
}
