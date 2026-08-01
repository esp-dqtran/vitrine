import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ProjectDocumentVersion } from "../projectDocument.ts";
import { ProjectDocumentHistoryPanel } from "./components/ProjectDocumentHistoryPanel.tsx";

const versions: ProjectDocumentVersion[] = [
  {
    id: 18,
    projectId: 7,
    documentId: 41,
    createdByUserId: 3,
    createdByEmail: "admin@localhost.test",
    label: "Review ready",
    byteSize: 2048,
    createdAt: "2026-07-31T11:00:00.000Z",
  },
];

test("renders named document versions and restore controls", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentHistoryPanel
      versions={versions}
      onClose={() => undefined}
      onCreate={() => true}
      onRestore={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Document version history"/);
  assert.match(html, />Version history</);
  assert.match(html, />1 version</);
  assert.match(html, /placeholder="Version name \(optional\)"/);
  assert.match(html, />Save version</);
  assert.match(html, />Review ready</);
  assert.match(html, />admin@localhost\.test · 2 KB</);
  assert.match(html, />Restore</);
});

test("keeps version history read-only for viewers", () => {
  const html = renderToStaticMarkup(
    <ProjectDocumentHistoryPanel
      versions={versions}
      readOnly
      onClose={() => undefined}
      onCreate={() => true}
      onRestore={() => undefined}
    />,
  );

  assert.match(html, />View-only access\./);
  assert.doesNotMatch(html, />Save version</);
  assert.doesNotMatch(html, />Restore</);
});
