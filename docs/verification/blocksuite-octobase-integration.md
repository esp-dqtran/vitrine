# BlockSuite + OctoBase integration verification

**Date:** 2026-07-30
**Result:** PASS for the owner-scoped integration proof

The proof keeps the existing Feature Document workflow unchanged. It adds one
disabled-by-default Project Docs route that mounts the official BlockSuite Page
and Edgeless editors over one Yjs document, stores a local IndexedDB copy, and
synchronizes through an Astryx-owned authenticated WebSocket gateway to an
unchanged OctoBase service.

## Pinned sources

| Component | Exact version |
| --- | --- |
| `@blocksuite/blocks` | `0.19.5` |
| `@blocksuite/presets` | `0.19.5` |
| `@blocksuite/store` | `0.19.5` |
| `@blocksuite/icons` override | `2.1.75` |
| `yjs` | `13.6.31` |
| `y-websocket` | `3.0.0` |
| `y-indexeddb` | `9.0.12` |
| OctoBase | `58f3bbdf97f391a535e772d32828a484376c4159` |

The icons override is an exact upstream version selection. It is not a patch:
the floating BlockSuite transitive range otherwise resolves to `2.2.17`, which
is incompatible with BlockSuite `0.19.5`.

No BlockSuite or OctoBase source is copied, edited, forked, or patched. The
source audit found no `patch-package` or `patches/` mechanism. The OctoBase
image checks out the exact official commit and verifies `HEAD` before building.

## Automated evidence

- `npm run verify:blocksuite-octobase`
  - Passed.
  - Output: `BlockSuite 0.19.5 compatibility passed through translated OctoBase workspace JpBQNI6EC6NdG9ZAsES3J`
- `npm test`
  - Passed with exit code 0.
  - The final TSX phase reported 367 passed, 0 failed.
- `npm run build`
  - Passed with exit code 0.
  - Vite emitted only its existing large-chunk advisory.
- `git diff --check`
  - Passed with no whitespace errors.
- `docker compose --profile project-docs config --quiet`
  - Passed.
- `node --env-file=.env --experimental-strip-types scripts/check-migrations.ts`
  - Passed with `{"status":"ok","current":true}`.
- Focused legacy Feature Document tests
  - 8 passed, 0 failed.
  - The exact legacy Feature Document migration, model, store, API, and page
    diff was empty.

The full automated suite covers:

- feature-flag and configured-Project gating;
- owner-scoped bootstrap and mode updates;
- second-user, cross-Project, and missing-document rejection;
- authenticated WebSocket upgrade authorization;
- session revalidation and revoked-socket closure;
- disabled gateway behavior;
- Page/Canvas mounting and BlockSuite effect registration;
- IndexedDB readiness, offline state, reconnection, recovery export, and
  provider disposal;
- OctoBase framing translation without modifying upstream.

## Browser and restart evidence

Two disposable owner-scoped Projects were used.

1. Page accepted `BA/PO acceptance note`, reached `Saved`, survived a full
   reload, and appeared from the same document in Canvas.
2. Page accepted `Restart recovery acceptance`.
3. OctoBase was stopped while the document was open.
4. The document remained visible and the status changed to `Offline`.
5. OctoBase was started and returned healthy.
6. The status returned to `Saved`.
7. A full reload restored the text.
8. Canvas mounted after recovery, showed the same text, and produced no browser
   error logs.
9. A direct route to another Project showed `Project Docs are unavailable`.

The restart test exposed and fixed one Astryx-owned state issue: a normal
WebSocket connection error after disconnect previously changed `Offline` to
`Save failed`. The runtime now keeps disconnected documents in `Offline` and
clears the failure marker after reconnection. Regression tests cover the full
offline-to-saved transition.

## Canvas acceptance boundary

Page/Canvas switching, shared text, Canvas mounting, reload persistence, and
restart recovery are verified.

The browser automation could not reliably target every BlockSuite toolbar
gesture through its nested shadow DOM. Therefore note, shape, connector,
freehand, frame, group, resize, and layer-order gestures were not each
independently certified in this run. No custom Astryx Canvas tools were added;
the UI is the official BlockSuite Edgeless preset. A short human gesture pass
is still recommended before widening the feature flag.

## Save-state meaning

`Saved` is an integration status, not a per-edit server durability receipt. It
means:

- IndexedDB is ready;
- the WebSocket is connected;
- the Yjs sync handshake completed; and
- no local update occurred during the 500 ms quiet period.

Production durability claims require a future explicit server
checkpoint/acknowledgement contract.

## Scope and rollout boundaries

This proof does not add Feature Document migration, content generation,
Notion/Confluence/AFFiNE import, custom blocks, attachments, sharing, revisions,
collaboration presence UI, or a production rollout. The feature remains
disabled by default and restricted to one configured test Project.

BlockSuite is published under MPL-2.0 and OctoBase under AGPL-3.0. This
engineering proof is not production licensing approval. Legal review is
required before production use or distribution.
