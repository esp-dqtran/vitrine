# Mobbin Sites Fidelity Rebuild

## Goal

Rebuild Astryx Sites around the current Mobbin Sites catalog and Site-version
experience while preserving Astryx authentication, imports, stored media, and
section analysis.

## Reference

- Catalog: `https://mobbin.com/discover/sites/latest`
- Detail: the captured V7 Site-version preview
- Visual evidence: `artifacts/design-audit/2026-07-24-sites-comparison/`

## Catalog

- Use a full-width, 72px top navigation instead of the admin side shell.
- Keep Apps, Sites, search, saved/account controls, and a compact admin import
  action in the top navigation.
- Present Categories, Sections, and Styles as sentence-case editorial link
  groups with Mobbin's scale and spacing.
- Use the captured Mobbin taxonomy:
  - Categories: Portfolio, Lifestyle, Finance, Business, Shopping
  - Sections: Pricing, How It Works, About, Social Proof, FAQ, 404, Blog, Hero,
    Showcase, Footer
  - Styles: Minimal, Dark, Photography, Motion, Colorful
- Keep Latest and Most popular ordering and one compact Filter action.
- Render each Site as one semantic, full-card link with a large 16:11 preview,
  status badge, logo, name, description, and version/section metadata.

## Detail

- Use the same full-width Sites navigation.
- Stack the 96px Site logo above a large `Name — description` title.
- Show category/style metadata as navigable filter links.
- Keep Save, Visit site, version selection, Preview, and Sections.
- Remove the visible Back control and numeric count from the Sections tab.
- Match Mobbin's wide preview stage, centered preview video, neutral background,
  padding, and responsive behavior.
- Preserve Astryx's section search, filters, selection, inspector, and related
  Site references below the primary experience.

## Metadata

Persist metadata already present in Mobbin's Site-version payload:

- tagline as description
- logo image URL
- styles
- aggregate section popularity

Categories remain empty when Mobbin's inspected Site-version payload does not
provide a category. The UI must not fabricate a category or style.

## Accessibility and Behavior

- Cards are keyboard-focusable links with real route URLs.
- Tabs keep tab semantics.
- External visit action opens safely in a new tab.
- Search, sorting, taxonomy filters, version switching, preview/sections tabs,
  and admin import remain functional.
- The layout collapses to two columns and then one column at smaller widths.

## Acceptance Criteria

- Sites routes do not render inside the admin `AppShell`.
- No design-system `Button` is used as the rich Site card container.
- The V7 card is no longer constrained to 32px media height.
- The catalog and V7 detail match the captured Mobbin reference at the same
  desktop viewport without P0 or P1 visual issues.
- Focused Sites, source-decoding, store, API parser, migration, and build checks
  pass.
- `design-qa.md` records a passed side-by-side comparison.
