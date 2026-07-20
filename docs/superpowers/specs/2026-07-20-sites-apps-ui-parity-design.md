# Sites and Apps UI Parity Design

**Date:** 2026-07-20
**Status:** Approved for implementation planning

## Goal

Reorganize the Astryx Sites gallery and Site detail experience so they use the same visual system and interaction patterns as Apps. Apps remains the source of truth for layout, animation, cards, navigation, loading states, media browsing, and responsive behavior.

This is a presentation-layer reorganization. It must not change Mobbin Sites import behavior, the isolated Sites RabbitMQ queue, the Sites worker, object storage, canonical URL handling, job submission, or routing.

## Product Decisions

- Apply Apps UI parity to both the Sites gallery and the Site detail page.
- Site gallery cards preview page screenshots, not the imported preview video.
- Reuse shared UI primitives extracted from Apps instead of converting Sites into fake App records or copying Apps styles into a second implementation.
- Preserve Site-specific information architecture: Sites contain versions, pages, sections, images, and videos; they do not gain Apps-only concepts such as platforms, flows, UI elements, design-system review, or Figma export.

## Architecture

### Shared preview-card foundation

Extract the visual and interaction foundation of the current Apps card into a shared preview-carousel component. It owns:

- the `16 / 10` card frame;
- responsive sizing and offscreen rendering optimization;
- fade-in and hover-lift animation;
- preview track, arrows, pagination dots, and lazy activation;
- label pill, overlay, shadows, and accessible click target;
- per-preview image fallback behavior.

`AppCard` remains an App-specific adapter. It supplies App screens, icon, accent, progress status, and Apps copy without changing current behavior.

`SiteCard` becomes the Sites adapter. It supplies up to five ordered full-page screenshots, Site name, version label, page count, and section count. The whole card opens the existing Site version route.

### Shared detail shell

Extract the reusable presentation shell from the current Apps `ScreenDetail` experience. The shell owns:

- entrance and section-transition animation;
- back action;
- identity mark, title, metadata, and hero actions;
- horizontally scrollable tab navigation and active indicator;
- responsive content widths and backgrounds;
- shared loading, error, and empty-state placement;
- media-grid and lightbox presentation primitives.

Apps continues supplying its existing platform, version, section-data, design-system, export, and review behavior. The extraction must not alter Apps routes, tabs, data loading, filters, entitlement gates, or actions.

Sites supplies Site-specific metadata and tabs through a dedicated Site detail composition. Sites must not reuse the Apps domain types or data hooks.

### Sites list payload

Extend each ready Site summary with an ordered, bounded page-preview collection containing at most the first five pages. Each preview contains the page identifier, title, position, and existing full-page media URL.

The list query remains a single Sites request. The UI must not fetch each Site detail individually to build cards, and it must not read `GET /api/jobs`.

No new media objects are created. Preview URLs point to the already stored full-page page images.

## Sites Gallery

The Sites gallery uses the same page proportions and structure as Apps:

- existing `Sites` page header and admin-only import action;
- Apps-style sticky search treatment;
- count row and responsive card grid;
- Apps-style skeleton cards during initial loading;
- shared preview-carousel cards with hover controls and animation;
- retry and empty states inside the stable page shell.

Search is local to the loaded ready Sites collection. It matches Site name, version label, and preview page titles. The count row reflects the filtered collection while retaining the ready-Sites total where useful.

A Site card:

- displays up to five page screenshots ordered by page position;
- defers screenshots after the first until interaction, matching Apps;
- shows Site identity and concise version/page/section metadata;
- remains useful with one preview or with a failed preview image;
- opens `/sites/:siteId/versions/:versionId` from the whole accessible card target.

## Site Detail

The Site detail page uses the shared Apps detail shell while preserving Site semantics.

### Hero

The hero contains:

- `Back to all sites`;
- a stable Site identity mark;
- Site name;
- version label;
- page count;
- section count;
- `Visit site` when a source website URL is available;
- admin-only `Import Site`.

### Tabs

The tabs are:

1. **Overview** — imported preview video plus Site/version summary.
2. **Pages** — Apps-style screenshot grid of every ordered full-page capture.
3. **Sections** — ordered media grid of all Site sections with page and media-kind filters.

The active tab uses the same indicator, URL-safe state behavior, transition timing, and responsive horizontal scrolling as Apps. If tab state is added to the Site URL, the existing Site/version route remains the stable base and unknown tab values resolve to Overview.

### Pages

Each page card uses the shared Apps screenshot-card treatment with the page title as its label. Selecting a page opens the shared keyboard-accessible media lightbox. Page position from the imported source determines display order.

### Sections

Sections retain their source page and source order. The user can filter by page and by media kind (`All`, `Images`, or `Videos`).

- Images render through the shared media-card and lightbox treatment.
- Videos use native controls, the stored poster when present, and existing media URLs.
- OCR counts and crop/timing metadata may support internal labels, but raw OCR text is never dumped into the interface.

## Loading, Error, Empty, and Media Failure States

- The Sites gallery shows Apps-style card skeletons during initial loading.
- The detail shell renders before detail content resolves, with a matching hero/content skeleton.
- A list failure keeps the page shell visible and provides Retry.
- A detail failure keeps a stable detail frame and provides Back and Retry.
- Failed individual images or videos show a local fallback without breaking the gallery, tab, or remaining media.
- Sites, Pages, and Sections each have a specific compact empty state.
- Changing tabs or filters does not refetch unrelated content or access the Jobs API.

## Responsive and Accessibility Requirements

- Match Apps gallery breakpoints and fluid card columns.
- Keep hero metadata and actions usable on narrow screens.
- Allow tab and filter rows to scroll horizontally without hiding controls.
- Preserve visible focus, button labels, card accessible names, tab semantics, and keyboard navigation.
- Support Escape to close the lightbox and arrow keys to move through ordered media.
- Native video controls remain keyboard accessible.
- Respect the current motion behavior and reduced-motion support of the shared Apps primitives.

## Data and Runtime Boundaries

The following remain unchanged:

- Mobbin Sites URL parsing and canonicalization;
- duplicate-ready URL behavior;
- `POST /api/jobs` submission architecture;
- `mobbin-sites-jobs` and its dead-letter queue;
- the isolated Sites worker and crawler;
- object-store keys, media validation, and watermark crop behavior;
- Site/version persistence and existing media endpoints;
- Apps job behavior, including zero Apps-screen `GET /api/jobs` reads.

Only the ready-Sites summary response expands to include bounded page-preview descriptors needed by the gallery.

## Testing Strategy

### Shared components

- preview carousel renders the first item eagerly and later items only after activation;
- carousel caps previews at five, wraps arrows correctly, and exposes accessible controls;
- image failure stays local to its preview;
- detail tabs, active indicator, and media lightbox retain keyboard behavior.

### Apps regression boundary

- Apps cards retain current labels, status badges, hover overlay, preview order, and lazy behavior;
- Apps gallery layout and detail tabs remain unchanged;
- Apps routes, detail sections, entitlement behavior, and data hooks remain unchanged;
- Apps screen still performs zero `GET /api/jobs` reads.

### Sites gallery

- ready Site summaries parse bounded ordered page previews;
- Site cards display screenshot previews rather than the preview video;
- search matches Site name, version label, and page title;
- filtered and total counts are correct;
- empty, loading, failure, and retry states remain accessible;
- import remains URL-only and admin-only.

### Site detail

- hero metadata and actions map to Site data correctly;
- Overview renders the preview video;
- Pages preserve page order and open the lightbox;
- Sections preserve page/section order and filter by page/media kind;
- images, native videos, and posters use existing media endpoints;
- raw OCR text remains absent from rendered markup;
- unknown tab state falls back safely.

### Verification

- run focused Apps and Sites UI tests;
- run the complete test suite;
- build the production Vitrine bundle;
- verify the existing imported V7 Site in the browser on both gallery and detail views;
- verify Apps gallery and one App detail in the browser after extraction;
- confirm no Apps or Sites gallery request reads `GET /api/jobs`;
- preserve unrelated dirty-worktree changes outside the scoped implementation.

## Out of Scope

- changing the Sites import dialog contract;
- recrawling or rewriting imported Site media;
- adding Site collections, billing gates, design-system extraction, Figma export, or curator review;
- adding Sites background-job polling;
- changing Apps product behavior while extracting shared presentation components;
- redesigning navigation, authentication, the global App shell, or crawler administration.
