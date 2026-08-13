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
  assert.match(html, /reference-search-trigger__animated-label/);
  assert.match(html, /reference-search-trigger__line--enter/);
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

test("supports both command search shortcuts", () => {
  const source = readFileSync(new URL("./components/SearchTrigger.tsx", import.meta.url), "utf8");

  assert.match(source, /e\.key\.toLowerCase\(\) === 'k'/);
  assert.match(source, /e\.key === ' '/);
  assert.match(source, /⌘K \/ ⌘Space/);
  assert.match(source, /window\.setInterval/);
  assert.match(source, /2_400/);
  assert.match(source, /reference-search-trigger__letter/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("uses staggered rolling letters and a reduced-motion fallback", () => {
  const styles = readFileSync(new URL("./referenceDiscovery.css", import.meta.url), "utf8");

  assert.match(styles, /@keyframes reference-search-letter-in/);
  assert.match(styles, /translateY\(115%\) rotateX\(-72deg\)/);
  assert.match(styles, /animation-delay:\s*calc\(var\(--letter-index\) \* 18ms\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
