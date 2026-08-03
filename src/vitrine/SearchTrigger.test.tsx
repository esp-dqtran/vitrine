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
  assert.match(html, /aria-label="Search on Web\.\.\. · 3 filters, Open search and filters"/);
  assert.match(html, /class="reference-search-trigger"/);
  assert.match(html, /class="[^"]*reference-search-trigger__button[^"]*"/);
  assert.match(html, /class="[^"]*astryx-input-text[^"]*"/);
  assert.match(html, /data-variant="secondary"/);
  assert.doesNotMatch(
    readFileSync(new URL("./components/SearchTrigger.tsx", import.meta.url), "utf8"),
    /maxWidth:\s*420/,
  );
});

test("uses the standard inline icon size for an active category clear action", () => {
  const html = renderToStaticMarkup(
    <SearchTrigger
      label="Search Apps..."
      activeCategory="AI"
      onOpen={() => undefined}
      onClearCategory={() => undefined}
    />,
  );

  assert.match(html, />AI</);
  assert.match(html, /data-size="sm"/);
});
