import assert from "node:assert/strict";
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
});
