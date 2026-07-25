import {
  batchEmbeddings,
  type SearchEmbeddingProvider,
} from "../../../src/searchEmbedding.ts";
import type {
  SearchIndexJob,
  SearchIndexScope,
} from "../../../src/searchIndexStore.ts";
import { projectSearchDocuments, type PublishedSearchSource } from "../../../src/searchProjection.ts";
import {
  projectSiteSearchDocuments,
  type PublishedSiteSearchSource,
} from "../../../src/siteSearchProjection.ts";
import type { SearchDocument } from "../../../src/searchTypes.ts";

export interface SearchIndexWorkerStore {
  loadSource(
    job: SearchIndexJob,
  ): Promise<PublishedSearchSource | PublishedSiteSearchSource | undefined>;
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
    const documents = !source
      ? []
      : input.job.kind === "app"
        ? projectSearchDocuments(source as PublishedSearchSource)
        : projectSiteSearchDocuments(source as PublishedSiteSearchSource);
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
    const scope: SearchIndexScope = input.job.kind === "app"
      ? {
        kind: "app",
        appId: input.job.appId,
        platform: input.job.platform,
        indexVersion: 1,
      }
      : {
        kind: "site",
        siteId: input.job.siteId,
        indexVersion: 1,
      };
    await input.store.replaceDocuments(scope, documents, embeddings);
    await input.store.complete(input.job);
    return {
      ...(input.job.kind === "app"
        ? { appId: input.job.appId, platform: input.job.platform }
        : { siteId: input.job.siteId }),
      documents: documents.length,
      embedded: embeddings?.length ?? 0,
    };
  } catch (error) {
    await input.store.fail(input.job, error);
    throw error;
  }
}
