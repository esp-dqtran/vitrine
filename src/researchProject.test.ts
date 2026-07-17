import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RESEARCH_LIMITS,
  ResearchProjectConflictError,
  assertExpectedRevision,
  defaultResearchLanes,
  normalizeResearchTags,
} from "./researchProject.ts";

test("creates two default lanes", () => {
  assert.deepEqual(defaultResearchLanes(), [
    { title: "Alternative A", position: 0 },
    { title: "Alternative B", position: 1 },
  ]);
});

test("rejects stale revisions with the actual revision", () => {
  assert.throws(
    () => assertExpectedRevision(4, 3),
    (error: unknown) => error instanceof ResearchProjectConflictError
      && error.actualRevision === 4,
  );
});

test("normalizes unique bounded tags", () => {
  assert.deepEqual(normalizeResearchTags([" SSO ", "sso", "Trust", "", "x".repeat(41)]), [
    "SSO",
    "Trust",
  ]);
  assert.equal(
    normalizeResearchTags(Array.from({ length: 20 }, (_, index) => `tag-${index}`)).length,
    RESEARCH_LIMITS.tagsMax,
  );
});
