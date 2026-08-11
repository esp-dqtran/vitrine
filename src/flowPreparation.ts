import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResearchPage } from "./appResearch.ts";
import type { CrawlFlow, CrawlPlan } from "./crawlPlan.ts";

export interface PreparedFlowDirectory {
  id: string;
  directory: string;
  definitionPath: string;
  screensPath: string;
  evidencePath: string;
}

export interface FlowPreparationWorkspace {
  root: string;
  manifestPath: string;
  sourcesPath: string;
  flows: PreparedFlowDirectory[];
}

function directorySegment(value: string, label: string): string {
  const segment = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  if (!segment) throw new Error(`${label} cannot be represented as a directory name`);
  return segment;
}

function flowDirectories(flows: CrawlFlow[]): Array<{ flow: CrawlFlow; directory: string }> {
  const used = new Set<string>();
  return flows.map((flow, index) => {
    const base = directorySegment(flow.id, `Flow ${index + 1} id`);
    let directory = base;
    for (let suffix = 2; used.has(directory); suffix++) directory = `${base}-${suffix}`;
    used.add(directory);
    return { flow, directory };
  });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function flowPreparationRoot(app: string, dataDir = "data"): string {
  return join(dataDir, "flow-preparation", directorySegment(app, "App id"));
}

export function prepareFlowWorkspace(
  plan: CrawlPlan,
  pages: ResearchPage[],
  dataDir = "data",
  now: () => Date = () => new Date(),
): FlowPreparationWorkspace {
  const root = flowPreparationRoot(plan.app, dataDir);
  const researchRoot = join(root, "research");
  const flowsRoot = join(root, "flows");
  mkdirSync(researchRoot, { recursive: true });
  mkdirSync(flowsRoot, { recursive: true });

  const preparedFlows = flowDirectories(plan.flows).map(({ flow, directory }) => {
    const flowRoot = join(flowsRoot, directory);
    const definitionPath = join(flowRoot, "flow.json");
    const screensPath = join(flowRoot, "screens");
    const evidencePath = join(flowRoot, "evidence");
    mkdirSync(screensPath, { recursive: true });
    mkdirSync(evidencePath, { recursive: true });
    writeJson(definitionPath, flow);
    return { id: flow.id, directory, definitionPath, screensPath, evidencePath };
  });

  const preparedAt = now().toISOString();
  const sourcesPath = join(researchRoot, "sources.json");
  writeJson(sourcesPath, {
    schemaVersion: 1,
    app: plan.app,
    homepageUrl: plan.startUrl,
    preparedAt,
    sources: pages.map((page) => ({
      url: page.url,
      characterCount: page.text.length,
      selectedForPlan: plan.sources.includes(page.url),
    })),
  });

  const manifestPath = join(root, "manifest.json");
  writeJson(manifestPath, {
    schemaVersion: 1,
    app: plan.app,
    homepageUrl: plan.startUrl,
    status: "prepared",
    reviewed: false,
    preparedAt,
    sourceCount: pages.length,
    flows: preparedFlows.map(({ id, directory }) => ({
      id,
      directory: `flows/${directory}`,
      definition: `flows/${directory}/flow.json`,
      screens: `flows/${directory}/screens`,
      evidence: `flows/${directory}/evidence`,
    })),
  });

  return { root, manifestPath, sourcesPath, flows: preparedFlows };
}
