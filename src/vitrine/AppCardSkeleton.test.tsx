import assert from "node:assert/strict";
import test from "node:test";
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
