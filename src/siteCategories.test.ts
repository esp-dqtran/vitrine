import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryForPublicSite,
  categoriesForPublicSite,
  hasAiSiteEvidence,
  PUBLIC_SITE_CATEGORY_OVERRIDES,
  SITE_CATEGORIES,
  withAiSiteCategory,
} from "./siteCategories.ts";

test("keeps every reviewed public-site category inside the catalog taxonomy", () => {
  assert.equal(Object.keys(PUBLIC_SITE_CATEGORY_OVERRIDES).length, 69);
  assert.deepEqual(
    Object.entries(PUBLIC_SITE_CATEGORY_OVERRIDES).filter(([, category]) =>
      category === "Other"
    ),
    [],
  );
});

test("uses reviewed domain mappings before weak page metadata", () => {
  assert.equal(categoryForPublicSite({
    url: "https://www.amazon.com/",
    name: "amazon",
    description: "",
    sourceCategory: "Website",
  }), "Shopping");
  assert.equal(categoryForPublicSite({
    url: "https://www.lindy.ai/",
    name: "Lindy",
    description: "AI executive assistant",
    sourceCategory: "BusinessApplication",
  }), "Business");
});

test("normalizes useful schema categories and ignores the Website placeholder", () => {
  assert.equal(categoryForPublicSite({
    url: "https://example.com/",
    name: "Example",
    description: "",
    sourceCategory: "FinanceApplication",
  }), "Finance");
  assert.equal(categoryForPublicSite({
    url: "https://example.com/",
    name: "Example course",
    description: "Learning for students",
    sourceCategory: "Website",
  }), "Education");
});

test("falls back to one primary category for unknown public pages", () => {
  assert.equal(categoryForPublicSite({
    url: "https://example.com/",
    name: "Example CRM",
    description: "Customer sales workflow software",
  }), "Business");
  assert.equal(categoryForPublicSite({
    url: "https://unknown.example/",
    name: "Unknown",
    description: "No useful classification evidence",
  }), "Other");
});

test("adds AI as a secondary category without replacing the primary category", () => {
  assert.deepEqual(categoriesForPublicSite({
    url: "https://modal.com/",
    name: "Modal",
    description: "Serverless compute for AI and data teams",
    sourceCategory: "Website",
  }), ["Technology", "AI"]);
  assert.deepEqual(categoriesForPublicSite({
    url: "https://basecamp.com/",
    name: "Basecamp",
    description: "Project management for teams",
    sourceCategory: "Website",
  }), ["Business"]);
});

test("recognizes reviewed AI domains and explicit AI evidence", () => {
  assert.equal(hasAiSiteEvidence({
    url: "https://bolt.new/",
    name: "Bolt.new",
    description: "Build apps using your words",
  }), true);
  assert.equal(hasAiSiteEvidence({
    url: "https://example.com/",
    name: "Example",
    description: "Generative machine learning platform",
  }), true);
  assert.deepEqual(withAiSiteCategory(["Finance", "AI"], {
    url: "https://example.ai/",
    name: "Example",
    description: "",
  }), ["Finance", "AI"]);
  assert.ok(SITE_CATEGORIES.includes("AI"));
});
