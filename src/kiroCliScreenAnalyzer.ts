import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import {
  extractKiroCliJson,
  runKiroCli,
  type KiroCliRunner,
} from "./kiroCliFeatureDocumentProvider.ts";
import { buildCaptionPrompt } from "./prompt.ts";
import {
  parseScreenAnalysisValue,
  type ScreenAnalysis,
} from "./screenAnalysis.ts";
import { SCREEN_CATEGORIES } from "./vitrine/screenCategories.ts";

export interface KiroCliScreenConfig {
  binary: string;
  model: string;
  providerModel: string;
  effort: string;
  cwd: string;
  maxOutputBytes: number;
}

export interface KiroCliScreenAnalyzer {
  model: string;
  analyze(input: {
    body: Uint8Array;
    platform: "ios" | "android" | "web";
    signal: AbortSignal;
  }): Promise<ScreenAnalysis>;
}

const MAX_IMAGE_DIMENSION = 2_000;
const MAX_INPUT_PIXELS = 40_000_000;
const SUPPORTED_SCREEN_TYPES = SCREEN_CATEGORIES.flatMap(({ children }) => children);
const supportedScreenTypeKeys = new Set(
  SUPPORTED_SCREEN_TYPES.map((screenType) => screenType.toLocaleLowerCase()),
);

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid Kiro screen-analysis output limit");
  }
  return parsed;
}

export function kiroCliScreenConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): KiroCliScreenConfig {
  const model = environment.KIRO_CLI_SCREEN_MODEL?.trim()
    || environment.KIRO_CLI_UI_ELEMENT_MODEL?.trim()
    || environment.KIRO_CLI_FEATURE_DOCUMENT_MODEL?.trim()
    || "gpt-5.6-terra";
  const effort = environment.KIRO_CLI_SCREEN_EFFORT?.trim()
    || environment.KIRO_CLI_UI_ELEMENT_EFFORT?.trim()
    || environment.KIRO_CLI_FEATURE_DOCUMENT_EFFORT?.trim()
    || "high";
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(model)) {
    throw new Error("Invalid Kiro screen-analysis model");
  }
  if (!/^(low|medium|high|xhigh|max)$/i.test(effort)) {
    throw new Error("Invalid Kiro screen-analysis effort");
  }
  return {
    binary: environment.KIRO_CLI_BIN?.trim() || "kiro-cli",
    model,
    providerModel: `kiro-cli:${model}-screen-analysis`,
    effort: effort.toLowerCase(),
    cwd: resolve(
      environment.KIRO_CLI_SCREEN_CWD?.trim()
      || environment.KIRO_CLI_UI_ELEMENT_CWD?.trim()
      || environment.KIRO_CLI_FEATURE_DOCUMENT_CWD?.trim()
      || process.cwd(),
    ),
    maxOutputBytes: positiveInteger(
      environment.KIRO_CLI_SCREEN_MAX_OUTPUT_BYTES
      || environment.KIRO_CLI_UI_ELEMENT_MAX_OUTPUT_BYTES,
      4_000_000,
    ),
  };
}

function argumentsFor(config: KiroCliScreenConfig, prompt: string): string[] {
  return [
    "chat",
    "--model",
    config.model,
    "--effort",
    config.effort,
    "--no-interactive",
    "--trust-tools=fs_read",
    "--wrap",
    "never",
    prompt,
  ];
}

async function normalizedKiroImage(body: Uint8Array): Promise<Buffer> {
  if (body.byteLength < 1) throw new Error("Kiro screen-analysis image is empty");
  try {
    return await sharp(body, { limitInputPixels: MAX_INPUT_PIXELS })
      .autoOrient()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ palette: false, compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  } catch {
    throw new Error("Kiro screen-analysis image is invalid or exceeds the safe pixel limit");
  }
}

function promptFor(input: {
  imagePath: string;
  platform: string;
  validationError?: string;
}): string {
  return [
    `Read the screenshot at this exact absolute path with the read tool: ${input.imagePath}`,
    "Analyze the image pixels, not the filename or surrounding workspace.",
    buildCaptionPrompt(input.platform),
    "Set pageType to exactly one supported Vitrines screen category from this list. Do not invent or combine labels. Use Misc only when none of the other categories fit:",
    JSON.stringify(SUPPORTED_SCREEN_TYPES),
    input.validationError
      ? `Your previous response failed validation: ${input.validationError}\nReturn corrected raw JSON only.`
      : "",
  ].filter(Boolean).join("\n\n");
}

export function createKiroCliScreenAnalyzer(
  environment: NodeJS.ProcessEnv = process.env,
  runner: KiroCliRunner = runKiroCli,
): KiroCliScreenAnalyzer {
  const config = kiroCliScreenConfigFromEnvironment(environment);
  return {
    model: config.providerModel,
    async analyze(input) {
      const image = await normalizedKiroImage(input.body);
      const directory = await mkdtemp(join(tmpdir(), "astryx-kiro-screen-analysis-"));
      const imagePath = join(directory, "source.png");
      try {
        await writeFile(imagePath, image, { mode: 0o600 });
        await access(imagePath);
        let validationError = "";
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const output = await runner({
            binary: config.binary,
            args: argumentsFor(config, promptFor({
              imagePath,
              platform: input.platform,
              ...(validationError ? { validationError } : {}),
            })),
            cwd: config.cwd,
            signal: input.signal,
            maxOutputBytes: config.maxOutputBytes,
          });
          try {
            const parsed = extractKiroCliJson(output, (candidate) =>
              typeof candidate.description === "string"
              && typeof candidate.purpose === "string"
              && typeof candidate.pageType === "string"
              && typeof candidate.productArea === "string"
            );
            const analysis = parseScreenAnalysisValue(parsed);
            if (!supportedScreenTypeKeys.has(analysis.pageType.toLocaleLowerCase())) {
              throw new Error(`Unsupported Vitrines screen category: ${analysis.pageType}`);
            }
            return analysis;
          } catch (error) {
            validationError = (error as Error).message;
            if (attempt === 1) throw error;
          }
        }
        throw new Error("Kiro screen-analysis output is invalid");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
