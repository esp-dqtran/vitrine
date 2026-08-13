import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResearchCollection } from "../db.ts";
import { CollectionsWorkspacePage } from "./components/CollectionsWorkspacePage.tsx";

const collection: ResearchCollection = {
  id: 7,
  name: "Checkout research",
  description: "Patterns for a clearer checkout.",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-03T00:00:00.000Z",
  items: [
    {
      id: 11,
      kind: "screen",
      app: "linear",
      reference_id: "101",
      title: "Checkout overview",
      notes: "",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: 12,
      kind: "flow",
      app: "linear",
      reference_id: "checkout",
      title: "Checkout flow",
      notes: "",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  ],
};

const sharedProps = {
  collections: [collection],
  loaded: true,
  plan: "pro" as const,
  onLoad: async () => [collection],
  onChange: () => undefined,
  onUpgrade: () => undefined,
};

test("summarizes saved evidence in the Collections content panel", () => {
  const html = renderToStaticMarkup(<CollectionsWorkspacePage {...sharedProps} />);
  // The rail is published to the hoisted shell (an effect), so a static render
  // of the page contains content only — rail markup is covered by the shell tests.
  assert.doesNotMatch(html, /projects-workspace__desktop-rail/);
  assert.match(html, />Collections</);
  assert.match(html, /Checkout research/);
  assert.match(html, /1 screen/);
});

test("reuses the full App-detail screen shell for a collection detail", () => {
  const html = renderToStaticMarkup(
    <CollectionsWorkspacePage {...sharedProps} collectionId={7} />,
  );
  assert.doesNotMatch(html, /Back to Collections/);
  assert.match(html, /data-reference-detail="app"/);
  assert.match(html, /app-detail collection-detail/);
  assert.match(html, /Checkout research controls/);
  assert.match(html, /aria-label="Loading"/);
  assert.doesNotMatch(html, /Patterns for a clearer checkout/);
  assert.doesNotMatch(html, /Last updated/);
  assert.doesNotMatch(html, /Showing/);
  const source = readFileSync(
    new URL('./components/CollectionsWorkspacePage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /listCollectionScreens/);
  assert.match(source, /ReferenceGalleryGrid/);
  assert.match(source, /ReferenceDetailShell/);
  assert.match(source, /layout=\{galleryLayout\}/);
  assert.match(source, /ScreenGridCard/);
  assert.match(source, /ScreenPreviewDialog/);
  assert.match(source, /appName=\{savedScreen\.app\}/);
  assert.match(source, /onRemove/);
  assert.match(source, /onOpen=\{\(\) => setPreviewIndex\(index\)\}/);
  assert.match(source, /onNavigate=\{setPreviewIndex\}/);
  assert.doesNotMatch(source, /evidence: `SCREEN-\$\{savedScreen\.screen\.id\}`/);
  assert.match(source, /projectRailNav\(\{/);
  assert.match(source, /collectionsActive: true/);
  // The app rail stays global. Loading unrelated projects here only existed to
  // populate its old nested flyout.
  assert.doesNotMatch(source, /listResearchProjects/);
  assert.doesNotMatch(source, /Collection items/);
  assert.doesNotMatch(source, /Save screens or flows/);

  assert.doesNotMatch(source, /ReferenceDetailPage/);
  const styles = readFileSync(new URL('./collectionsWorkspace.css', import.meta.url), 'utf8');
  assert.match(styles, /\.collection-detail,\s*\.collection-detail \.reference-detail__hero\s*\{\s*background: transparent;/);
  assert.match(styles, /\.collection-detail \.reference-detail__navigation\s*\{\s*display: none;/);
  assert.match(styles, /\.collection-detail \.reference-detail__hero-inner[\s\S]*?justify-items: center;[\s\S]*?text-align: center;/);
  const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const workspaceRoutes = /const workspaceChromeRoutes = new Set\(\[([\s\S]*?)\]\);/.exec(appSource);
  assert.ok(workspaceRoutes);
  assert.match(workspaceRoutes[1], /"collections"/);
});
