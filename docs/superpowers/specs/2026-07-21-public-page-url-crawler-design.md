# Public Page URL Crawler Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Allow an administrator to submit one public website URL and create or enrich an Astryx App with a deterministic desktop capture of that exact page. The result includes basic App metadata, a full-page screenshot, HTML-derived section crops, a continuous Mobbin-style scroll preview, and immutable recrawl history.

## Product decisions

- V1 captures only the exact submitted URL. It does not follow links.
- V1 accepts public HTTP(S) pages only. It does not support login, cookies supplied by the user, CAPTCHA, or private networks.
- V1 renders at a fixed 1440-pixel desktop viewport.
- App metadata is limited to name, description, category, canonical website URL, icon, accent color, and Web platform.
- Apps are deduplicated by normalized hostname with a leading `www.` removed. Pages are deduplicated by canonical URL after redirects.
- Section detection is DOM-first. Screenshots preserve visual evidence but do not decide structure.
- The preview video scrolls continuously at a stable visual speed, without pausing at sections.
- Changed recrawls create immutable capture versions. Byte-identical captures reuse the existing ready version.
- A capture is visible only after every required object and database record is complete.

## Existing-model mapping

The generic crawler uses the existing Apps presentation and evidence contracts:

| Public-page artifact | Existing Apps artifact |
|---|---|
| Website/product identity | App |
| Full-page screenshot | Screen |
| HTML-derived large section | UI Element |
| Desktop browser | Web platform |
| Capture batch | App draft version |

New page-specific tables preserve information the existing image model cannot represent: canonical page identity, immutable page capture versions, HTML snapshot object, continuous-scroll video object, ordered section geometry, and capture status.

## Architecture

```text
Apps Import from URL
        |
POST /api/jobs { type: "crawl-public-page", url }
        |
jobs table + public-page-jobs RabbitMQ queue
        |
public-page-import-worker
        |
Playwright public-page crawler
  - validate every navigation hop
  - render at 1440 x 900
  - extract metadata from JSON-LD, Open Graph, manifest and DOM
  - detect ordered sections from rendered DOM
  - capture full-page PNG
  - crop section PNGs from the same screenshot
  - record continuous WebM scroll preview
        |
object storage + one transactional completion
        |
App detail: Overview preview + Screens + UI Elements
```

The worker shares RabbitMQ and object storage with Astryx but owns a distinct durable queue, dead-letter queue, consumer process, progress messages, and retry budget. Mobbin Apps and Mobbin Sites workers are unchanged.

## URL and browser safety

Submission accepts only syntactically valid HTTP(S) URLs without credentials. Before enqueueing and before each browser navigation or redirect, the crawler resolves DNS and rejects loopback, link-local, private, multicast, documentation, benchmark, and cloud-metadata address ranges for IPv4 and IPv6. The worker blocks popups, downloads, and navigation away from the approved host after the initial redirect chain.

The worker caps navigation time, DOM size, page height, screenshot bytes, section count, object bytes, and preview duration. It reports authentication walls, CAPTCHA, unsupported content, and policy failures as permanent errors. Browser, DNS, storage, and network interruptions retry up to three attempts.

## Metadata extraction

Metadata sources are evaluated in this order:

1. JSON-LD `SoftwareApplication`, `Organization`, and `WebSite` records.
2. Open Graph metadata.
3. Web App Manifest.
4. Standard title, description, canonical, icon, and `theme-color` elements.
5. Visible header logo and brand text.
6. Normalized hostname fallback.

Low-confidence extraction never overwrites an existing non-null curated App field. The crawler records the normalized source domain so later URLs from the same host attach to the same App.

## DOM section analysis

The analyzer runs in the rendered page after fonts and lazy content settle. It removes invisible nodes, scripts, styles, modal overlays, cookie banners, floating controls, and duplicate sticky elements. Candidate roots come from semantic landmarks and large direct children of `main` or `body`.

For div-only pages, boundary scoring uses headings, role changes, background changes, borders, large vertical gaps, and full-width layout transitions. Normalization unwraps one-child layout containers, removes nested duplicates, merges undersized siblings, and splits oversized containers containing multiple strong child boundaries.

Each accepted section stores document order, selector, tag/role, heading, bounded text excerpt, x/y/width/height, and its cropped image identity. V1 captures large designer-level sections, not individual buttons or cards.

## Capture sequence

1. Validate the submitted URL and create a queued job.
2. Open an isolated Chromium context at 1440 x 900.
3. Navigate with bounded redirects and wait for rendered content.
4. Scroll once to trigger lazy content, return to the top, and freeze incidental animation for still capture.
5. Extract App metadata and normalized section boundaries.
6. Capture one full-page PNG and crop section PNGs from those exact bytes.
7. Restore normal rendering, start a page screencast, hold at the top, continuously scroll near 200 pixels per second, hold at the footer, and stop. Cap the preview at 60 seconds.
8. Upload HTML JSON, screenshot, section crops, icon when available, and WebM video under deterministic content-addressed keys.
9. Complete App, Page, capture version, App evidence images, section records, and stored-object metadata in one database transaction.
10. Mark the job done only after the version becomes ready.

## Persistence

`apps` gains nullable source metadata fields: display name, description, website URL, source domain, and accent color. Existing curated values win over missing or lower-confidence crawl values.

`web_pages` owns one canonical URL under an App. `web_page_versions` owns a content hash, status, viewport, capture time, HTML object, preview object, and full-page Screen image. `web_page_sections` owns ordered geometry and one UI Element image.

The completion transaction inserts verified `stored_objects`, attaches object keys to the existing `images` rows, adds those images to the App's current Web draft version, writes page/section records, and performs the final `ready` transition. Failed attempts keep diagnostic status but never appear in normal evidence queries.

## API and UI

The existing Apps import dialog adds a public-page URL mode that needs only one URL. It submits `crawl-public-page` through `POST /api/jobs` and does not poll `GET /api/jobs` from the Apps gallery.

App metadata responses expose an authenticated preview-media URL when a ready public-page capture exists. App Overview renders that native video above the existing counts. Screens continues to show full-page stills; UI Elements shows ordered large-section crops. Existing Apps without public-page captures render unchanged.

## Failure behavior

Jobs progress through validating, rendering, analyzing HTML, capturing, uploading, and finalizing stages. Safe progress messages contain no submitted URLs, object keys, HTML, or provider diagnostics. Permanent failures become terminal immediately. Transient failures are retried by the isolated queue and become terminal after the third attempt. Cancellation closes the browser and leaves no ready capture.

## Verification

- Unit tests cover public URL normalization, metadata precedence, DOM candidate normalization, object keys, job parsing, and version deduplication.
- Browser fixtures cover semantic HTML, div-only layouts, lazy images, sticky headers, overlays, continuous scroll recording, and tall-page caps.
- Store tests prove atomic completion, unchanged recrawl reuse, changed recrawl versioning, ordered sections, and no ready partial result.
- API tests prove admin-only submission, storage readiness, safe errors, correct queue isolation, and preview authorization.
- Component tests prove URL-only submission, video Overview rendering, Screen/UI Element compatibility, and zero Apps-gallery job polling.
- Full tests, TypeScript, Vite build, migration checks, and Compose configuration must pass before completion.

## Non-goals

- Multi-page same-origin crawling.
- Mobile or tablet viewports.
- Authentication and session import.
- CAPTCHA bypass.
- AI-controlled section boundaries or semantic labels.
- Technology-stack, pricing, feature, or target-audience research.
- Scheduled recrawls.
- Automatic publication of the App draft version.
