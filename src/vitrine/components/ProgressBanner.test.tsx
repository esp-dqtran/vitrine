import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressBannerView } from "./ProgressBanner";
import type { ProgressSnapshot } from "../types";

const snapshot: ProgressSnapshot = {
  entries: [
    { id: "worker:1", stage: "crawl", app: "linear", done: 2, total: 5, status: "running", message: "Downloading screens", updatedAt: "2026-07-19T00:00:04.000Z" },
    { id: "worker:2", stage: "smart-crawl", app: "notion", done: 0, total: 0, status: "running", updatedAt: "2026-07-19T00:00:03.000Z" },
    { id: "worker:3", stage: "crawl", app: "figma", done: 3, total: 4, status: "error", message: "One flow failed", updatedAt: "2026-07-19T00:00:02.000Z" },
    { id: "worker:4", stage: "crawl", app: "slack", done: 4, total: 4, status: "done", updatedAt: "2026-07-19T00:00:01.000Z" },
  ],
};

test("renders concurrent app progress and hides completed entries", () => {
  const html = renderToStaticMarkup(<ProgressBannerView snapshot={snapshot} />);

  assert.match(html, /2 apps crawling/);
  assert.match(html, /linear/);
  assert.match(html, /Downloading screens/);
  assert.match(html, /notion/);
  assert.match(html, /figma/);
  assert.match(html, /One flow failed/);
  assert.match(html, /Cancel all/);
  assert.doesNotMatch(html, /slack/);
});

test("renders nothing when every progress entry is terminal and hidden", () => {
  const html = renderToStaticMarkup(<ProgressBannerView snapshot={{ entries: [snapshot.entries[3]] }} />);
  assert.equal(html, "");
});
