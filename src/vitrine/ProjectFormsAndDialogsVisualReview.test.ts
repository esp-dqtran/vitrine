import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storyPath = new URL(
  "../stories/Projects/ProjectFormsAndDialogs.stories.tsx",
  import.meta.url,
);
const productionPath = new URL(
  "./components/ResearchProjectsPage.tsx",
  import.meta.url,
);

const storySource = readFileSync(storyPath, "utf8");
const productionSource = readFileSync(productionPath, "utf8");

test("reviews the exported production project dialogs", () => {
  assert.match(storySource, /CreateProjectDialog/);
  assert.match(storySource, /RenameProjectDialog/);
  assert.match(storySource, /DeleteProjectDialog/);
  assert.match(storySource, /initialState: "create"/);
});

test("production and Storybook share the same dialog components", () => {
  assert.match(productionSource, /export function CreateProjectDialog/);
  assert.match(productionSource, /export function RenameProjectDialog/);
  assert.match(productionSource, /export function DeleteProjectDialog/);
  assert.match(productionSource, /<CreateProjectDialog/);
  assert.match(productionSource, /<RenameProjectDialog/);
  assert.match(productionSource, /<DeleteProjectDialog/);
});

test("keeps primary and destructive actions explicit", () => {
  assert.match(
    productionSource,
    /label="Create project"[\s\S]*variant="primary"/,
  );
  assert.match(productionSource, /label="Save"[\s\S]*variant="primary"/);
  assert.match(
    productionSource,
    /label="Delete project"[\s\S]*variant="destructive"/,
  );
});
