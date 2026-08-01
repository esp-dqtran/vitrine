import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ProjectDocumentComment } from "../projectDocument.ts";
import { ProjectDocumentCommentsPanel } from "./components/ProjectDocumentCommentsPanel.tsx";

const comments: ProjectDocumentComment[] = [
  {
    id: 12,
    projectId: 7,
    documentId: 41,
    authorUserId: 3,
    authorEmail: "admin@localhost.test",
    body: "Confirm the rollout metric.",
    blockId: "block-1",
    quote: "rollout metric",
    resolvedAt: null,
    createdAt: "2026-07-31T08:00:00.000Z",
    updatedAt: "2026-07-31T08:00:00.000Z",
  },
  {
    id: 13,
    projectId: 7,
    documentId: 41,
    authorUserId: 3,
    authorEmail: "admin@localhost.test",
    body: "Engineering approved the approach.",
    blockId: null,
    quote: null,
    resolvedAt: "2026-07-31T09:00:00.000Z",
    createdAt: "2026-07-31T08:30:00.000Z",
    updatedAt: "2026-07-31T09:00:00.000Z",
  },
];

test("renders persistent open and resolved document comments", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentCommentsPanel
      comments={comments}
      anchor={{ blockId: "block-2", quote: "selected requirement" }}
      onClose={() => undefined}
      onSubmit={() => true}
      onResolve={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Document comments"/);
  assert.match(html, />1 open · 1 resolved</);
  assert.match(html, /placeholder="Ask a question or leave feedback…"/);
  assert.match(html, />Confirm the rollout metric\.</);
  assert.match(html, /“rollout metric”/);
  assert.match(html, />Commenting on selection</);
  assert.match(html, />selected requirement</);
  assert.match(html, /aria-label="Clear comment selection"/);
  assert.match(html, />Engineering approved the approach\.</);
  assert.match(html, />Resolve</);
  assert.match(html, />Reopen</);
  assert.match(html, /data-resolved="true"/);
});
