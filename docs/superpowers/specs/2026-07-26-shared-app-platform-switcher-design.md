# Shared App Platform Switcher Design

## Goal

Use one Web/iOS/Android platform switcher in both the Apps catalog and App detail views, and make the App detail identity icon more prominent.

## Design

Extract the existing Apps catalog pill into `AppsPlatformSwitcher`. The component owns the shared visual treatment, labels, radio semantics, keyboard navigation, and animated active indicator. Consumers continue to own platform state and data loading.

The Apps catalog renders all three platforms in the existing Web, iOS, Android order. App detail passes only the platforms reported by the selected app, so unsupported platforms remain hidden. Selecting a detail platform continues to clear the selected version and lightbox through the existing `selectPlatform` callback.

## Scope

- Reuse the component in `AppsDiscoveryPage` and `ScreenDetail`.
- Preserve current Apps catalog filtering and hover-preview cleanup.
- Preserve App detail URL synchronization, section data loading, and platform availability rules.
- Keep the existing Apps switcher appearance and motion.
- Increase only the App detail hero icon from 96px to 120px on desktop and from 64px to 80px on mobile.
- Do not alter Site detail or admin-only detail tabs.

## Verification

- A focused component test covers labels, supported-platform filtering, and active radio state.
- Source-boundary tests prove both consumers use the shared component.
- Existing Apps discovery and Screen detail tests pass.
- The production build succeeds.
- Browser QA verifies the switcher on the requested App detail route.
