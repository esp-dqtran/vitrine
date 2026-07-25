# Mobbin Sites Variant Repair Worker Design

## Problem

Mobbin renders failed Sites such as Aino Agency correctly, but Astryx rejects
their React Server Component payload before storing them. The decoder assumes
that every section is either `page_image` or `page_video`, that video posters
and timestamp boundaries are always present, and that every page exposes a
full-page image in the captured source. Mobbin currently also emits
`custom_image` sections and omits some optional video fields.

The normal Sites worker is healthy and must continue consuming the catalog
queue. Failed Sites need a separate, one-pass repair path so they do not compete
with the remaining catalog crawl or retry endlessly.

## Approved Direction

Keep identity, version, page ordering, URL safety, media signature, and object
storage validation strict. Relax only the source fields proven optional by
Mobbin's rendered UI:

- Treat `custom_image` as an image section.
- Allow image metadata, OCR geometry, and crop boundaries to be absent.
- Allow video poster and timestamp boundaries to be absent.
- Use temporary public-HTTPS placeholders only while decoding incomplete source
  media; always replace section and page media with URLs observed in Mobbin's
  rendered Sections UI before storage.
- Capture rendered video posters and use the first available rendered image or
  poster as the page image when the source omits `page_image_url`.
- Preserve the original Mobbin source type in `sourceMetadata.sourceType`.

## Queue Isolation

Add a fixed `catalog | repair` queue scope:

- Catalog: `mobbin-sites-jobs` and `mobbin-sites-jobs.dlq`
- Repair: `mobbin-sites-repair-jobs` and `mobbin-sites-repair-jobs.dlq`

Queue names are constants selected from the fixed scope; arbitrary environment
queue names are not accepted. The existing API and catalog script continue to
publish to the catalog scope by default.

The repair worker uses the existing Sites worker image and pipeline with:

- `MOBBIN_SITES_QUEUE_SCOPE=repair`
- its own persistent Chromium profile volume
- the shared read-only Mobbin storage state
- prefetch 1 and the existing terminal-per-Site failure behavior

## Failed-Site Requeue

A dedicated command selects the latest failed `import-site` job for each URL,
skips URLs whose Site version is already ready, marks the remaining job queued,
and publishes it to the repair queue. Publishing failure returns that job to
`error` with a safe message. Reusing the original job ID lets a successful
repair clear the corresponding failed status instead of creating duplicate job
history.

## Verification

1. Parser regression tests cover `custom_image`, missing video poster, missing
   timestamps, and missing source page image.
2. Rendered-media tests prove section media, video posters, and page image
   fallbacks are collected and applied.
3. Queue tests prove repair declarations and publishing never touch the catalog
   queue.
4. Compose isolation tests prove the repair worker has its own queue scope and
   browser profile.
5. Run focused Sites tests, TypeScript/build checks, and the full test suite.
6. Rebuild and start only `sites-repair-worker`, publish failed Sites, and
   verify both catalog and repair consumer counts plus a repaired Aino Agency
   job or an exact remaining failure.

