# Generic Discovery Card Design

## Goal

Use one generic visual shell for the Apps and Sites discovery cards while preserving each catalog's distinct media and interaction behavior.

## Component boundary

Create `DiscoveryCard`, a presentational component responsible for:

- The semantic outer card and optional full-card link.
- Shared media, identity, logo, title, description, and optional metadata slots.
- Shared discovery-card class names and layout styling.
- Passing through card-specific event handlers and data attributes.

`AppCard` continues to own screenshot selection, carousel arrows, status badges, keyboard activation, and App navigation. `SiteCard` continues to own video playback, image/video fallback behavior, and Site navigation.

## Visual behavior

Both cards use the existing Sites card shell: a 24px rounded bordered surface, inset media, shared identity spacing, and subtle media scaling on hover or keyboard focus. Apps retain contained portrait screenshots rather than cropping them like website previews.

## Testing

Focused server-render tests verify that both cards render the generic shell. Existing tests continue to verify App preview behavior and Site link/media behavior. CSS assertions verify the shared card shell and the App-specific contained media override.
