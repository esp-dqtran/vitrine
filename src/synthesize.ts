import { appImages, saveDesignSystem, type CrawledImage } from "./db.ts";
import { SYNTHESIS_PROMPT } from "./prompt.ts";
import { startChatSession } from "./llmChat.ts";
import { clearCancel, isCancelRequested, writeProgress, type StageOutcome } from "./progress.ts";
import { parseDesignSystemSnapshot } from "./designSystem.ts";

// ponytail: fixed batch size, not measured against a token limit. Raise it if a model
// starts truncating replies, lower it if the merged doc grows large enough to blow the batch.
const BATCH_SIZE = 15;

export function buildSynthesisPrompt(current: string, batch: CrawledImage[]): string {
  const screens = batch
    .map((image) => `--- image_id=${image.id} source=${image.image_url} ---\n${image.description}`)
    .join("\n\n");
  const context = current
    ? `Here is the existing structured snapshot. Merge the new observations into it without losing valid evidence:\n\n${current}`
    : "Create the first structured snapshot from these observations.";
  return `${SYNTHESIS_PROMPT}\n\n${context}\n\n${screens}`;
}

export async function synthesize(app: string, providerName: string): Promise<StageOutcome> {
  clearCancel();
  const images = (await appImages(app)).filter((image) => image.description);
  if (images.length === 0) {
    console.log(`No captioned images for "${app}" yet — run "npm run caption" first.`);
    return { status: "done" };
  }

  const allowedImageIds = new Set(images.map((image) => image.id));
  let current = "";

  const session = await startChatSession(providerName);
  const batches = Math.ceil(images.length / BATCH_SIZE);
  console.log(`Synthesizing design system for "${app}" from ${images.length} screen(s) in ${batches} batch(es)...`);
  writeProgress({ stage: "synthesize", app, done: 0, total: batches, status: "running" });

  let batchesDone = 0;
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    if (isCancelRequested()) {
      console.log("Cancelled by user (already-merged batches are saved in PostgreSQL).");
      writeProgress({ stage: "synthesize", app, done: batchesDone, total: batches, status: "cancelled", message: "Cancelled by user" });
      await session.close();
      return { status: "cancelled", message: "Cancelled by user" };
    }
    const batch = images.slice(i, i + BATCH_SIZE);
    try {
      const raw = await session.ask(buildSynthesisPrompt(current, batch));
      const snapshot = parseDesignSystemSnapshot(raw, app, allowedImageIds);
      await saveDesignSystem(app, snapshot);
      current = JSON.stringify(snapshot);
      batchesDone++;
      console.log(`Merged batch ${batchesDone}/${batches} -> PostgreSQL`);
      writeProgress({ stage: "synthesize", app, done: batchesDone, total: batches, status: "running" });
    } catch (err) {
      const message = (err as Error).message;
      console.warn(`${message} — stopping (already-merged batches are saved in PostgreSQL)`);
      writeProgress({ stage: "synthesize", app, done: batchesDone, total: batches, status: "error", message });
      await session.close();
      return { status: "error", message };
    }
  }

  writeProgress({ stage: "synthesize", app, done: batchesDone, total: batches, status: "done" });
  await session.close();
  return { status: "done" };
}
