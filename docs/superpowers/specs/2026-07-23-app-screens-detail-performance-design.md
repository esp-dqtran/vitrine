# App Screens Detail Performance Design

## Goal

Reduce app-detail Screens latency for the first 48 cards and cursor pagination without changing response shapes, authorization, version visibility, or the existing race-safe section cache.

## Confirmed bottleneck

For `15five` on the local production-like dataset, `/apps/15five/versions?platform=web` takes 1.7-2.0 seconds and each `/screens` page takes about 2.0 seconds. Direct database timing shows `appEvidencePage` takes 38-102 ms. Every section request calls the full `listAppVersions` aggregation before running the evidence query, and the frontend waits for `/versions` before starting its first section request.

## Design

Add a database query that resolves one visible app version using scalar version metadata and scoped count aggregates. Section routes use this resolver instead of loading the complete version list. Refactor the full version-list query to aggregate image counts by version before joining version metadata and JSON snapshots, preserving the existing `AppVersion` response contract.

The frontend constructs a section cache key immediately. Until version metadata arrives it requests `version=latest`; the existing store aliases the response under the resolved numeric version. The `/versions` request continues concurrently for the selector and count metadata.

## Safety constraints

- Preserve admin draft fallback and non-admin published-only behavior.
- Preserve explicit-version 404 behavior.
- Preserve request abort, in-flight deduplication, retry, and stale-request protections.
- Preserve page size 48, cursor behavior, and unique merging from 48 to 96 cards.
- Make no Apps-screen job polling requests.

## Acceptance

- Focused frontend and API regression tests pass.
- Database tests preserve version counts and visibility semantics.
- Local API timings show the first and next Screens pages no longer pay the full version-list aggregation cost.
- Browser E2E observes app detail to Screens, 48 initial cards, scroll to 96, one versions request, two Screens page requests, and zero `/api/jobs` requests.
