import {
  batchEmbeddings,
  type SearchEmbeddingProvider,
} from "../../../src/searchEmbedding.ts";
import type {
  SearchIndexJob,
  SearchIndexScope,
} from "../../../src/searchIndexStore.ts";
import { projectSearchDocuments, type PublishedSearchSource } from "../../../src/searchProjection.ts";
import type { SearchDocument } from "../../../src/searchTypes.ts";

export interface SearchIndexWorkerStore {
  loadSource(job: SearchIndexJob): Promise<PublishedSearchSource | undefined>;
  replaceDocuments(
    scope: SearchIndexScope,
    documents: SearchDocument[],
    embeddings?: number[][],
  ): Promise<void>;
  complete(job: SearchIndexJob): Promise<void>;
  fail(job: SearchIndexJob, error: unknown): Promise<void>;
}

export async function processSearchIndexJob(input: {
  job: SearchIndexJob;
  store: SearchIndexWorkerStore;
  embedder: SearchEmbeddingProvider | null;
  signal?: AbortSignal;
}) {
  try {
    const source = await input.store.loadSource(input.job);
    const documents = source ? projectSearchDocuments(source) : [];
    let embeddings: number[][] | undefined;
    if (input.embedder && documents.length) {
      try {
        embeddings = await batchEmbeddings(
          documents.map(({ searchText }) => searchText),
          input.embedder,
          input.signal,
        );
      } catch {
        embeddings = undefined;
      }
    }
    await input.store.replaceDocuments(
      {
        appId: input.job.appId,
        platform: input.job.platform,
        indexVersion: 1,
      },
      documents,
      embeddings,
    );
    await input.store.complete(input.job);
    return {
      appId: input.job.appId,
      platform: input.job.platform,
      documents: documents.length,
      embedded: embeddings?.length ?? 0,
    };
  } catch (error) {
    await input.store.fail(input.job, error);
    throw error;
  }
}
