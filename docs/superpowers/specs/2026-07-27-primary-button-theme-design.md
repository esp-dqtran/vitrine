# Vitrine Primary Button Theme

## Goal

Make every true primary action readable and consistent on Vitrine's black
background by rendering it as a white button with black content.

## Approved treatment

- Target shared Vitrine buttons that emit `data-variant="primary"`.
- Use a white background and white border with black text and icons.
- Use a subtle light-gray background on hover and active states.
- Keep the component's existing height, padding, radius, typography, loading,
  focus, and disabled behavior.
- Keep secondary, ghost, destructive, selected-tab, and media-overlay controls
  unchanged.
- Remove narrower App-detail rules that currently force primary actions back to
  black with white text.

## Implementation

Define the treatment once in `src/vitrine/styles.css`, after the shared theme
tokens and before narrower component layout rules. Existing Flow-specific white
button declarations may remain when they also define component geometry, but
the shared theme rule owns the colors.

## Verification

- Add a CSS regression assertion for the shared primary selector and colors.
- Confirm App-detail and Flow primary actions compute to a white background and
  black text.
- Verify hover, disabled, and focus-visible states remain legible.
- Run the Vitrine test suite and production build.
