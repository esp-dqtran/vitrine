import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { uncaptionedImages, saveScreenAnalysis } from "./db.ts";
import { buildCaptionPrompt } from "./prompt.ts";
import { startChatPool, type ChatAttachment, type ChatSession } from "./llmChat.ts";
import { runPool } from "./pool.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { bulkImageHash, findBulkImage } from "./imageSource.ts";
import type { ObjectMetadata, ObjectStore } from "./objectStore.ts";
import { parseScreenAnalysis, type ScreenAnalysis } from "./screenAnalysis.ts";

export const parseCaptionReply = parseScreenAnalysis;

export type CaptionImage = { id: number; app: string; platform: string; image_url: string };

const CAPTION_IMAGE_EXTENSIONS = new Set(["png", "jpg", "webp"]);

export interface CaptionDependencies {
  objectStore?: ObjectStore;
  resolveObjectMetadata?: (image: CaptionImage) => Promise<ObjectMetadata | undefined>;
}

async function withTemporaryFile<T>(
  body: Uint8Array,
  extension: string,
  fn: (filePath: string) => Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(`${tmpdir()}/astryx-caption-`);
  try {
    chmodSync(dir, 0o700);
    const filePath = `${dir}/image.${extension}`;
    writeFileSync(filePath, body, { flag: "wx", mode: 0o600 });
    return await fn(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verifiedObjectBody(
  expected: ObjectMetadata,
  object: Awaited<ReturnType<ObjectStore["get"]>>,
): Buffer {
  const actual = object.metadata;
  if (
    actual.key !== expected.key
    || actual.sha256 !== expected.sha256
    || actual.byteSize !== expected.byteSize
    || actual.contentType !== expected.contentType
    || actual.accessClass !== expected.accessClass
    || object.body.byteLength !== expected.byteSize
    || createHash("sha256").update(object.body).digest("hex") !== expected.sha256
  ) throw new Error(`Object bytes do not match metadata for ${expected.key}`);
  return object.body;
}

// The chat providers attach images via a file input, so remote bytes have to hit the disk briefly.
export async function withDownloaded<T>(
  image: CaptionImage,
  fn: (filePath: string) => Promise<T>,
  dependencies: CaptionDependencies = {},
): Promise<T> {
  const metadata = await dependencies.resolveObjectMetadata?.(image);
  if (metadata) {
    if (!dependencies.objectStore) throw new Error("Object store is required for object-backed captions");
    const body = verifiedObjectBody(metadata, await dependencies.objectStore.get(metadata.key));
    const extension = metadata.contentType === "image/jpeg" ? "jpg" : metadata.contentType.split("/")[1];
    if (!CAPTION_IMAGE_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported caption object content type: ${metadata.contentType}`);
    }
    return withTemporaryFile(body, extension, fn);
  }

  const hash = bulkImageHash(image.image_url);
  if (hash) {
    const localPath = findBulkImage(process.env.DATA_DIR ?? "data", image.app, hash);
    if (!localPath) throw new Error(`Missing local image for ${image.image_url}`);
    return fn(localPath);
  }
  const res = await fetch(image.image_url);
  if (!res.ok) throw new Error(`Could not fetch ${image.image_url}: HTTP ${res.status}`);
  const ext = (res.headers.get("content-type") ?? "image/webp").split("/")[1].split(";")[0];
  return withTemporaryFile(Buffer.from(await res.arrayBuffer()), ext, fn);
}

// Vision replies sometimes embed an unescaped quote from on-screen copy (e.g. a headline)
// and break the JSON — same re-ask-once-with-the-error pattern as appResearch.ts's draftPlan,
// since a fresh `ask()` call has no history to lean on, so the full prompt is resent either way.
export async function captionWithRetry(
  session: ChatSession,
  platform: string,
  filePath: string | ChatAttachment,
): Promise<ScreenAnalysis> {
  const prompt = buildCaptionPrompt(platform);
  let reply = await session.ask(prompt, filePath);
  for (let attempt = 0; ; attempt++) {
    try {
      return parseCaptionReply(reply);
    } catch (error) {
      if (attempt >= 1) throw error;
      reply = await session.ask(
        `${prompt}\n\nYour previous reply failed validation with: ${(error as Error).message}\nReply again with corrected raw JSON only.`,
        filePath,
      );
    }
  }
}

// ponytail: fixed pool size, not measured against the provider's actual rate limits —
// lower it if messages start failing/getting flagged, raise it if it stays clean. Kept
// below the crawler's concurrency since a chat provider is more likely to notice/throttle
// several simultaneous conversations than Mobbin is to notice several page loads.
const CONCURRENCY = 3;

export async function caption(
  providerName: string,
  limit?: number,
  app?: string,
  dependencies: CaptionDependencies = {},
): Promise<StageOutcome> {
  clearCancel();
  const images = (await uncaptionedImages(app)).slice(0, limit);
  if (images.length === 0) {
    console.log("Nothing to caption — every selected image already has a description.");
    return { status: "done" };
  }

  const { sessions, closeAll } = await startChatPool(providerName, CONCURRENCY);
  console.log(`Captioning ${images.length} image(s) via ${providerName} (${sessions.length} at a time)...`);
  writeProgress({ stage: "caption", app: images[0].app, done: 0, total: images.length, status: "running" });

  let done = 0;
  let loggedOut = false;
  let failureMessage: string | undefined;
  await runPool(
    images,
    sessions,
    async (session, image) => {
      try {
        const analysis = await withDownloaded(
          image,
          (filePath) => captionWithRetry(session, image.platform, filePath),
          dependencies,
        );
        await saveScreenAnalysis(image.id, analysis);
        done++;
        console.log(`Captioned ${image.image_url} (${done}/${images.length})`);
      } catch (err) {
        const message = (err as Error).message;
        console.warn(`${message} — skipping ${image.image_url}`);
        failureMessage ??= message;
        if (message.startsWith("Logged out of")) loggedOut = true;
      }
      writeProgress({ stage: "caption", app: image.app, done, total: images.length, status: "running" });
    },
    () => isCancelRequested() || loggedOut
  );

  const outcome: StageOutcome = isCancelRequested()
    ? { status: "cancelled", message: "Cancelled by user" }
    : loggedOut || failureMessage
      ? { status: "error", message: failureMessage ?? `Logged out of ${providerName}` }
      : { status: "done" };
  writeProgress({
    stage: "caption",
    app: images[images.length - 1].app,
    done,
    total: images.length,
    status: outcome.status,
    message: outcome.message,
  });
  await closeAll();
  return outcome;
}
