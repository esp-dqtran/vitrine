import { readFile } from "node:fs/promises";
import { researchApp } from "./appResearch.ts";
import { parseCrawlPlan } from "./crawlPlan.ts";
import { listPlans, saveDraftPlan } from "./crawlStore.ts";
import { startChatSession, type ChatSession } from "./llmChat.ts";
import type { ResearchProvider } from "./queue.ts";

export interface ResearchAppJobInput {
  name: string;
  homepageUrl: string;
  provider?: ResearchProvider;
}

interface ResearchAppJobDependencies {
  dataDir: string;
  startChatSession(provider: string): Promise<ChatSession>;
  researchApp: typeof researchApp;
  listPlans(app: string): Promise<Array<{ revision: number }>>;
  saveDraftPlan(
    value: unknown,
    userId?: number,
    researchMetadata?: Record<string, unknown>,
  ): Promise<unknown>;
}

const defaults: ResearchAppJobDependencies = {
  dataDir: process.env.DATA_DIR ?? "data",
  startChatSession,
  researchApp,
  listPlans,
  saveDraftPlan,
};

export function createResearchAppJob(overrides: Partial<ResearchAppJobDependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  return async function runResearchAppJob(input: ResearchAppJobInput): Promise<void> {
    const provider = input.provider ?? "chatgpt";
    const session = await dependencies.startChatSession(provider);
    try {
      const path = await dependencies.researchApp(
        input.name,
        input.homepageUrl,
        session.ask,
        dependencies.dataDir,
      );
      const plan = parseCrawlPlan(await readFile(path, "utf8"));
      if (plan.reviewed || plan.app !== input.name || plan.startUrl !== input.homepageUrl) {
        throw new Error("Generated crawl plan does not match the research job");
      }
      const priorPlans = await dependencies.listPlans(input.name);
      const revision = Math.max(0, ...priorPlans.map((prior) => prior.revision)) + 1;
      await dependencies.saveDraftPlan({ ...plan, revision }, undefined, {
        source: "research-app",
        provider,
        homepageUrl: input.homepageUrl,
      });
    } finally {
      await session.close();
    }
  };
}

export const researchAppJob = createResearchAppJob();
