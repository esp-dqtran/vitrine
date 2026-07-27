# Document Flow Markdown Renderer

## Goal

Show the saved Feature Document revision as formatted Markdown inside the selected
Flow's **Document Flow** tab. The tab must stop rebuilding the document as custom
Overview, Trigger, Ordered Steps, Outcome, and Alternate Paths sections.

## Source and data flow

The existing Flow lookup remains unchanged:

- identify the document by exact `app`, `platform`, capture `version`, and
  `flowId`;
- classify the document as loading, missing, pending, ready, or error;
- when ready, request the exact saved revision from
  `/api/feature-documents/:documentId/export.md?revisionId=:revisionId`;
- render the returned Markdown in the tab.

The existing loading, unavailable, generation-progress, retry, cancel, and
reconnect states remain because there is no Markdown file to show until a
revision exists.

## Ready-state presentation

The ready state contains only the formatted Markdown document. It does not show:

- the custom five-section narrative;
- claim-kind badges;
- visual-step buttons;
- the embedded Feature Document editor;
- an Edit Document Flow action.

Markdown is rendered with `react-markdown` and `remark-gfm`. Raw HTML embedded in
the Markdown is not enabled. This supports normal headings, paragraphs, lists,
links, code, tables, task lists, and strikethrough without introducing an HTML
injection path.

## Loading and errors

Fetching the Markdown has its own loading state because the document metadata and
the `.md` response arrive separately. A failed Markdown request shows an inline
error and a retry action. Changing to a different document or revision discards
the previous Markdown and loads the newly selected revision.

## Verification

Focused component tests must prove that:

- the ready state requests the exact document and revision Markdown;
- Markdown headings, lists, and GFM content render as HTML;
- the old structured sections and edit action are absent;
- Markdown loading and failure states remain understandable.

The Vitrine Flow tests and production build must pass.
