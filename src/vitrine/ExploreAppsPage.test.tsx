import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./components/ExploreAppsPage.tsx", import.meta.url), "utf8");
const mainSource = await readFile(new URL("./main.tsx", import.meta.url), "utf8");

test("mounts the source-audited Palmer React page for /explore", () => {
  assert.match(source, /import \{ PalmerHomePage \}/);
  assert.doesNotMatch(source, /useResolvedThemeMode|themeMode/);
  assert.match(source, /catalogSessionKey=\{role \?\? "guest"\}/);
  assert.match(source, /onGuestLimitReached=\{onGuestLimitReached\}/);
  assert.match(source, /onOpenApp=\{onOpenApp\}/);
  assert.doesNotMatch(source, /LegacyExploreAppsPage/);
  assert.doesNotMatch(source, /motion\/react/);
});

test("starts the Explore catalog request before the application bundle resolves", () => {
  assert.match(mainSource, /window\.location\.pathname === '\/explore'/);
  assert.match(mainSource, /preloadInitialAppCatalogPage\(\)\.catch/);
});
