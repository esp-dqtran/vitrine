import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DesignerCanvasCommentThread } from "../designerCanvas.ts";
import { ProjectCanvasCommentPanel } from "./components/ProjectCanvasComments.tsx";

const thread: DesignerCanvasCommentThread = {
  id: "comment-1",
  x: 120,
  y: 180,
  resolved: false,
  createdAt: "2026-08-04T00:00:00.000Z",
  messages: [{
    id: "message-1",
    authorId: "designer-1",
    authorName: "Designer",
    body: "Please tighten this spacing.",
    createdAt: "2026-08-04T00:00:00.000Z",
  }],
};

const noop = () => {};

test("existing canvas comment threads expose delete alongside resolve and reply", () => {
  const markup = renderToStaticMarkup(
    <ProjectCanvasCommentPanel
      thread={thread}
      draft=""
      onDraftChange={noop}
      onSubmit={noop}
      onResolve={noop}
      onDelete={noop}
      onClose={noop}
    />,
  );

  assert.match(markup, />Delete</);
  assert.match(markup, />Resolve</);
  assert.match(markup, />Reply</);
});

test("new canvas comment drafts do not expose deletion", () => {
  const markup = renderToStaticMarkup(
    <ProjectCanvasCommentPanel
      draft=""
      onDraftChange={noop}
      onSubmit={noop}
      onResolve={noop}
      onDelete={noop}
      onClose={noop}
    />,
  );

  assert.doesNotMatch(markup, />Delete</);
  assert.match(markup, />Comment</);
});
