# Sign-in Showcase Real Data Design

## Goal

Make the desktop sign-in showcase faithfully represent catalog data:

- use each app's real icon when available;
- show the full preview screenshot without cropping;
- hide the top-right type badge when the catalog value is `Unclassified`;
- preserve meaningful classified screen types.

## Scope

This change is limited to the showcase rendered inside
`data-sign-in-showcase="true"`. It does not change shared app cards, catalog
API behavior, authenticated galleries, carousel timing, or animation.

## Data flow

`Showcase` continues to load public catalog data through
`useCatalogPreview(8)`. The existing preview mapper already exposes an app's
`iconUrl`; the sign-in slide mapping will retain that value alongside the app
name, accent, screen type, and preview URL.

The static `SHOWCASE` fallback remains supported. Its slides may omit an icon,
in which case the existing accent-colored square remains the fallback.

## Rendering

`SlidePlaceholder` renders preview screenshots with `object-fit: contain` so
the entire captured screen remains visible. The existing dark card and accent
gradient provide a neutral background around screenshots whose aspect ratios
do not match the showcase frame.

The bottom-left app pill renders the active slide's real `iconUrl` as an image.
If the URL is absent or the slide is a static fallback, it renders the current
accent-colored square.

The top-right type badge renders only when the active type is meaningful. A
case-insensitive, whitespace-trimmed value of `Unclassified` is treated as
missing. Other types, such as `Dashboard` or `Sign in`, remain visible.

## Failure behavior

Missing catalog data still falls back to `SHOWCASE`. Missing app icons still
fall back to the accent square. This change does not add new network requests
or alter catalog fetch failure handling.

## Verification

Focused tests will verify:

1. Real catalog app icons survive the preview-to-slide mapping and appear in
   the active app pill.
2. Showcase screenshots use `object-fit: contain`.
3. `Unclassified` does not render in the top-right badge.
4. A meaningful real screen type still renders.
5. Existing sign-in and embedded-login behavior remains intact.
