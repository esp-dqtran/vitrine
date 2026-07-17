import { appImages, saveDesignSystem, type CrawledImage } from "./db.ts";
import { buildSynthesisPrompt, buildMergePrompt } from "./prompt.ts";
import { startChatPool } from "./llmChat.ts";
import { runPool } from "./pool.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { parseDesignSystemSnapshot, type DesignSystemSnapshot } from "./designSystem.ts";

// ponytail: fixed batch size, not measured against a token limit. Raise it if a model
// starts truncating replies, lower it if a single batch's snapshot grows large enough to blow it.
const BATCH_SIZE = 15;

// Kept below the crawler's concurrency since a chat provider is more likely to notice/throttle
// several simultaneous conversations than Mobbin is to notice several page loads — same
// precedent as caption.ts's CONCURRENCY.
const CONCURRENCY = 3;

export function buildBatchPrompt(platform: string, current: string, batch: CrawledImage[]): string {
  const screens = batch
    .map((image) => `--- image_id=${image.id} source=${image.image_url} ---\n${image.description}`)
    .join("\n\n");
  const context = current
    ? `Here is the existing structured snapshot. Merge the new observations into it without losing valid evidence:\n\n${current}`
    : "Create the first structured snapshot from these observations.";
  return `${buildSynthesisPrompt(platform)}\n\n${context}\n\n${screens}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Pairs items up for one round of a merge tree; an odd one out passes through alone.
export function pairUp<T>(items: T[]): Array<[T, T | undefined]> {
  const pairs: Array<[T, T | undefined]> = [];
  for (let i = 0; i < items.length; i += 2) pairs.push([items[i], items[i + 1]]);
  return pairs;
}

export async function synthesize(app: string, platform: string, providerName: string): Promise<StageOutcome> {
  clearCancel();
  const images = (await appImages(app, "screen", platform)).filter((image) => image.description);
  if (images.length === 0) {
    console.log(`No captioned "${platform}" images for "${app}" yet — run "npm run caption" first.`);
    return { status: "done" };
  }

  const allowedImageIds = new Set(images.map((image) => image.id));
  const batches = chunk(images, BATCH_SIZE);
  const { sessions, closeAll } = await startChatPool(providerName, CONCURRENCY);
  console.log(`Synthesizing design system for "${app}" from ${images.length} screen(s) in ${batches.length} batch(es) (${sessions.length} at a time)...`);
  writeProgress({ stage: "synthesize", app, done: 0, total: batches.length, status: "running", message: "extracting" });

  let loggedOut = false;
  let failureMessage: string | undefined;

  // Map phase: extract each batch independently (no shared "current" snapshot threaded
  // between batches) so batches can run concurrently — replaces the old sequential,
  // merge-as-you-go loop that made every batch wait on the previous one's reply.
  const partials: Array<DesignSystemSnapshot | undefined> = new Array(batches.length);
  let extracted = 0;
  await runPool(
    batches.map((batch, index) => ({ batch, index })),
    sessions,
    async (session, { batch, index }) => {
      try {
        const raw = await session.ask(buildBatchPrompt(platform, "", batch));
        partials[index] = parseDesignSystemSnapshot(raw, app, allowedImageIds);
      } catch (err) {
        const message = (err as Error).message;
        console.warn(`${message} — skipping batch ${index + 1}/${batches.length}`);
        failureMessage ??= message;
        if (message.startsWith("Logged out of")) loggedOut = true;
      }
      extracted++;
      writeProgress({ stage: "synthesize", app, done: extracted, total: batches.length, status: "running", message: "extracting" });
    },
    () => isCancelRequested() || loggedOut,
  );

  let survivors = partials.filter((snapshot): snapshot is DesignSystemSnapshot => snapshot !== undefined);

  // Reduce phase: bounded pairwise tree merge. Every merge call sees at most two
  // already-small structured snapshots, so the prompt size never grows with total
  // screen/batch count the way the old linear accumulation did.
  let round = 0;
  while (survivors.length > 1 && !isCancelRequested() && !loggedOut) {
    round++;
    const pairs = pairUp(survivors);
    const merged: DesignSystemSnapshot[] = new Array(pairs.length);
    let mergedCount = 0;
    writeProgress({ stage: "synthesize", app, done: 0, total: pairs.length, status: "running", message: `merging round ${round} (${survivors.length} -> ${pairs.length})` });
    await runPool(
      pairs.map((pair, index) => ({ pair, index })),
      sessions,
      async (session, { pair, index }) => {
        const [a, b] = pair;
        if (!b) {
          merged[index] = a;
        } else {
          try {
            const raw = await session.ask(buildMergePrompt(platform, a, b));
            merged[index] = parseDesignSystemSnapshot(raw, app, allowedImageIds);
          } catch (err) {
            merged[index] = a; // keep one side rather than aborting the whole run
            const message = (err as Error).message;
            console.warn(`${message} — merge failed, keeping one side`);
            failureMessage ??= message;
            if (message.startsWith("Logged out of")) loggedOut = true;
          }
        }
        mergedCount++;
        writeProgress({ stage: "synthesize", app, done: mergedCount, total: pairs.length, status: "running", message: `merging round ${round}` });
      },
      () => isCancelRequested() || loggedOut,
    );
    survivors = merged;
  }

  await closeAll();

  const outcome: StageOutcome = isCancelRequested()
    ? { status: "cancelled", message: "Cancelled by user" }
    : loggedOut || survivors.length !== 1
      ? { status: "error", message: failureMessage ?? (loggedOut ? `Logged out of ${providerName}` : "No batch survived extraction") }
      : { status: "done" };

  if (outcome.status === "done") {
    await saveDesignSystem(app, platform, survivors[0]);
  }

  writeProgress({ stage: "synthesize", app, done: batches.length, total: batches.length, status: outcome.status, message: outcome.message });
  return outcome;
}
