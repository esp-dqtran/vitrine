import { CHATGPT_BROWSER_MODEL } from "./appKnowledgeBrowserProvider.ts";

export interface ChatGptBrowserAppKnowledgeConfig {
  kind: "chatgpt-browser";
  model: typeof CHATGPT_BROWSER_MODEL;
  concurrency: 1 | 2;
}

export type AppKnowledgeProviderConfig = ChatGptBrowserAppKnowledgeConfig;

export function appKnowledgeProviderConfigFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): AppKnowledgeProviderConfig | undefined {
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

// Reporting only — the API surfaces this name but never runs the provider, so
// a stale or unrecognized value must not take the API down at import time. An
// APP_KNOWLEDGE_PROVIDER the code no longer recognizes did exactly that in
// production. The worker still validates strictly through the config function
// above, which is where an unusable provider actually matters.
export function appKnowledgeProviderModelFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): string {
  try {
    return appKnowledgeProviderConfigFromEnvironment(env)?.model ?? "";
  } catch {
    return "";
  }
}
