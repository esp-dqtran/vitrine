import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

test("advanced search page owns URL state and uses explicit load more", async () => {
  const source = await readFile(
    new URL("./components/AdvancedSearchPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /parseSearchState/);
  assert.match(source, /Load more/);
  assert.doesNotMatch(source, /setInterval|\/api\/jobs/);
});
