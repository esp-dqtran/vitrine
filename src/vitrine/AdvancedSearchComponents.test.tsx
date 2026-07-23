import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SearchResultItem } from "../searchTypes.ts";
import { AdvancedSearchFilters } from "./components/AdvancedSearchFilters.tsx";
import { AdvancedSearchResults } from "./components/AdvancedSearchResults.tsx";
import { SearchResultCard } from "./components/SearchResultCard.tsx";
import { emptySearchFilters } from "./searchState.ts";

const screenResult: SearchResultItem = {
  documentId: "screen:1", indexVersion: 1, versionId: 1, appId: 1,
  appName: "Linear", platform: "web", entityType: "screen", sourceId: "screen:1",
  title: "Checkout screen", description: "", aliases: [], visibleText: "Continue securely",
  components: [], states: [], layoutPatterns: [], publishedAt: "2026-07-23T00:00:00.000Z",
  sourcePayload: {}, matchedContext: [{ kind: "text", value: "Continue securely" }],
};
const flowResult = {
  ...screenResult,
  documentId: "flow:1",
  sourceId: "flow:1",
  entityType: "flow" as const,
  title: "Checkout flow",
};

test("renders one ranked All stream instead of grouped sections", () => {
  const html = renderToStaticMarkup(
    <AdvancedSearchResults items={[screenResult, flowResult]} onPreview={() => {}} />,
  );
  assert.ok(html.indexOf("Checkout screen") < html.indexOf("Checkout flow"));
  assert.doesNotMatch(html, /<h2[^>]*>Screens<\/h2>/);
});

test("renders factual matched context without semantic scores", () => {
  const html = renderToStaticMarkup(<SearchResultCard item={screenResult} onPreview={() => {}} />);
  assert.match(html, /Matched text: Continue securely/);
  assert.doesNotMatch(html, /similarity|0\.8|semantic/i);
});

test("desktop filters expose authorized counts and omit zero values", () => {
  const html = renderToStaticMarkup(
    <AdvancedSearchFilters
      filters={emptySearchFilters}
      facets={{
        ...Object.fromEntries(Object.keys(emptySearchFilters).map((key) => [key, []])),
        platform: [{ value: "iOS", count: 12 }, { value: "Android", count: 0 }],
      } as never}
      onChange={() => {}}
    />,
  );
  assert.match(html, /iOS.*12/);
  assert.doesNotMatch(html, /Android/);
});
