import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublishedSearchSource } from "../../../src/searchProjection.ts";
import type {
  SearchIndexJob,
  SearchIndexScope,
} from "../../../src/searchIndexStore.ts";
import type { SearchDocument } from "../../../src/searchTypes.ts";
import {
  processSearchIndexJob,
  type SearchIndexWorkerStore,
} from "./pipeline.ts";

const job: SearchIndexJob = {
  appId: 4,
  platform: "web",
  attempts: 1,
  workerId: "fixture-worker",
};

const sourceFixture: PublishedSearchSource = {
  version: {
    id: 9,
    appId: 4,
    app: "Linear",
    platform: "web",
    category: "Productivity",
    publishedAt: "2026-07-23T08:00:00.000Z",
  },
  images: [
    {
      id: 101,
      app: "Linear",
      platform: "web",
      image_url: "https://cdn.test/screen.png",
      kind: "screen",
      description: "Sign in",
      analysis: {
        description: "Authentication screen",
        purpose: "Sign in",
        pageType: "Authentication",
        productArea: "Account",
        theme: "dark",
        visibleStates: ["default"],
        componentNames: ["Button"],
        visibleText: ["Continue"],
        layoutPatterns: ["Sidebar"],
      },
    },
    {
      id: 102,
      app: "Linear",
      platform: "web",
      image_url: "https://cdn.test/button.png",
      kind: "ui_element",
      description: "Button",
      analysis: {
        description: "Primary action",
        purpose: "Continue",
        pageType: "Authentication",
        productArea: "Account",
        theme: "dark",
        visibleStates: ["default"],
        componentNames: ["Button"],
        visibleText: ["Continue"],
        layoutPatterns: [],
      },
    },
  ],
  system: {
    app: "Linear",
    generatedAt: "2026-07-23T08:00:00.000Z",
    tokens: [],
    components: [{
      id: "button",
      name: "Button",
      category: "Actions",
      description: "Triggers an action",
      variants: [],
    }],
    flows: [],
  },
  flows: [{
    id: "sign-in",
    title: "Sign in",
    description: "Authenticate",
    tags: [],
    steps: [{ label: "Continue", evidence: [101, 102] }],
  }],
};

function fakeStore(source: PublishedSearchSource): SearchIndexWorkerStore & {
  completed: boolean;
  failed: boolean;
  replacedEmbeddings?: number[][];
} {
  return {
    completed: false,
    failed: false,
    async loadSource() { return source; },
    async replaceDocuments(
      _scope: SearchIndexScope,
      _documents: SearchDocument[],
      embeddings?: number[][],
    ) {
      this.replacedEmbeddings = embeddings;
    },
    async complete() { this.completed = true; },
    async fail() { this.failed = true; },
  };
}

const fakeEmbedder = {
  model: "fixture",
  async embed(texts: string[]) {
    return texts.map(() => Array(1536).fill(0.1));
  },
};

test("indexes one claimed app-platform version", async () => {
  const report = await processSearchIndexJob({
    job,
    store: fakeStore(sourceFixture),
    embedder: fakeEmbedder,
  });
  assert.deepEqual(report, {
    appId: job.appId,
    platform: "web",
    documents: 6,
    embedded: 6,
  });
});

test("keeps keyword documents when embeddings fail", async () => {
  const store = fakeStore(sourceFixture);
  await processSearchIndexJob({
    job,
    store,
    embedder: {
      model: "fixture",
      embed: async () => {
        throw new Error("offline");
      },
    },
  });
  assert.equal(store.replacedEmbeddings, undefined);
  assert.equal(store.completed, true);
});

test("records source or database failures before surfacing them", async () => {
  const store = fakeStore(sourceFixture);
  store.loadSource = async () => {
    throw new Error("database offline");
  };
  await assert.rejects(() => processSearchIndexJob({
    job,
    store,
    embedder: null,
  }), /database offline/);
  assert.equal(store.failed, true);
});
