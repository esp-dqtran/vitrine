# Detail Tabs Lighthouse Performance Design

**Date:** 2026-07-27
**Status:** Approved for implementation

## Goal

Bring every authenticated App and Site detail tab to a repeatable mobile
Lighthouse Performance score of 99 while preserving the existing tab sets,
authorization, evidence fidelity, inspectors, exports, review tools, and
responsive detail-shell presentation.

The measured admin superset is:

- Apps: Overview, Screens, UI Elements, Flows, Design System, Export, Review.
- Sites: Preview, Sections, Analysis.

The normal-user subset remains:

- Apps: Screens, UI Elements, Flows.
- Sites: Preview, Sections.

## Measured causes

- App Screens and UI Elements render 48 full-resolution evidence images even
  though every record already exposes a thumbnail URL. Each initial view
  transfers about 25.4 MB.
- App Flows renders every full-resolution step image for the first 24 Flow
  cards. The initial view transfers about 20.3 MB.
- Every Site detail fetches the complete Sites catalog for three related cards.
  That response is about 347 KB and activates a related full-page image of
  about 3.44 MB even on Analysis.
- Site Sections mounts every video source and poster immediately. Repeated
  page-level posters receive independently signed URLs, so the same large
  object can download more than once.
- The authenticated route waits for `/auth/me`, then loads App metadata, then
  discovers the remote identity image. That serialized chain makes the small
  identity image the LCP around 4.5 seconds on otherwise light tabs.
- Shared detail chrome fails contrast, accessible-name, link-name, and
  occasional heading-order audits.

## Design

### Shared authenticated detail bootstrap

The route entry starts the current detail metadata request while authentication
is resolving and reuses that in-flight result when the authenticated App
surface mounts. This removes one serial request boundary without weakening the
private route policy.

The detail identity retains a fixed-size fallback. Its real image is prioritized
when it is part of the initial hero. The fallback prevents layout shift and
preserves a meaningful identity when remote media is unavailable.

### App evidence tabs

Screens and UI Elements render the existing thumbnail URL in gallery cards.
Opening a card continues to use the full evidence URL in the lightbox.

Hydrated Flow evidence exposes both `imageUrl` and `thumbnailUrl`. Flow gallery
strips render thumbnails, while selected Flow inspectors and prototypes retain
the full image. The initial Flow gallery renders a smaller bounded group and
appends more near the viewport.

### Site detail tabs

Related Sites use the bounded public Sites response and request only enough
records to produce three results after excluding the current Site.

Related-card media is inactive until pointer/focus intent. The identity and copy
remain visible, so short text tabs do not download multi-megabyte decorative
previews.

Site section cards activate image, poster, and video media only near the
viewport. A stable placeholder keeps geometry and interaction intact. Video
playback observation begins only after the media element exists.

### Accessibility

The shared brand link receives an explicit accessible name. Search-trigger
names include their visible label. Related Site links use a name containing
their visible text. Shared action and metadata colors meet WCAG AA. Empty
states use the correct heading level for their surrounding section.

## Compatibility boundaries

- Detail routes stay private.
- The current normal-user and admin tab sets do not change.
- Full-resolution evidence remains available in lightboxes, inspectors, and
  selected Flow workspaces.
- Existing cursor, version, platform, selection, and analysis route state is
  preserved.
- Browsers without `IntersectionObserver` activate visible media immediately.
- No new polling is introduced.

## Verification

- Every behavior change starts with a focused failing test.
- Run focused App, Flow, Site, route, and accessibility tests.
- Run the complete test suite and production build.
- Exercise every admin tab and normal-user tab subset in the browser.
- Run three clean standard-mobile Lighthouse audits per admin tab.
- Required median per tab: Performance 99, Accessibility 100, Best Practices
  100, SEO 100, with no runtime errors or run warnings.
