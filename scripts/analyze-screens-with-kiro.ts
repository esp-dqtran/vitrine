import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  app: string;
  platform: "ios" | "android" | "web";
  versionNumber: number;
  limit: number;
  concurrency: number;
  output: string;
  allowEmpty: boolean;
  force: boolean;
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
    + "--app <name> --platform <ios|android|web> --version <number> "
    + "[--concurrency 3] [--limit 5000] [--output <path>] [--allow-empty] [--force]",
  );
}

function positive(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be positive`);
  }
  return parsed;
}

function options(args: string[]): Options {
  const values = new Map<string, string>();
  let allowEmpty = false;
  let force = false;
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
    if (!argument.startsWith("--") || !args[index + 1]) usage();
    values.set(argument, args[index + 1]);
    index += 1;
  }
  const app = values.get("--app")?.trim();
  const platform = values.get("--platform");
  if (!app || !["ios", "android", "web"].includes(platform ?? "")) usage();
  const versionNumber = positive(values.get("--version"), "version");
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
    output: resolve(
      values.get("--output")
      ?? `data/screen-analysis/${app}-${platform}-v${versionNumber}-kiro.json`,
    ),
    allowEmpty,
    force,
  };
}

async function listSources(selected: Options): Promise<ScreenSource[]> {
  const result = await query<{
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
  }>(
    `SELECT i.id, a.name AS app, av.platform, av.version_number, i.image_url,
       so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
     FROM app_versions av
     JOIN apps a ON a.id = av.app_id
     JOIN version_images vi ON vi.version_id = av.id
     JOIN images i ON i.id = vi.image_id
     JOIN stored_objects so ON so.object_key = i.object_key
     WHERE a.name = $1
       AND av.platform = $2
       AND av.version_number = $3
       AND i.kind = 'screen'
       AND ($4::boolean OR i.analysis IS NULL)
     ORDER BY i.id
     LIMIT $5`,
    [selected.app, selected.platform, selected.versionNumber, selected.force, selected.limit],
  );
  return result.rows.map((row) => ({
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

async function run(): Promise<void> {
  const selected = options(process.argv.slice(2));
  const sources = await listSources(selected);
  if (sources.length === 0) {
    if (selected.allowEmpty) {
      console.log("No matching unanalyzed screen images remain");
      return;
    }
    throw new Error("No matching unanalyzed screen images were found");
  }

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
    `Analyzing ${sources.length} ${selected.app} ${selected.platform} v${selected.versionNumber} `
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
      app: selected.app,
      platform: selected.platform,
      versionNumber: selected.versionNumber,
      providerModel: analyzer.model,
      generatedAt: new Date().toISOString(),
      requested: selected.limit,
      selected: sources.length,
      completed: results.filter((result) => result?.status === "complete").length,
      failed: results.filter((result) => result?.status === "failed").length,
      unfinished: results.filter((result) => result === undefined).length,
      results: results.filter(Boolean),
    };
    await mkdir(dirname(selected.output), { recursive: true });
    await writeFile(selected.output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Wrote ${selected.output}`);
  }
}

try {
  await run();
} finally {
  await closePool();
}
