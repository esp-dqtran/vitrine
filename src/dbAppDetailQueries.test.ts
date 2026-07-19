import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

test("app detail queries are explicit and evidence pagination stays in SQL", () => {
  assert.match(source, /export async function appMetadata\(/);
  assert.match(source, /export async function appEvidencePage\(/);
  assert.match(source, /export async function getVersionFlows\(/);
  assert.match(source, /export async function flowEvidenceImages\(/);

  const evidenceStart = source.indexOf("export async function appEvidencePage(");
  const evidenceEnd = source.indexOf("\nexport async function", evidenceStart + 1);
  const evidenceBody = source.slice(evidenceStart, evidenceEnd);
  assert.match(evidenceBody, /requestedLimit \+ 1/);
  assert.match(evidenceBody, /LIMIT \$\d/);
  assert.doesNotMatch(evidenceBody, /\bappImages\(/);
  assert.doesNotMatch(evidenceBody, /\bversionImages\(/);
});
