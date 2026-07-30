import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  extractKiroJson,
  reconciliationReviewRecommendation,
  validateKiroReconciliation,
  type PersistedKiroReconciliation,
  type ResearchPacket,
  type VisualArtifact,
} from "./kiro-reconciliation.ts";
import { findKiroSessionResult } from "./kiro-session-store.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function main(): Promise<void> {
  const app = argument("--app") ?? "amazon-shopping";
  const root = resolve(
    argument("--root") ?? join(process.cwd(), "data", "feature-descriptions", app),
  );
  const packetRoot = join(root, "research-context");
  const outputRoot = join(root, "research-reconciliation");
  await mkdir(outputRoot, { recursive: true });
  const packets = (await readdir(packetRoot))
    .filter((file) => file.endsWith(".json") && file !== "index.json")
    .sort();
  const outputs = new Set(
    (await readdir(outputRoot)).filter((file) =>
      file.endsWith(".json")
      && file !== "progress.json"
      && file !== "sol-review-queue.json"
    ),
  );
  const recovered: string[] = [];
  const missing: string[] = [];
  for (const file of packets.filter((candidate) => !outputs.has(candidate))) {
    const packetPath = join(packetRoot, file);
    const packet = JSON.parse(await readFile(packetPath, "utf8")) as ResearchPacket;
    if (packet.documentedContext.claims.length === 0) continue;
    const session = await findKiroSessionResult({
      cwd: process.cwd(),
      marker: file,
    });
    if (!session) {
      missing.push(file);
      continue;
    }
    const visualPath = resolve(packetRoot, packet.visualAnalysis.artifact);
    const visual = JSON.parse(await readFile(visualPath, "utf8")) as VisualArtifact;
    const result = validateKiroReconciliation(
      extractKiroJson(session.finalResponse),
      packet,
      visual,
    );
    const saved: PersistedKiroReconciliation = {
      schemaVersion: 1,
      generatedAt: session.generatedAt,
      provider: "kiro-cli",
      model: session.model,
      effort: "high",
      source: {
        researchPacket: `../research-context/${file}`,
        visualArtifact: packet.visualAnalysis.artifact,
      },
      usage: session.usage,
      reviewRecommendation: reconciliationReviewRecommendation(packet, result),
      recovery: {
        source: "kiro-session-store",
        conversationId: session.conversationId,
      },
      result,
    };
    await atomicJson(join(outputRoot, file), saved);
    recovered.push(file);
  }
  console.log(JSON.stringify({ app, recovered, missing }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
