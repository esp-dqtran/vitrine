export const SEARCH_EMBEDDING_DIMENSIONS = 1536;
export const SEARCH_EMBEDDING_BATCH_SIZE = 96;

export interface SearchEmbeddingProvider {
  readonly model: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export class OpenAICompatibleSearchEmbeddingProvider implements SearchEmbeddingProvider {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetch: typeof fetch;

  constructor(input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    fetch?: typeof fetch;
  }) {
    this.baseUrl = input.baseUrl.replace(/\/$/, "");
    this.apiKey = input.apiKey;
    this.model = input.model;
    this.fetch = input.fetch ?? globalThis.fetch;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > SEARCH_EMBEDDING_BATCH_SIZE) {
      throw new Error(`search embedding batch exceeds ${SEARCH_EMBEDDING_BATCH_SIZE} documents`);
    }
    const response = await this.fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
      signal,
    });
    if (!response.ok) throw new Error(`search embeddings returned ${response.status}`);
    const body = await response.json() as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const ordered = [...(body.data ?? [])]
      .sort((a, b) => a.index - b.index)
      .map(({ embedding }) => embedding);
    if (
      ordered.length !== texts.length
      || ordered.some((vector) =>
        !Array.isArray(vector)
        || vector.length !== SEARCH_EMBEDDING_DIMENSIONS
        || vector.some((value) => !Number.isFinite(value)))
    ) {
      throw new Error("search embedding response has invalid dimensions");
    }
    return ordered;
  }
}

export async function batchEmbeddings(
  texts: string[],
  provider: SearchEmbeddingProvider,
  signal?: AbortSignal,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += SEARCH_EMBEDDING_BATCH_SIZE) {
    if (signal?.aborted) throw signal.reason;
    vectors.push(...await provider.embed(
      texts.slice(offset, offset + SEARCH_EMBEDDING_BATCH_SIZE),
      signal,
    ));
  }
  return vectors;
}
