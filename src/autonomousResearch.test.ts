import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeResearchReports, researchAssignments, researchDossier } from "./autonomousResearch.ts";

const officialReport = {
  sourceCandidates: ["https://linear.app/docs"],
  claims: [{ text: "Teams manage issues", sourceUrls: ["https://linear.app/docs"], confidence: 0.9 }],
  candidateFlows: [],
  roles: ["member"],
  capabilities: ["issue-management"],
  openQuestions: [],
};

const helpReport = {
  sourceCandidates: ["https://linear.app/docs/issues"],
  claims: [{ text: "Members create issues", sourceUrls: ["https://linear.app/docs/issues"], confidence: 0.95 }],
  candidateFlows: [{
    id: "create-issue",
    title: "Create issue",
    goal: "Create an issue",
    productArea: "Issues",
    mode: "mutate" as const,
    prerequisites: [],
    sourceUrls: ["https://linear.app/docs/issues"],
  }],
  roles: ["member"],
  capabilities: ["issue-management"],
  openQuestions: ["Which fields are required?"],
};

const fetchedSources = [
  { url: "https://linear.app/docs/issues", title: "Issues", retrievedAt: "2026-07-16T00:00:00.000Z", text: "Issue docs" },
  { url: "https://linear.app/docs", title: "Docs", retrievedAt: "2026-07-16T00:00:00.000Z", text: "Product docs" },
];

test("merges parallel research reports only when citations were fetched", () => {
  const dossier = mergeResearchReports("linear", [officialReport, helpReport], fetchedSources);
  assert.deepEqual(dossier.sources.map(({ url }) => url), ["https://linear.app/docs", "https://linear.app/docs/issues"]);
  assert.equal(dossier.claims.length, 2);
  assert.equal(dossier.candidateFlows[0].id, "create-issue");
  assert.throws(
    () => mergeResearchReports("linear", [{
      ...officialReport,
      claims: [{ text: "Unknown", sourceUrls: ["https://fake.test"], confidence: 1 }],
    }], fetchedSources),
    /citation/i,
  );
});

test("research prompts assign distinct product questions", () => {
  assert.deepEqual(researchAssignments().map(({ key }) => ({ key })), [
    { key: "product" },
    { key: "workflows" },
    { key: "roles-auth" },
    { key: "pricing-risk" },
    { key: "changes" },
  ]);
});

test("runs five bounded research assignments before verifying sources", async () => {
  const prompts: string[] = [];
  const sessions = researchAssignments().map((assignment, index) => ({
    ask: async (prompt: string) => {
      prompts.push(prompt);
      return JSON.stringify({
        sourceCandidates: ["https://linear.app/docs"],
        claims: index === 0 ? officialReport.claims : [],
        candidateFlows: [],
        roles: index === 0 ? ["member"] : [],
        capabilities: index === 0 ? ["issue-management"] : [],
        openQuestions: [],
      });
    },
    close: async () => {},
    assignment,
  }));
  let requestedSources: string[] = [];
  const dossier = await researchDossier(
    { app: "linear", homepageUrl: "https://linear.app" },
    {
      sessions,
      collectResearchPages: async () => [{ url: "https://linear.app", text: "Linear product" }],
      fetchAndVerifySources: async (urls) => {
        requestedSources = urls;
        return [fetchedSources[1]];
      },
    },
  );

  assert.equal(prompts.length, 5);
  for (const assignment of researchAssignments()) {
    assert.ok(prompts.some((prompt) => prompt.includes(assignment.question)));
  }
  assert.deepEqual(requestedSources, ["https://linear.app/docs"]);
  assert.equal(dossier.claims[0].text, "Teams manage issues");
});
