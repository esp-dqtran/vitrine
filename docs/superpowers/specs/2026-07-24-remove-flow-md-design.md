# Remove Legacy FLOW.md Design

## Goal

Remove the legacy app-level `FLOW.md` editor, export, API, and persistence feature while preserving the Flow catalog, Flow Viewer, evidence images, and the per-flow Feature Document workflow.

## Product boundary

The Flows experience remains the entry point for browsing captured journeys. Opening a flow still shows its ordered evidence and, when app, platform, and version context are available, the **Create Feature Document** action.

The following legacy surfaces are removed:

- **Open FLOW.md** from the Flows toolbar.
- The split Markdown editor and preview.
- **Export FLOW.md** from the design-system export panel.
- The `flow-md` export format.
- The `GET` and `PUT /design-systems/:app/flow-doc` API endpoints.
- The `flow_documents` persistence helpers and table.

The following surfaces are explicitly preserved:

- Flow cards, grouping, searching, and progressive rendering.
- Flow Viewer screenshots, interactions, and lightbox.
- Feature Document generation from every evidence image.
- Feature Document progress, cancellation, retry, revision history, review states, Markdown download, and read-only sharing.
- `DESIGN.md` and all other design-system exports.

## Architecture

The removal follows the existing boundaries instead of replacing them:

1. `FlowsPanel` stops importing or rendering `FlowDocEditor`.
2. `ExportPanel` stops offering `flow-md`.
3. `ExportFormat` and `buildExportArtifact` stop accepting or generating `flow-md`.
4. The API removes `flow-md` from its format allow-list and deletes the editable document routes and dependency hooks.
5. Database helpers for the mutable document are removed.
6. Migration verification and the README stop treating the retired feature as current.
7. A forward migration drops `flow_documents`; the already-applied `0009_flow_documents.sql` migration remains immutable as migration history.

## Data lifecycle

Migration `0020_drop_flow_documents.sql` drops the obsolete table. This permanently removes saved legacy FLOW.md bodies when the migration is applied. Feature Documents are stored in their own tables introduced by migration `0015_feature_documents.sql` and are not affected.

## Error handling

- Requests using the removed `flow-md` format return the existing invalid export response.
- Requests to the removed `flow-doc` endpoints return the application’s normal route-not-found response.
- Feature Document routes and generation errors remain unchanged.

## Testing

A focused removal-boundary test first proves the legacy symbols and UI are still present, then passes only after all seams are removed. Existing Flows tests are updated to assert that the Feature Document action remains available with exact source context. API tests verify `flow-md` is rejected and the removed routes are unavailable. Export tests continue covering every supported format except `flow-md`.

Full tests, TypeScript/Vite build, and `git diff --check` provide final regression coverage.
