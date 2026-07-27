# Apps and Sites Lighthouse Performance Design

**Date:** 2026-07-26
**Status:** Approved for implementation

## Goal

Improve the public `/apps` and `/sites` mobile Lighthouse baselines without changing catalog access, search behavior, card semantics, or private detail-route authorization.

## Measured causes

- The first `/api/catalog` identity query takes about 62 seconds because it joins every latest version to `version_images`, then performs roughly 632,000 `images` lookups to find the newest Screen.
- `/apps` starts 20 taxonomy-preview requests during initial idle time even when the user never hovers a taxonomy value.
- `/sites` returns 274 summaries, renders all 274 cards immediately, and preloads Site taxonomy media. The baseline transferred about 12 MB of images and produced 3,484 DOM elements.
- Each public Site media redirect reloads the complete ready-Sites summary solely to repeat authorization already enforced by `siteMediaObject`.
- Google Fonts is a render-blocking dependency even though the existing font stack has a system fallback.

## Design

### Apps

The public catalog cursor keeps the same snapshot, ordering, and stable App-ID tie-breaker. Its `updated_at` value comes from the latest published App version's maintained `captured_at`, considering only versions whose maintained `screen_count` is positive. This removes the per-version image scan while keeping the visible ordering tied to captured catalog data.

Taxonomy previews load only after pointer entry. Existing request and image caches still deduplicate repeated hovers.

### Sites

The initial gallery renders 24 sorted cards. An `IntersectionObserver` sentinel appends another 24 cards near the viewport, preserving the current client-side search, taxonomy, and ordering behavior.

Site taxonomy media loads only on pointer entry. No taxonomy preview image is requested during initial page load.

Public catalog media routes call `siteMediaObject` directly. That store query already joins a ready Site version and validates page membership before returning protected object metadata, so the full summary read is redundant.

### Shared delivery

Remove the remote Google Fonts stylesheet and preconnects. The existing Figtree-first CSS stacks continue to fall back to the local system UI font without blocking first render.

## Error and compatibility boundaries

- `/apps` and `/sites` remain public; App and Site detail routes remain private.
- Apps pagination cursors retain their existing wire format.
- Site media remains non-enumerating and returns 404 for missing, non-ready, or internal objects.
- Search/filter/sort changes reset progressive Site rendering to the first 24 matching cards.
- Browsers without `IntersectionObserver` render the complete filtered Site list.

## Verification

- New regression tests must fail before production edits and pass afterward.
- Run focused store, route, Apps, Sites, and HTML-shell tests.
- Run the complete test suite and production build.
- Repeat the same standard mobile Lighthouse commands against the production preview and live API.
