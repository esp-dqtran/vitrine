export interface AdvancedSearchConfig {
  enabled: boolean;
  indexVersion: 1;
  embedding: null | {
    baseUrl: string;
    apiKey: string;
    model: "text-embedding-3-small";
  };
}

export function advancedSearchConfigFromEnv(
  env: Record<string, string | undefined>,
): AdvancedSearchConfig {
  const enabled = env.ADVANCED_SEARCH_ENABLED === "true";
  const apiKey = env.SEARCH_EMBEDDING_API_KEY?.trim();
  if (!apiKey) return { enabled, indexVersion: 1, embedding: null };

  const baseUrl = (env.SEARCH_EMBEDDING_BASE_URL ?? "https://api.openai.com/v1")
    .trim()
    .replace(/\/$/, "");
  if (
    !/^https:\/\//.test(baseUrl)
    && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/.test(baseUrl)
  ) {
    throw new Error("SEARCH_EMBEDDING_BASE_URL must use HTTPS or loopback HTTP");
  }
  const model = env.SEARCH_EMBEDDING_MODEL ?? "text-embedding-3-small";
  if (model !== "text-embedding-3-small") {
    throw new Error("SEARCH_EMBEDDING_MODEL must be text-embedding-3-small for vector(1536)");
  }
  return {
    enabled,
    indexVersion: 1,
    embedding: { baseUrl, apiKey, model },
  };
}
