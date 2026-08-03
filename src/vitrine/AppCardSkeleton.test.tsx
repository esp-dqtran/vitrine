import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AppCardSkeleton } from "./components/AppCardSkeleton.tsx";

test("matches App card geometry without becoming interactive", () => {
  const html = renderToStaticMarkup(<AppCardSkeleton index={0} />);
  assert.match(html, /data-app-card-skeleton="true"/);
  assert.match(html, /app-card-skeleton__media/);
  assert.match(html, /app-card-skeleton__logo/);
  assert.match(html, /app-card-skeleton__title/);
  assert.match(html, /app-card-skeleton__description/);
  assert.match(html, /app-card-skeleton__metadata/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /tabindex|role="link"|<button|<a(?:\s|>)/);
});

test("uses the same radii as the App card media and logo", () => {
  const source = readFileSync("src/vitrine/components/AppCardSkeleton.tsx", "utf8");
  assert.match(source, /height="100%" radius=\{14\}/);
  assert.match(source, /height="100%" radius=\{12\}/);
  assert.doesNotMatch(source, /radius="rounded"/);
});
