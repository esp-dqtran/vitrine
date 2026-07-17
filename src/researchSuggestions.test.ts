import assert from "node:assert/strict";
import { test } from "node:test";
import {
  rankResearchSuggestions,
  type ResearchSuggestionCandidate,
} from "./researchSuggestions.ts";

const fixture = (overrides: Partial<ResearchSuggestionCandidate>): ResearchSuggestionCandidate => ({
  id: "a",
  kind: "screen",
  app: "Example",
  platform: "web",
  title: "Account settings",
  description: "Manage an account",
  appCategory: "Productivity",
  tags: [],
  states: [],
  components: [],
  layouts: [],
  visibleText: [],
  ...overrides,
});

test("ranks and explains relevant evidence", () => {
  const [first] = rankResearchSuggestions("b2b sso onboarding", [
    fixture({ id: "a", flowTitle: "Invite teammate" }),
    fixture({ id: "b", flowTitle: "SSO onboarding", appCategory: "B2B" }),
  ], { platform: "web", limit: 20 });

  assert.equal(first.id, "b");
  assert.deepEqual(first.matchedFields, ["flow title", "app category"]);
});

test("filters by platform and uses recency as a stable tie-break", () => {
  const ranked = rankResearchSuggestions("login", [
    fixture({ id: "old", title: "Login", capturedAt: "2025-01-01T00:00:00Z" }),
    fixture({ id: "ios", platform: "ios", title: "Login", capturedAt: "2026-07-17T00:00:00Z" }),
    fixture({ id: "new", title: "Login", capturedAt: "2026-01-01T00:00:00Z" }),
  ], { platform: "web", limit: 20 });

  assert.deepEqual(ranked.map(({ id }) => id), ["new", "old"]);
});
