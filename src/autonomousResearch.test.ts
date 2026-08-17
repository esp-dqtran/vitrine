import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseAppDossier } from "./autonomousCrawler.ts";
import {
  buildKiroDossierPrompt,
  mergeResearchReports,
  researchAssignments,
  researchDossier,
  researchDossierWithKiro,
  writeLocalFlowResearchMarkdown,
} from "./autonomousResearch.ts";

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

test("writes one researched flow as a local Markdown handoff without database access", () => {
  const root = mkdtempSync(join(tmpdir(), "vitrines-stage-one-"));
  try {
    const dossier = parseAppDossier({
      app: "linear",
      purpose: "Issue tracking",
      sources: [{ url: "https://linear.app/docs", title: "Linear docs", retrievedAt: "2026-08-15T00:00:00.000Z", kind: "documentation" }],
      claims: [{ text: "Workspace admins can invite members.", sourceUrls: ["https://linear.app/docs"], confidence: 0.9 }],
      roles: ["workspace admin"],
      capabilities: ["member management"],
      openQuestions: [],
      profile: {
        name: "Linear",
        canonicalUrl: "https://linear.app",
        category: "Project management",
        description: "A product development workspace.",
        sourceUrls: ["https://linear.app/docs"],
      },
      candidateFlows: [{
        id: "invite-member",
        title: "Invite a teammate",
        goal: "Invite a new workspace member",
        productArea: "Members",
        mode: "read",
        prerequisites: [],
        sourceUrls: ["https://linear.app/docs"],
        access: "sign_in_required",
        readiness: "needs_review",
        confidence: 0.8,
        credentialCapability: "linear.demo.admin",
        candidateSteps: [{ title: "Open workspace members", sourceUrls: ["https://linear.app/docs"], evidence: "documented" }],
      }],
      credentialCapabilities: [{
        alias: "linear.demo.admin",
        purpose: "Validate member-management flows",
        role: "workspace admin",
        allowedOrigins: ["https://linear.app"],
        flowIds: ["invite-member"],
        sourceUrls: ["https://linear.app/docs"],
      }],
    });
    const path = writeLocalFlowResearchMarkdown(dossier, "invite-member", root);
    const markdown = readFileSync(path, "utf8");
    assert.match(markdown, /# Invite a teammate/);
    assert.match(markdown, /linear\.demo\.admin/);
    assert.match(markdown, /Linear docs/);
    assert.match(markdown, /no credential values/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("uses Kiro for local Stage 1 research and verifies every cited source", async () => {
  let invocation: { args: string[] } | undefined;
  const dossier = await researchDossierWithKiro(
    { app: "linear", homepageUrl: "https://linear.app" },
    {
      collectResearchPages: async () => [{ url: "https://linear.app", text: "Build product issues." }],
      fetchAndVerifySources: async (urls) => {
        assert.deepEqual(urls, ["https://linear.app/docs"]);
        return [fetchedSources[1]];
      },
      runKiro: async (input) => {
        invocation = input;
        return `progress\n${JSON.stringify({
          sourceCandidates: ["https://linear.app/docs"],
          profile: {
            name: "Linear",
            canonicalUrl: "https://linear.app",
            category: "Project management",
            description: "Product development workspace.",
            sourceUrls: ["https://linear.app/docs"],
          },
          claims: officialReport.claims,
          candidateFlows: [{
            id: "review-issues",
            title: "Review issues",
            goal: "Review work items",
            productArea: "Issues",
            mode: "read",
            prerequisites: [],
            sourceUrls: ["https://linear.app/docs"],
            access: "sign_in_required",
            readiness: "needs_review",
            confidence: 0.8,
            credentialCapability: "none",
            candidateSteps: [{ title: "Open issues", sourceUrls: ["https://linear.app/docs"], evidence: "documented" }],
          }],
          credentialCapabilities: [],
          roles: ["member"],
          capabilities: ["issue-management"],
          openQuestions: [],
        })}`;
      },
      environment: { KIRO_CLI_BIN: "kiro-cli", KIRO_CLI_RESEARCH_MODEL: "gpt-5.6-terra" },
    },
  );
  assert.equal(dossier.profile?.name, "Linear");
  assert.equal(dossier.candidateFlows[0].id, "review-issues");
  assert.equal(dossier.candidateFlows[0].credentialCapability, undefined);
  assert.ok(invocation?.args.includes("--trust-tools=web_search"));
  assert.match(invocation?.args.at(-1) ?? "", /Stage 1 research handoff/);
  const prompt = buildKiroDossierPrompt({ app: "Linear", homepageUrl: "https://linear.app" }, [{ url: "https://linear.app", text: "Product" }]);
  assert.match(prompt, /sourceCandidates/);
  assert.match(prompt, /HTML or text page/);
});
