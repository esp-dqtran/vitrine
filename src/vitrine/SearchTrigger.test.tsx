import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchTrigger } from "./components/SearchTrigger.tsx";

test("shows the active filter count without changing the action name", () => {
  const html = renderToStaticMarkup(
    <SearchTrigger
      label="Search on Web..."
      activeCategory="All"
      activeFilterCount={3}
      onOpen={() => undefined}
      onClearCategory={() => undefined}
    />,
  );

  assert.match(html, /Search on Web\.\.\. · 3 filters/);
  assert.match(html, /aria-label="Open search and filters"/);
  assert.match(html, /class="reference-search-trigger"/);
  assert.match(html, /class="[^"]*reference-search-trigger__button[^"]*"/);
  assert.doesNotMatch(
    readFileSync(new URL("./components/SearchTrigger.tsx", import.meta.url), "utf8"),
    /maxWidth:\s*420/,
  );
});
