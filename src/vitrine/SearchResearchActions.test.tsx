import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResearchProjectWorkspace } from "../researchProject.ts";
import type { SearchResultItem } from "../searchTypes.ts";
import {
  addComparisonSelection,
  addResultToProject,
  searchCollectionReference,
} from "./components/SearchResearchActions.tsx";

const screenResult: SearchResultItem = {
  documentId: "screen:101", indexVersion: 1, versionId: 7, appId: 1,
  appName: "Linear", platform: "web", entityType: "screen", sourceId: "screen:101",
  title: "Checkout", description: "", aliases: [], visibleText: "", components: [],
  states: [], layoutPatterns: [], publishedAt: "2026-07-23T00:00:00.000Z",
  mediaImageId: 101, sourcePayload: { versionId: 7, mediaImageId: 101 }, matchedContext: [],
};
const project = {
  id: 3, title: "Research", question: "Why?", platformFilter: "all" as const,
  constraints: "", decision: "", rationale: "", openQuestions: "", revision: 2,
  lanes: [{ id: 8, title: "Evidence", position: 0, conclusion: "", items: [] }],
  createdAt: "", updatedAt: "",
} satisfies ResearchProjectWorkspace;

test("saves the stable source identity to a collection", () => {
  assert.deepEqual(searchCollectionReference(screenResult), {
    kind: "screen",
    app: "Linear",
    referenceId: "screen:101",
    title: "Checkout",
  });
});

test("adds catalog evidence to the selected project lane", async () => {
  let added: any;
  await addResultToProject(screenResult, project, 8, async (input) => {
    added = input;
    return project;
  });
  assert.equal(added.catalog.versionId, 7);
  assert.equal(added.catalog.imageId, 101);
  assert.equal(added.sourceKind, "catalog_screen");
});

test("comparison enforces two to five distinct apps", () => {
  let selected = [screenResult];
  for (let appId = 2; appId <= 5; appId += 1) {
    selected = addComparisonSelection(selected, { ...screenResult, appId });
  }
  assert.equal(selected.length, 5);
  assert.throws(
    () => addComparisonSelection(selected, { ...screenResult, appId: 6 }),
    /five/,
  );
});
