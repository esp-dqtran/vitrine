# Responsive menu reconstruction

This component was reconstructed from the downloaded site implementation, not inferred from a screenshot alone. It now includes both the compact menu and the distinct large-screen navigation selected by the user.

## Evidence used

- The live DOM established the semantic boundary, dimensions, ARIA state, link destinations, and open/closed structure.
- Computed styles established the 160 px panel, 6 px dither frame, typography, spacing, colors, borders, and responsive presentation.
- The downloaded JavaScript bundle established the state model and original behavior: open/closed React state, outside-click and Escape handling, 0.32 s menu animation, staggered link animation, reduced-motion handling, and current-link state.
- The original inline logo and captured Geist Mono font are reused as assets.
- The source screenshots in `../evidence/` are visual regression references only.
- The desktop source DOM established a 1024 px breakpoint and an exact 504.21875 × 76 px frame at the selected 1139 × 863 viewport.
- The downloaded source supplied the six-glyph odometer sequence for every character, including the 520 ms easing and 28 ms per-character hover stagger.

## Component inference

`MobileMenuCard` and `DesktopMenuCard` are the two responsive branches because the source changes both structure and interaction at the breakpoint. Link rows remain data rather than separate public components. The dither frame, announcement marquee, odometer label, and Pricing status pulse are internal visual primitives.

The normalized model is recorded in [`ui-ir.json`](./ui-ir.json) before React generation. This preserves the distinction between source analysis and framework output.

## Intentional adaptation

The clean components do not retain the original site's CMS or page-section observer dependencies. Link data and `onNavigate` are explicit inputs. The structure, styling, responsive switch, accessibility behavior, and motion remain faithful to the observed source.
