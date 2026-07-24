import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function testFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return testFiles(target);
    return /\.test\.tsx?$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

test("unit tests never open or configure a real database", async () => {
  const files = [
    ...(await testFiles("src")),
    ...(await testFiles("services")),
    ...(await testFiles("scripts")),
  ];
  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const checks: Array<[RegExp, string]> = [
      [/\bnew\s+(?:pg\.)?(?:Client|Pool)\s*\(/, "constructs pg client/pool"],
      [/\bimport\s+(?!type\b)[^;]+from\s+["']pg["']/, "imports pg at runtime"],
      [/\brequire\(["']pg["']\)/, "requires pg at runtime"],
      [/process\.env\.(?:DATABASE_URL|SEARCH_[A-Z_]*DATABASE_URL)\s*=/, "mutates database URL"],
      [/await\s+import\(["'][^"']*\/?db\.ts["']\)/, "imports the live database dynamically"],
    ];
    for (const [pattern, reason] of checks) {
      if (pattern.test(source)) violations.push(`${file}: ${reason}`);
    }
  }
  assert.deepEqual(violations, []);
});
