import { CHATGPT_BROWSER_MODEL } from "./appKnowledgeBrowserProvider.ts";

export interface ChatGptBrowserAppKnowledgeConfig {
  kind: "chatgpt-browser";
  model: typeof CHATGPT_BROWSER_MODEL;
  concurrency: 1 | 2;
}

export function appKnowledgeProviderConfigFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): ChatGptBrowserAppKnowledgeConfig | undefined {
  const provider = env.APP_KNOWLEDGE_PROVIDER?.trim();
  if (!provider) return undefined;
  if (provider !== "chatgpt-browser") {
    throw new Error(`Unsupported App Knowledge provider "${provider}"`);
  }
  const raw = env.APP_KNOWLEDGE_BROWSER_CONCURRENCY?.trim() || "1";
  if (raw !== "1" && raw !== "2") {
    throw new Error("App Knowledge browser concurrency must be one or two");
  }
  return {
    kind: "chatgpt-browser",
    model: CHATGPT_BROWSER_MODEL,
    concurrency: Number(raw) as 1 | 2,
  };
}

export function appKnowledgeProviderModelFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): string {
  return appKnowledgeProviderConfigFromEnvironment(env)?.model ?? "";
}
