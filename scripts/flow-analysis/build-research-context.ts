import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  loadAppResearchKnowledge,
  researchContextForFlow,
} from "./research-knowledge.ts";

type Artifact = {
  analysis?: { provider?: string; model?: string };
  source: {
    app: string;
    platform: "ios" | "android" | "web";
    flowId: string;
    title: string;
    category?: string;
    tags?: string[];
  };
  feature: {
    title: string;
    unknowns?: string[];
  };
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const app = argument("--app") ?? process.env.FLOW_APP ?? "amazon-shopping";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("Invalid --app");
  const root = resolve(
    argument("--root") ??
      join(process.cwd(), "data", "feature-descriptions", app),
  );
  const knowledgePath = resolve(
    argument("--knowledge") ??
      join(process.cwd(), "research", "app-knowledge", `${app}.json`),
  );
  const knowledge = await loadAppResearchKnowledge(knowledgePath);
  if (!knowledge) throw new Error(`Research knowledge not found: ${knowledgePath}`);
  if (knowledge.app !== app) {
    throw new Error(`Research knowledge app ${knowledge.app} does not match ${app}`);
  }
  const output = join(root, "research-context");
  await mkdir(output, { recursive: true });
  const files = (await readdir(join(root, "json")))
    .filter((file) => file.endsWith(".json"))
    .sort();
  let matched = 0;
  let documentedClaims = 0;
  for (const file of files) {
    const artifact = JSON.parse(
      await readFile(join(root, "json", file), "utf8"),
    ) as Artifact;
    const context = researchContextForFlow(knowledge, {
      platform: artifact.source.platform,
      title: artifact.source.title,
      category: artifact.source.category,
      tags: artifact.source.tags,
      unknowns: artifact.feature.unknowns,
    });
    if (context) {
      matched += 1;
      documentedClaims += context.claims.length;
    }
    const packet = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: "pending-reconciliation",
      flow: {
        app: artifact.source.app,
        platform: artifact.source.platform,
        flowId: artifact.source.flowId,
        title: artifact.source.title,
      },
      visualAnalysis: {
        artifact: `../json/${file}`,
        provider: artifact.analysis?.provider ?? "unknown",
        model: artifact.analysis?.model ?? "unknown",
        unknowns: artifact.feature.unknowns ?? [],
      },
      documentedContext: context ?? {
        app: knowledge.app,
        knowledgeGeneratedAt: knowledge.generatedAt,
        policy: knowledge.separationPolicy,
        claims: [],
      },
      reconciliationInstructions: [
        "Do not rewrite or relabel screenshot observations.",
        "Classify each documented claim as supports, extends, conflicts, or unrelated.",
        "A documented claim without screenshot evidence remains documented, not observed.",
        "Record region, platform, version, or account-state conflicts as unresolved.",
      ],
    };
    await writeFile(
      join(output, file),
      `${JSON.stringify(packet, null, 2)}\n`,
      "utf8",
    );
  }
  await writeFile(
    join(output, "index.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      app,
      generatedAt: new Date().toISOString(),
      knowledgePath,
      artifacts: files.length,
      artifactsWithContext: matched,
      documentedClaimLinks: documentedClaims,
    }, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify({
    app,
    knowledgePath,
    output,
    artifacts: files.length,
    artifactsWithContext: matched,
    documentedClaimLinks: documentedClaims,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
