import type { AppKnowledgeJobStatus } from "../../../src/appKnowledge.ts";
import type { AppKnowledgeProvider } from "../../../src/appKnowledgeProvider.ts";
import { createChatGptBrowserAppKnowledgeProvider } from "../../../src/appKnowledgeBrowserProvider.ts";
import {
  appKnowledgeProviderConfigFromEnvironment,
  type AppKnowledgeProviderConfig,
} from "../../../src/appKnowledgeProviderConfig.ts";
import { startChatPool, type ChatSession } from "../../../src/llmChat.ts";

interface AppKnowledgeGeneratorDependencies {
  environment?: Record<string, string | undefined>;
  startChatPool(
    provider: string,
    concurrency: number,
  ): Promise<{ sessions: ChatSession[]; closeAll(): Promise<void> }>;
  failProviderUnavailable(runId: string): Promise<void>;
  createService(
    provider: AppKnowledgeProvider,
    concurrency: number,
  ): { generate(runId: string): Promise<AppKnowledgeJobStatus | undefined> };
}

export function createBrowserAppKnowledgeGenerator(
  overrides: Partial<AppKnowledgeGeneratorDependencies> &
    Pick<AppKnowledgeGeneratorDependencies, "createService" | "failProviderUnavailable">,
) {
  const deps: AppKnowledgeGeneratorDependencies = {
    environment: process.env,
    startChatPool,
    ...overrides,
  };

  return async (runId: string): Promise<AppKnowledgeJobStatus | undefined> => {
    let config: AppKnowledgeProviderConfig | undefined;
    try {
      config = appKnowledgeProviderConfigFromEnvironment(deps.environment);
    } catch {
      await deps.failProviderUnavailable(runId);
      return "error";
    }
    if (!config) {
      await deps.failProviderUnavailable(runId);
      return "error";
    }

    let provider: AppKnowledgeProvider;
    let closeProvider: () => Promise<void>;
    try {
      const browserPool = await deps.startChatPool("chatgpt", config.concurrency);
      provider = createChatGptBrowserAppKnowledgeProvider(browserPool.sessions);
      closeProvider = () => browserPool.closeAll();
    } catch {
      await deps.failProviderUnavailable(runId);
      return "error";
    }

    try {
      return await deps.createService(provider, config.concurrency).generate(runId);
    } finally {
      await closeProvider();
    }
  };
}
