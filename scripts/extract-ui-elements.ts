import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  CHATGPT_BROWSER_MODEL,
  parseBrowserJsonObject,
} from "../src/appKnowledgeBrowserProvider.ts";
import { createKiroCliUiElementAnalyzer } from "../src/kiroCliUiElementAnalyzer.ts";
import { deriveUiElementCrop } from "../src/uiElementCrop.ts";
import {
  ChatRateLimitError,
  startChatSession,
  type ChatAttachment,
  type ChatSession,
} from "../src/llmChat.ts";
import {
  UI_ELEMENT_AUTO_ACCEPT_CONFIDENCE,
  UI_ELEMENT_PROMPT_VERSION,
  buildUiElementExtractionPrompt,
  parseUiElementScreenExtraction,
  type ScreenPatternOption,
  type UiElementScreenExtraction,
} from "../src/uiElementExtraction.ts";
import {
  completeUiElementExtraction,
  failUiElementExtraction,
  listScreenPatternOptions,
  listUiElementExtractionSources,
  startUiElementExtraction,
  type PersistedUiElementCrop,
  type UiElementExtractionSource,
} from "../src/uiElementExtractionStore.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../src/objectStoreConfig.ts";
import type { ObjectMetadata, ObjectStore } from "../src/objectStore.ts";
import { closePool } from "../src/db.ts";
import {
  isInfrastructureFailure,
  isRateLimitFailure,
  runWithRateLimitCooldown,
} from "./flow-analysis/concurrent-runner.ts";

interface Options {
  app: string;
  platform: "ios" | "android" | "web";
  versionNumber: number;
  limit: number;
  output: string;
  reprocess: boolean;
  provider: "chatgpt" | "kiro";
  concurrency: number;
  allowEmpty: boolean;
  cropUiElements: boolean;
  sourceImageId?: number;
}

interface PilotResult {
  sourceImageId: number;
  screenImageId: number;
  status: "complete" | "failed";
  summary?: string;
  screenPatterns?: string[];
  components?: Array<{
    occurrenceId: number;
    type: string;
    layer: "whole-screen" | "outer-presentation" | "embedded-ui";
    croppedImageId: number;
    confidence: number;
    reviewStatus: "pending" | "accepted";
    objectKey: string;
  }>;
  error?: string;
}

function usage(): never {
  throw new Error(
    "Usage: npm run ui-elements:extract -- "
    + "--app <name> --platform <ios|android|web> --version <number> "
    + "[--provider kiro|chatgpt] [--concurrency 1] [--limit 10] "
    + "[--source-image-id <id>] [--output <path>] [--reprocess] [--allow-empty] "
    + "[--crop-ui-elements]",
  );
}

function positive(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be positive`);
  return parsed;
}

function options(args: string[]): Options {
  const values = new Map<string, string>();
  let reprocess = false;
  let allowEmpty = false;
  let cropUiElements = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--reprocess") {
      reprocess = true;
      continue;
    }
    if (argument === "--allow-empty") {
      allowEmpty = true;
      continue;
    }
    if (argument === "--crop-ui-elements") {
      cropUiElements = true;
      continue;
    }
    if (!argument.startsWith("--") || !args[index + 1]) usage();
    values.set(argument, args[index + 1]);
    index += 1;
  }
  const app = values.get("--app")?.trim();
  const platform = values.get("--platform");
  if (!app || !["ios", "android", "web"].includes(platform ?? "")) usage();
  const limit = positive(values.get("--limit") ?? "10", "limit");
  if (limit > 5_000) throw new Error("limit cannot exceed 5000");
  const versionNumber = positive(values.get("--version"), "version");
  const provider = values.get("--provider") ?? "kiro";
  if (provider !== "kiro" && provider !== "chatgpt") usage();
  const concurrency = positive(values.get("--concurrency") ?? "1", "concurrency");
  if (concurrency > 8) throw new Error("concurrency cannot exceed 8");
  if (provider === "chatgpt" && concurrency !== 1) {
    throw new Error("ChatGPT browser extraction supports concurrency 1 only");
  }
  return {
    app,
    platform: platform as Options["platform"],
    versionNumber,
    limit,
    output: resolve(
      values.get("--output")
        ?? `data/ui-element-extraction/${app}-${platform}-v${versionNumber}-pilot.json`,
    ),
    reprocess,
    provider,
    concurrency,
    allowEmpty,
    cropUiElements,
    ...(values.has("--source-image-id")
      ? { sourceImageId: positive(values.get("--source-image-id"), "source image id") }
      : {}),
  };
}

function sameMetadata(left: ObjectMetadata, right: ObjectMetadata): boolean {
  return left.key === right.key
    && left.sha256 === right.sha256
    && left.byteSize === right.byteSize
    && left.contentType === right.contentType
    && left.accessClass === right.accessClass;
}

async function verifiedSource(
  source: UiElementExtractionSource,
  store: ObjectStore,
): Promise<Buffer> {
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

function attachment(source: UiElementExtractionSource, body: Buffer): ChatAttachment {
  const extension = source.object.contentType === "image/jpeg"
    ? "jpg"
    : source.object.contentType.split("/")[1];
  return {
    name: `screen-source-${source.sourceImageId}.${extension}`,
    mimeType: source.object.contentType as ChatAttachment["mimeType"],
    buffer: body,
  };
}

async function analyze(
  session: ChatSession,
  source: UiElementExtractionSource,
  body: Buffer,
  screenPatterns: readonly ScreenPatternOption[],
): Promise<UiElementScreenExtraction> {
  const prompt = buildUiElementExtractionPrompt(source.platform, screenPatterns);
  let validationError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await session.ask(
      validationError
        ? `${prompt}\n\nYour previous response failed validation: ${validationError}\nReturn corrected JSON only.`
        : prompt,
      attachment(source, body),
    );
    try {
      return parseUiElementScreenExtraction(
        parseBrowserJsonObject(reply),
        screenPatterns,
      );
    } catch (error) {
      validationError = (error as Error).message;
      if (attempt === 1) throw error;
    }
  }
  throw new Error("output_invalid");
}

async function prepareCrops(
  source: UiElementExtractionSource,
  body: Buffer,
  analysis: UiElementScreenExtraction,
  store: ObjectStore,
): Promise<PersistedUiElementCrop[]> {
  const crops: PersistedUiElementCrop[] = [];
  for (const candidate of analysis.components) {
    try {
      const crop = await deriveUiElementCrop({
        source: body,
        candidate,
        platform: source.platform,
      });
      const object: ObjectMetadata = {
        key: `ui-elements/crops/${crop.sha256}.png`,
        sha256: crop.sha256,
        byteSize: crop.byteSize,
        contentType: crop.contentType,
        accessClass: "protected",
      };
      const stored = await store.put({ ...object, body: crop.body });
      if (!sameMetadata(object, stored.metadata)) {
        throw new Error("crop_object_write_mismatch");
      }
      crops.push({ candidate, object, quality: crop.quality });
    } catch (error) {
      console.warn(
        `[${source.sourceImageId}] skipped ${candidate.type}: ${(error as Error).message}`,
      );
    }
  }
  return crops;
}

async function run(): Promise<void> {
  const selected = options(process.argv.slice(2));
  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const kiroAnalyzer = selected.provider === "kiro"
    ? createKiroCliUiElementAnalyzer(process.env)
    : undefined;
  const providerModel = kiroAnalyzer?.model ?? `${CHATGPT_BROWSER_MODEL}-ui-elements`;
  const screenPatterns = await listScreenPatternOptions();
  if (screenPatterns.length === 0) {
    throw new Error("No screen-pattern taxonomy is configured");
  }
  const sources = await listUiElementExtractionSources({
    app: selected.app,
    platform: selected.platform,
    versionNumber: selected.versionNumber,
    limit: selected.limit,
    providerModel,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    reprocess: selected.reprocess,
    sourceImageId: selected.sourceImageId,
  });
  if (sources.length === 0) {
    if (selected.allowEmpty) {
      console.log("No matching unanalyzed UI-element source images remain");
      return;
    }
    throw new Error("No matching unanalyzed UI-element source images were found");
  }

  console.log(
    `Analyzing ${sources.length} ${selected.app} ${selected.platform} UI-element source image(s) `
    + `with ${Math.min(selected.concurrency, sources.length)} worker(s)`,
  );
  const session = selected.provider === "chatgpt"
    ? await startChatSession("chatgpt")
    : undefined;
  const results = new Array<PilotResult>(sources.length);
  const abortController = new AbortController();
  let terminationSignal: NodeJS.Signals | undefined;
  let nextSourceIndex = 0;
  const terminate = (signal: NodeJS.Signals): void => {
    if (terminationSignal) return;
    terminationSignal = signal;
    console.warn(`Received ${signal}; aborting active extraction workers`);
    abortController.abort();
  };
  const terminateOnSigterm = (): void => terminate("SIGTERM");
  const terminateOnSigint = (): void => terminate("SIGINT");
  process.once("SIGTERM", terminateOnSigterm);
  process.once("SIGINT", terminateOnSigint);

  const processSource = async (index: number): Promise<void> => {
    const source = sources[index];
    await startUiElementExtraction(source, providerModel, UI_ELEMENT_PROMPT_VERSION);
    try {
      const body = await verifiedSource(source, store);
      const analysis = kiroAnalyzer
        ? await kiroAnalyzer.analyze({
          body,
          platform: source.platform,
          screenPatterns,
          signal: abortController.signal,
        })
        : await runWithRateLimitCooldown({
          isRateLimit: (error) =>
            error instanceof ChatRateLimitError || isRateLimitFailure(error),
          sleep,
          onCooldown: async (cooldown) => {
            console.warn(
              `[${source.sourceImageId}] rate limited; pausing until ${cooldown.until} `
              + `(${Math.round(cooldown.delayMs / 60_000)} minutes)`,
            );
          },
          onResume: async () => {
            console.log(`[${source.sourceImageId}] cooldown complete; retrying`);
          },
          run: async (resetCooldown) => {
            const result = await analyze(session!, source, body, screenPatterns);
            resetCooldown();
            return result;
          },
        });
      const crops = selected.cropUiElements
        ? await prepareCrops(source, body, analysis, store)
        : [];
      const occurrences = await completeUiElementExtraction({
        source,
        providerModel,
        promptVersion: UI_ELEMENT_PROMPT_VERSION,
        analysis,
        crops,
        autoAcceptConfidence: UI_ELEMENT_AUTO_ACCEPT_CONFIDENCE,
      });
      results[index] = {
        sourceImageId: source.sourceImageId,
        screenImageId: source.screenImageId,
        status: "complete",
        summary: analysis.summary,
        screenPatterns: analysis.screenPatterns.map(({ slug }) => slug),
        components: occurrences.map((occurrence, index) => ({
          occurrenceId: occurrence.id,
          type: occurrence.type,
          layer: occurrence.layer,
          croppedImageId: occurrence.croppedImageId,
          confidence: occurrence.confidence,
          reviewStatus: occurrence.reviewStatus,
          objectKey: crops[index]?.object.key ?? "",
        })),
      };
      console.log(
        `[${index + 1}/${sources.length}] source ${source.sourceImageId}: `
        + `${analysis.components.length} detected component(s), `
        + `${occurrences.length} persisted crop(s), `
        + `${analysis.screenPatterns.map(({ slug }) => slug).join(", ")}`,
      );
    } catch (error) {
      const message = (error as Error).message || "extraction_failed";
      await failUiElementExtraction(
        source,
        providerModel,
        UI_ELEMENT_PROMPT_VERSION,
        message,
      );
      if (isInfrastructureFailure(error)) {
        abortController.abort();
        console.error(
          `[${index + 1}/${sources.length}] source ${source.sourceImageId}: `
          + `${selected.provider} infrastructure failed; stop safely so the run can resume`,
        );
        throw error;
      }
      results[index] = {
        sourceImageId: source.sourceImageId,
        screenImageId: source.screenImageId,
        status: "failed",
        error: message,
      };
      console.warn(`[${index + 1}/${sources.length}] source ${source.sourceImageId}: ${message}`);
    }
  };

  const worker = async (): Promise<void> => {
    while (!abortController.signal.aborted) {
      const index = nextSourceIndex;
      nextSourceIndex += 1;
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
      throw new Error(`Extraction interrupted by ${terminationSignal}`);
    }
  } finally {
    process.removeListener("SIGTERM", terminateOnSigterm);
    process.removeListener("SIGINT", terminateOnSigint);
    await session?.close();
  }

  const report = {
    app: selected.app,
    platform: selected.platform,
    versionNumber: selected.versionNumber,
    providerModel,
    promptVersion: UI_ELEMENT_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    requested: selected.limit,
    processed: results.length,
    completed: results.filter(({ status }) => status === "complete").length,
    failed: results.filter(({ status }) => status === "failed").length,
    componentCount: results.reduce((sum, result) => sum + (result.components?.length ?? 0), 0),
    results,
  };
  await mkdir(dirname(selected.output), { recursive: true });
  await writeFile(selected.output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Wrote ${selected.output}`);
}

try {
  await run();
} finally {
  await closePool();
}
process.exit(0);
