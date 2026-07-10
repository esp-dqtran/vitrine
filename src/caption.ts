import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { uncaptionedImages, saveScreenAnalysis } from "./db.ts";
import { CAPTION_PROMPT } from "./prompt.ts";
import { startChatPool } from "./llmChat.ts";
import { runPool } from "./pool.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { bulkImageHash, findBulkImage } from "./imageSource.ts";
import { parseScreenAnalysis } from "./screenAnalysis.ts";

export const parseCaptionReply = parseScreenAnalysis;

// The chat providers attach images via a file input, so a URL has to hit the disk first.
async function withDownloaded<T>(
  app: string,
  imageUrl: string,
  fn: (filePath: string) => Promise<T>
): Promise<T> {
  const hash = bulkImageHash(imageUrl);
  if (hash) {
    const localPath = findBulkImage(process.env.DATA_DIR ?? "data", app, hash);
    if (!localPath) throw new Error(`Missing local image for ${imageUrl}`);
    return fn(localPath);
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch ${imageUrl}: HTTP ${res.status}`);
  const ext = (res.headers.get("content-type") ?? "image/webp").split("/")[1].split(";")[0];
  const dir = mkdtempSync(`${tmpdir()}/astryx-caption-`);
  const filePath = `${dir}/image.${ext}`;
  writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  try {
    return await fn(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ponytail: fixed pool size, not measured against the provider's actual rate limits —
// lower it if messages start failing/getting flagged, raise it if it stays clean. Kept
// below the crawler's concurrency since a chat provider is more likely to notice/throttle
// several simultaneous conversations than Mobbin is to notice several page loads.
const CONCURRENCY = 3;

export async function caption(providerName: string, limit?: number, app?: string): Promise<StageOutcome> {
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
        const reply = await withDownloaded(image.app, image.image_url, (filePath) =>
          session.ask(CAPTION_PROMPT, filePath)
        );
        await saveScreenAnalysis(image.id, parseCaptionReply(reply));
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
