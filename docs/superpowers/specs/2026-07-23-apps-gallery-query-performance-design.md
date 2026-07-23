# Apps Gallery Query Performance Design

## Goal

Make the authenticated Apps gallery return its first 24 apps without the current 4-6 second cold-query spike while preserving its response shape, keyset pagination, ordering, totals, preview selection, and platform metadata.

## Measured baseline

The live API connects to the Supabase pooler in `ap-southeast-1` and reads a catalog containing 1,179 apps and roughly 1.09 million images.

- First observed `GET /api/apps?limit=24`: 6.09 seconds.
- Four immediately repeated requests: 183-202 milliseconds.
- Warm `EXPLAIN (ANALYZE, BUFFERS)` execution: 153 milliseconds.
- Warm plan footprint: 143,611 shared-buffer hits.
- The correlated `available_platforms` subquery executes 120 times, scans image rows through 170 index scans, and accounts for 94,225 shared-buffer hits.

The HTTP route performs one database call and a small in-memory response mapping. The delay is therefore a cold-cache amplification problem in `adminAppPage`, not JSON serialization or frontend rendering.

## Chosen approach

Rewrite `adminAppPage` as a page-first, set-based query. Select the 24 requested apps plus the lookahead app first, materialize a narrow set of screen facts for only the 24 returned apps, and derive counts, available platforms, and preview identifiers from that shared relation.

This is preferred over an API response cache because it improves cold and warm requests, avoids cache invalidation around imports, and keeps pagination immediately consistent. It is preferred over frontend prefetching because prefetching would move the delay without reducing database work.

## Query design

The rewritten query will retain the current eligible-app and keyset semantics:

1. `eligible_apps` finds apps with at least one screen and calculates the exact total.
2. `candidate_apps` applies the name cursor, sorts by name, and selects `limit + 1` rows for `has_more`.
3. `page_apps` retains the first `limit` candidates.
4. `page_image_facts AS MATERIALIZED` reads each page app's screen rows once using narrow fields: app id, platform id/name, image id, creation time, and whether analysis exists.
5. `app_counts` calculates total screens, analyzed screens, and last capture time once per app.
6. `app_platforms` calculates the ordered platform array once per app.
7. `ranked_preview_ids` ranks the narrow facts by creation time and image id, retaining at most five identifiers per app.
8. The final query joins only those preview identifiers back to `images` to obtain the full preview payload.

The response continues to contain up to five preview screens per app and remains ordered by app name and preview rank. Cursor, total, and `has_more` behavior remain unchanged.

## Index decision

The first implementation changes only the query so its benefit can be measured independently. The existing `(platform_id, image_url)` image index already supports platform lookup, and the principal defect is repeated execution rather than a missing lookup path.

After the rewrite, the live execution plan will determine whether a partial index on screen images is justified. An index will not be added unless the rewritten plan still spends material time reading or sorting screen rows; this avoids an unnecessary write and storage penalty on the million-row image table.

## Error handling and compatibility

No API contract or error behavior changes. The route continues to rely on the existing authentication middleware and returns database failures through the existing Express error path. The rewrite will use the existing query function and parameter binding, with no dynamic SQL or new cache state.

## Testing

Database integration coverage will prove that the optimized query preserves:

- exact total and `has_more` values;
- name-based cursor pagination without duplicates;
- five oldest previews per app in deterministic order;
- total and analyzed screen counts;
- last capture time;
- ordered, deduplicated available platforms.

The focused database test must fail against a deliberately isolated representation of the old repeated-platform query shape before production SQL changes are made. After it passes, the relevant database suite and full project tests will run.

Live verification will repeat the authenticated Apps flow and capture `GET /api/apps` timings. The rewritten warm plan should remain below 300 milliseconds and reduce shared-buffer work by at least 60 percent from the 143,611-hit baseline. The first observed Apps response should be below 1.5 seconds and repeated responses below 500 milliseconds in the same environment. The browser trace must also confirm that Apps still makes zero `GET /api/jobs` requests.

## Scope boundaries

This change optimizes only the Apps gallery query and its regression coverage. The separately diagnosed app-version and Screens pagination bottlenecks, card-navigation defect, crawler workers, and unrelated current workspace edits are not part of this implementation.
