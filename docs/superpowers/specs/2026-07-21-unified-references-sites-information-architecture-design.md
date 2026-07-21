# Unified References and Sites Information Architecture Design

**Date:** 2026-07-21
**Status:** Approved design, pending implementation plan

## Relationship to earlier specifications

This specification consolidates the approved product direction for Mobbin Sites after live research of the Mobbin Sites experience and review of Astryx's implemented Sites import and Apps-style UI work.

It supersedes the user-facing information architecture in:

- `2026-07-20-sites-apps-ui-parity-design.md`, specifically the visible `Overview`, `Pages`, and `Sections` model, page-count presentation, and separate top-level Sites navigation.
- `2026-07-20-mobbin-sites-import-design.md`, only where that document describes pages as the designer-facing primary result.

It preserves the existing technical decisions from those specifications: a shared import control plane, a separate Sites queue and worker, separate Sites persistence, protected object storage, idempotent imports, and Apps UI primitives reused as presentation components.

## Problem

Astryx currently exposes the source crawler hierarchy too literally. The imported V7 fixture contains 16 page records and 46 section records, so the current UI presents `16 pages` and a dedicated Pages tab. That structure is useful to the crawler, but it does not match the way Mobbin Sites helps designers find references.

Mobbin separates Apps and Sites because public-facing websites have different design artifacts from product applications. Within a Site, the primary reusable artifacts are sections such as Hero, Navigation, Features, Pricing, Comparison, CTA, and Footer. A full page supplies context for a section; it is not the website equivalent of an App Screen.

The product should therefore unify discovery without flattening the domains:

- Apps and Sites belong in one designer-facing reference library.
- Apps and Sites retain separate terminology, data models, imports, and crawlers.
- Pages remain internal capture context for Sites.

## Product decision

Astryx will introduce one top-level **References** area with **Apps** and **Sites** type tabs.

The selected model is:

```text
References
├── Apps
│   ├── Screens
│   ├── UI Elements
│   └── Flows
└── Sites
    ├── Preview
    └── Sections
        ├── Section
        └── Full-page context
```

This is a unified discovery experience, not a unified database entity. `App`, `Site`, `Screen`, `Section`, and `Page` keep their existing domain meanings.

### Conceptual mapping

| Apps concept | Closest Sites concept | Important distinction |
|---|---|---|
| App | Site | Both are reference containers. |
| Screen | Section | Both are the primary searchable, reusable design artifacts. |
| Flow | Preview | Both show experience over time, but a Site preview is a capture rather than a product task flow. |
| Screen context | Full-page context | The full page explains where a section lives. |
| App version/platform | Site capture version | Site versions are dated website captures and have no mobile platform. |

`App Screen = Site Page` is explicitly rejected. A website page often contains many independently useful patterns, while a Site section is the artifact a designer searches, compares, saves, and exports.

## Goals

- Give designers one obvious place to browse visual references.
- Reuse the Apps visual system without disguising Sites as Apps.
- Make sections the primary Site discovery object.
- Make full-page captures available as contextual evidence when inspecting a section.
- Remove crawler-oriented page counts and page navigation from the normal Site experience.
- Preserve existing deep links, import contracts, queue isolation, and data ownership during the first migration.
- Keep both Apps and Sites galleries free of background `GET /api/jobs` polling.

## Non-goals

- Combining Apps and Sites tables or domain types.
- Sending `import-site` work to the Apps worker.
- Reclassifying Site pages as App screens.
- Removing page records from the crawler or database.
- Building cross-type search ranking in the first release.
- Adding public sharing, collections, AI classification, GitHub sync, or automatic recrawling.
- Changing Apps detail behavior while extracting or reusing shared presentation components.

## Primary designer journeys

### Browse an App reference

1. Open References.
2. Select Apps.
3. Search or filter the Apps collection.
4. Open an App and continue using its existing Screens, UI Elements, and Flows experience.

### Browse a Site reference

1. Open References.
2. Select Sites.
3. Search or filter the Sites collection.
4. Open a Site on Preview or Sections.
5. Find a reusable section pattern.
6. Inspect the section alone or switch to its full-page context.
7. Download or copy the permitted asset.

### Import a Site reference

1. Select Sites in References.
2. Choose Import Site.
3. Paste a supported Mobbin Sites URL.
4. Submit an `import-site` job through the existing jobs API.
5. Receive real-time progress without gallery polling.
6. Open the completed Site on its Preview tab.

## References gallery

### Navigation

- Replace separate first-class Apps and Sites navigation items with one **References** item.
- Inside References, show **Apps** and **Sites** as persistent type tabs.
- Remember search and filter state independently for each type during the session.
- Keep `/apps` and `/sites` as the underlying routes in the first release so existing deep links, browser history, and tests remain valid.
- The active route determines the selected type tab. No new aggregate API is required.

### Shared shell

Both types use the existing Apps gallery system for:

- page proportions and responsive grid;
- sticky search treatment;
- count row;
- preview carousel behavior;
- skeleton, error, retry, and empty states;
- hover, focus, and reduced-motion behavior;
- accessible whole-card navigation.

Search and filters operate only within the selected type. The first release does not mix App and Site results into one ranking because their filter vocabularies and artifact types differ.

### Apps tab

Apps behavior remains unchanged. An App card can show:

- App name and icon;
- platform/version context;
- screen preview carousel;
- screen and flow counts;
- existing status or progress treatments;
- an Apps-specific Import App action.

### Sites tab

A Site card shows:

- Site name and favicon or stable identity mark;
- latest capture/version label;
- bounded website preview media using the shared carousel card;
- section count;
- a Sites-specific Import Site action.

The card does not show the number of internal pages. Page titles may remain searchable only if they improve source matching, but they are not presented as a primary count or navigation concept.

## Site detail

The Site detail view reuses the existing Apps detail shell for structure and interaction while supplying Site-specific content and terminology.

### Header

The header contains:

- Back to Sites within References;
- Site identity, name, and source metadata;
- capture version selector;
- capture date and viewport when available;
- Visit Site when a safe source website URL exists;
- admin-only Import Site.

The version selector keeps previous captures available and clearly identifies the latest capture.

### Tabs

The only primary tabs are:

1. **Preview**
2. **Sections**

The previous user-facing Overview and Pages tabs are removed. Preview becomes the default tab. Unknown tab state falls back to Preview.

### Preview tab

Preview shows the captured website experience using available imported media:

- preview recording when present;
- bounded preview carousel or full capture fallback when a recording is unavailable;
- capture date, viewport, and version context;
- accessible native video controls where applicable.

Preview is for understanding the overall Site experience. It is not split into user-visible page entities.

### Sections tab

Sections are the primary inspectable Site artifacts.

The tab provides:

- keyword search;
- section-pattern filters such as Hero, Navigation, Features, Pricing, Comparison, CTA, and Footer when pattern metadata exists;
- media-kind filters only when useful to the imported result;
- responsive media grid using the shared Apps media-card treatment;
- total and filtered section counts;
- source order preserved within stable groupings.

The UI must remain useful before automatic pattern classification is complete. Unclassified sections appear under a neutral pattern rather than disappearing.

## Section inspection

Selecting a section opens the shared keyboard-accessible lightbox with Site-specific controls.

### Views

- **Section** shows the focused cropped image or section video.
- **Full page** shows the parent page capture as context for the selected section.

The selected section remains identifiable when switching to Full page. If reliable bounds are available, the full-page view may indicate the section position using the product's existing selection treatment; it must not invent an imprecise overlay.

### Information and actions

The inspector may show:

- section pattern;
- source URL or path;
- viewport and capture date;
- media kind;
- previous/next section navigation;
- download and copy actions supported by current permissions.

Escape closes the inspector, arrow keys move through ordered sections, visible focus is preserved, and native video controls remain keyboard accessible.

Raw OCR payloads, crop internals, delivery signatures, cookies, and crawler diagnostics are never exposed in the designer-facing interface.

## Internal page model

Pages remain necessary implementation records. Each `site_page` owns:

- source page identity;
- URL/path and optional title;
- ordering within the captured version;
- full-page media object;
- child sections in source order.

The relationship enables Full-page context, source-path filtering, idempotent persistence, and deterministic object keys. Hiding Pages from primary navigation does not delete, merge, or weaken this model.

## Import architecture

### Shared control plane

Site import follows the App URL-import architecture:

- same authenticated import-dialog behavior;
- same `POST /api/jobs` endpoint;
- same `jobs` table and lifecycle states;
- same authorization and object-store readiness checks;
- same cancellation and administrative monitoring surfaces.

The Sites payload remains:

```json
{
  "type": "import-site",
  "url": "https://mobbin.com/sites/{site-id}/{version-id}/preview"
}
```

The validator accepts supported Mobbin Sites Preview, Sections, and version URLs and normalizes them to one canonical Site-version identity. Reimporting a completed canonical version opens the existing result without publishing a duplicate job. Failed versions may be retried.

If inline progress is displayed, it uses the isolated real-time worker event stream. Apps and Sites galleries perform zero periodic `GET /api/jobs` reads.

### Isolated execution plane

Apps and Sites share RabbitMQ but not a queue or crawler consumer:

```text
import-app  -> mobbin-jobs       -> import-worker
import-site -> mobbin-sites-jobs -> sites-import-worker
```

Sites retains its own:

- durable queue and dead-letter queue;
- worker service and concurrency;
- parser and pipeline handler;
- authenticated Chromium profile;
- retry and health behavior;
- worker records and progress namespace.

A Site backlog, retry storm, deployment, expired session, or worker crash must not consume App crawler capacity or alter Apps progress state.

### Site processing sequence

The Sites crawler:

1. Validates the canonical Site and version identity.
2. Captures Site/version metadata and the structured source response.
3. Upserts internal page identities and ordering.
4. Downloads preview, full-page, and section media.
5. Applies the established Screen/UI Element crop pipeline to derived section assets, including the existing source-overlay crop behavior.
6. Stores verified media through `ObjectStore`.
7. Upserts ordered sections and their parent-page references.
8. Marks the version ready only after required records and objects are consistent.
9. Marks the shared job done and publishes the final real-time event.

Individual transient asset failures retry within the Sites execution boundary. A failed newer version does not hide an already ready older version. At-least-once delivery remains safe through source-ID and object-key idempotency.

## Object storage

Sites continues using the shared `ObjectStore` abstraction with a separate key namespace:

```text
sites/{siteId}/versions/{versionId}/source.json
sites/{siteId}/versions/{versionId}/preview.mp4
sites/{siteId}/versions/{versionId}/pages/{pageId}/full-page.webp
sites/{siteId}/versions/{versionId}/pages/{pageId}/sections/{sectionId}.{ext}
```

The object store is the durable binary-media layer; PostgreSQL stores searchable metadata and object references rather than image/video bytes.

Every persisted object retains content type, byte size, hash, and access class. Raw source is internal; imported media is protected. Source delivery URLs are provenance only and must not be the sole media reference.

Crop/timing/source metadata remains attached to the section record so processing can be reproduced and audited. The designer consumes the processed section asset while Full-page context resolves through the parent page's stored capture.

## Loading, failure, and partial data

- References keeps its page shell stable during type loading and route changes.
- Gallery failures show retry within the selected type and do not affect the other type.
- Site detail failures preserve Back and Retry actions.
- Individual media failures remain local to their card or inspector.
- An importing or failed Site version does not appear as ready.
- A ready older version remains browsable while a newer version imports or fails.
- A missing optional preview recording falls back to available capture media.
- A section without full-page media can still open in Section view; Full page is disabled with a specific explanation.

## Accessibility and responsive behavior

- Type tabs and detail tabs use proper tab semantics and support keyboard navigation.
- Search, filters, version selector, carousel, media cards, and lightbox retain visible focus.
- Narrow layouts allow tabs and filters to scroll horizontally without hiding actions.
- Cards have descriptive accessible names that include the reference type and title.
- Images use meaningful labels where metadata permits; decorative identity marks remain ignored by assistive technology.
- Videos use native controls and do not autoplay with sound.
- Escape and arrow-key lightbox behavior matches Apps.
- Existing reduced-motion behavior remains effective across shared components.

## Route and compatibility strategy

The first implementation changes the navigation model without forcing a backend route migration:

- `/apps` selects References > Apps.
- `/sites` selects References > Sites.
- existing App detail routes remain unchanged;
- existing Site/version routes remain unchanged;
- legacy Site tab values for Overview or Pages resolve safely to Preview or the nearest supported state rather than rendering a broken page;
- Apps and Sites APIs remain separate.

A future `/references` route may redirect to the last-selected type, but it is not required for this release.

## Verification strategy

### Navigation and gallery

- References is the single top-level discovery item.
- `/apps` and `/sites` select the correct type tab.
- switching types preserves each type's local search/filter state.
- Apps cards and Apps detail behavior remain unchanged.
- Site cards show section counts and do not show page counts.
- both galleries perform zero `GET /api/jobs` reads.

### Site detail

- Preview is the default and fallback tab.
- only Preview and Sections are primary tabs.
- Preview renders recording or capture fallback for the selected version.
- Sections search and filters preserve deterministic results and ordering.
- the section inspector switches between Section and Full page using stored related media.
- page records and page counts are absent from primary navigation and gallery metadata.
- previous Site versions remain selectable.

### Import boundary

- Import App publishes only to the Apps queue.
- Import Site publishes only to `mobbin-sites-jobs`.
- supported Sites URL variants normalize to one canonical version.
- completed duplicate import opens the existing Site version.
- repeated queue delivery does not duplicate Site/version/page/section rows or objects.
- stopping or backing up `sites-import-worker` does not delay an Apps import.
- gallery job progress, if shown, uses real-time events rather than polling.

### Media and storage

- preview, full-page, image-section, and video-section objects resolve through authorized Astryx media URLs;
- processed section media uses the established crop behavior;
- parent full-page context resolves without exposing Pages as a primary product object;
- an individual media failure remains local;
- failed or partial versions never become ready.

### Regression and browser verification

- run focused References, Apps, Sites, shared-card, shared-detail-shell, and import contract tests;
- run the complete Node and TSX test suites;
- build the production Vitrine bundle;
- verify the imported V7 fixture in Chrome at desktop and narrow viewports;
- verify one existing App gallery and detail path after navigation changes;
- inspect network activity to confirm zero gallery `GET /api/jobs` reads;
- preserve unrelated dirty-worktree changes throughout implementation.

## Success criteria

- Designers encounter one References destination with clear Apps and Sites types.
- Apps remains behaviorally unchanged inside the shared discovery shell.
- Sites presents Preview and Sections, not a crawler-oriented Pages experience.
- A designer can find a section, inspect it alone, and view its full-page context.
- Site cards and detail headers do not advertise internal page counts.
- Page records remain available internally for context, persistence, and deterministic crawling.
- Site import continues through the shared jobs API and isolated Sites queue/worker.
- Apps imports remain unaffected by Sites worker health or queue pressure.
- Required media is served from protected Astryx object storage.
- Existing routes and imported data remain compatible through the migration.
