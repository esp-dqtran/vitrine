# Astryx Sites vs Mobbin Sites audit

Date: 2026-07-24

## Scope

Read-only comparison of:

1. Astryx `/sites` against Mobbin `/discover/sites/latest`.
2. Astryx V7 Site detail against the matching Mobbin V7 preview.

Both products were captured from the live Chrome session at the same 1512 px viewport width.

## Finding

The implementation is not a faithful Mobbin Sites clone. The original reference capture used Mobbin's Web Apps discovery route, and the resulting Astryx implementation also diverged from that reference during its final component-compliance change.

## Root causes

1. **Wrong source surface**
   - Earlier work compared against `/discover/apps/web/latest`.
   - The correct source is `/discover/sites/latest`.
   - The Sites taxonomy, card composition, and detail hierarchy are materially different from Mobbin Apps.

2. **Site cards are currently broken**
   - `SiteCard` uses the Astryx design-system `Button` as the full media/card container.
   - The Button component resolves to a fixed 32 px height. It overrides the intended `aspect-ratio: 16 / 11`.
   - Live measurement: Astryx card height 80 px and media height 32 px; Mobbin's first card height is 386.9 px and its preview is 239.9 px.

3. **The shell is different**
   - Astryx admin routes are wrapped by a 261 px left `AppShell` sidebar.
   - Mobbin uses a 72 px top navigation and gives the Sites catalog the full viewport width.
   - This changes every horizontal measurement, card width, and hierarchy.

4. **Typography and spacing were approximated**
   - Astryx taxonomy uses small inline 14 px controls and 11 px uppercase group labels.
   - Mobbin uses large stacked taxonomy links, sentence-case labels, substantially more vertical space, and heavier display typography.
   - The detail header is also composed differently: Astryx uses a horizontal logo/title row; Mobbin uses a vertical 96 px logo followed by a large two-line title/description.

5. **The backend does not store the Mobbin presentation metadata**
   - The persisted `SiteSummary` and detail contract do not include description, logo, categories, styles, or popularity.
   - The Vitrine client accepts those optional fields, but the server never supplies them.
   - The UI therefore renders placeholders such as `Website`, `Captured reference`, a letter logo, and a generated description instead of Mobbin's actual V7 metadata.

6. **The information architecture differs**
   - Astryx adds admin-only `Refresh`, `Import Site`, result count, and `Back to Sites` controls inside the cloned surface.
   - Mobbin instead uses `Filter`, saved/community/account actions, and a version selector beside Preview/Sections.
   - Astryx also displays section count in the tab label, while Mobbin's Sections tab is plain.

## Evidence

- `01-astryx-sites.png`
- `02-mobbin-sites.png`
- `03-astryx-v7-detail.png`
- `04-mobbin-v7-detail.png`
- `05-catalog-side-by-side.png`
- `06-detail-side-by-side.png`

## Evidence limits

This audit confirms the visible desktop catalog and V7 preview states. It does not claim full keyboard, screen-reader, responsive, hover-animation, or loading-state parity.
