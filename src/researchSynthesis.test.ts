import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResearchProjectWorkspace, ResearchSynthesisResult } from "./researchProject.ts";
import {
  renderResearchProjectMarkdown,
  synthesizeResearchProject,
  validateSynthesisResult,
} from "./researchSynthesis.ts";

const resultFixture = (overrides: Partial<ResearchSynthesisResult> = {}): ResearchSynthesisResult => ({
  executiveRead: "SSO is introduced after value is established.",
  observations: [{ text: "Both products defer SSO.", evidenceIds: ["e1"] }],
  differences: [{ text: "One product explains permissions first.", evidenceIds: ["e1"] }],
  alternatives: [{ title: "Progressive", tradeoff: "More steps", evidenceIds: ["e1"] }],
  recommendation: { text: "Use progressive setup.", evidenceIds: ["e1"] },
  requirements: [{ text: "Explain the reason for SSO.", evidenceIds: ["e1"] }],
  openQuestions: ["When is identity configured?"],
  ...overrides,
});

const workspaceFixture = (): ResearchProjectWorkspace => ({
  id: 1,
  title: "SSO onboarding",
  question: "How should SSO be introduced?",
  platformFilter: "web",
  constraints: "B2B",
  decision: "",
  rationale: "",
  openQuestions: "",
  revision: 2,
  lanes: [{
    id: 10,
    title: "Progressive",
    position: 0,
    conclusion: "Explain first",
    items: [{
      id: 1,
      projectId: 1,
      laneId: 10,
      position: 0,
      sourceKind: "catalog_screen",
      stepLabel: "Permission explanation",
      note: "Good context",
      tags: ["trust"],
      important: true,
      snapshot: { title: "SSO explainer", app: "Linear", sourcePath: "/apps/linear/screens/1" },
    }],
  }],
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
});

test("rejects unknown and missing evidence citations", () => {
  assert.throws(
    () => validateSynthesisResult(resultFixture({
      observations: [{ text: "Two apps defer SSO.", evidenceIds: ["missing"] }],
    }), new Set(["e1"])),
    /unknown evidence/i,
  );
  assert.throws(
    () => validateSynthesisResult(resultFixture({
      requirements: [{ text: "Explain SSO.", evidenceIds: [] }],
    }), new Set(["e1"])),
    /citation/i,
  );
});

test("retries one invalid synthesis and then succeeds", async () => {
  let attempts = 0;
  const result = await synthesizeResearchProject(workspaceFixture(), {
    model: "fixture",
    async generate() {
      attempts += 1;
      return attempts === 1
        ? resultFixture({ recommendation: { text: "Guess", evidenceIds: ["missing"] } })
        : resultFixture({
          observations: [{ text: "Observed", evidenceIds: ["e1"] }],
          differences: [{ text: "Different", evidenceIds: ["e1"] }],
          alternatives: [{ title: "A", tradeoff: "Tradeoff", evidenceIds: ["e1"] }],
          recommendation: { text: "Recommend", evidenceIds: ["e1"] },
          requirements: [{ text: "Require", evidenceIds: ["e1"] }],
        });
    },
  });

  assert.equal(attempts, 2);
  assert.equal(result.recommendation.text, "Recommend");
});

test("renders deterministic authenticated Markdown", () => {
  const workspace = workspaceFixture();
  workspace.synthesis = {
    id: 3,
    projectRevision: 2,
    stale: false,
    result: resultFixture(),
    createdAt: "2026-07-17T00:00:00.000Z",
  };
  const markdown = renderResearchProjectMarkdown(workspace);
  assert.match(markdown, /# SSO onboarding/);
  assert.match(markdown, /\/apps\/linear\/screens\/1/);
  assert.match(markdown, /AI-generated synthesis/);
  assert.doesNotMatch(markdown, /[?&](?:signature|token|expires)=/i);
  assert.equal(markdown, renderResearchProjectMarkdown(workspace));
});
