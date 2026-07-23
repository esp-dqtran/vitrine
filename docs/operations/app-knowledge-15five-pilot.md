# 15five App Knowledge Pilot

This pilot is the release gate for App Knowledge extraction and analysis. It
targets one capture at a time. There is no catalog-wide App Knowledge queue in
this release.

## Automated gate

Run the read-only verifier against the intended capture version:

```bash
node --env-file=.env --import tsx scripts/verify-app-knowledge-pilot.ts \
  --app 15five \
  --platform web \
  --version 1
```

The command opens a `READ ONLY` PostgreSQL transaction, prints a JSON summary,
and exits non-zero with named failed gates. It never enqueues work, changes
review status, or updates evidence.

The exact 15five baseline requires:

- 610 quarantined UI Element captures;
- 754 resolved Flow references covering 610 unique images;
- every eligible evidence item completed or served from cache;
- every citation present in the frozen manifest;
- every observed or inferred claim cited;
- a second identical run served entirely from cache;
- accepted resume, cancel, retry, stale, auth, and review behavior;
- at least five reviewed complete Flows;
- reviewed Designer, Developer, and Product projections.

## Human review checklist

Before approving the snapshot:

1. Review representative Screen classifications across the major product areas.
2. Review at least five complete Flows from entry to completion.
3. Confirm or reject the component candidates and approximate design tokens.
4. Inspect the Designer, Developer, and Product views and record each review.
5. Record reviewer correction notes and preserve every cited source image.
6. Approve only after the automated verifier returns `"ok": true`.
7. Record duration, provider cost, cache reuse, validation failures, and
   reviewer correction rate in the pilot notes.

Exercise the admin auth boundary and the resume, cancel, retry, and stale-job
paths before the final run. Their acceptance records are part of the gate; a
clean generation alone is not sufficient.

Regeneration creates a new draft and does not overwrite curator edits. Partial
coverage must be explicitly acknowledged in the review workspace before
approval.
