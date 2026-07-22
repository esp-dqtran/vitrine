# GetDesign-Style Design System Preview

## Goal

Replace the metadata-heavy Astryx design-system panel with a specimen-first web styleguide modeled on the approved GetDesign Binance example, while continuing to render every existing observed and imported `DesignSystemSnapshot`.

## Approved interaction model

- The panel opens on `Preview`.
- A sibling `DESIGN.md` tab exposes a developer-readable document generated from the loaded snapshot.
- `Light` and `Dark` controls change the complete specimen canvas, not only component rows.
- The preview uses numbered sections and renders color, typography, spacing, radius, border, effect, component, and pattern specimens.
- Tokens pair a visual specimen with a readable name, raw value, and role.
- Components appear in a generous preview stage with realistic visible labels; extracted descriptions and evidence remain available as supporting metadata.
- Existing empty and loading states remain source-neutral.

## Architecture

The implementation stays inside `DesignSystemPanel.tsx` plus scoped CSS in `styles.css`. No database or importer changes are required. A pure `designSystemMarkdown(snapshot)` formatter derives the secondary document from the same snapshot, which means all 44 currently imported systems work without re-importing data.

## Data and states

`DesignSystemPanel` continues to receive a snapshot and status. It owns two local controls: active view (`preview` or `markdown`) and canvas theme (`light` or `dark`). Preview sections are included only when their corresponding data exists. Markdown contains summary, grouped tokens, components and variants, and rules; it never invents missing states or evidence.

## Visual rules

- Preserve Astryx navigation and surrounding shell.
- Use a contained styleguide canvas with a strong header and compact controls.
- Use the selected design system's extracted colors only inside specimens; the Astryx application chrome remains neutral black and white.
- Prefer broad section rhythm and legible specimen rows over dense cards.
- Avoid logos, imagery, and decorative assets because the source snapshot does not provide them.

## Accessibility and responsiveness

- Tabs and theme controls are real buttons with `aria-pressed` state.
- The markdown document is selectable text in a scrollable `pre` block.
- Grids collapse naturally below tablet width and controls wrap without clipping.
- Color swatches retain text labels and values; meaning never depends on color alone.

## Acceptance criteria

1. Preview is the default view and `DESIGN.md` can be selected.
2. Light and Dark change the entire specimen canvas.
3. Imported systems render grouped visual specimens without evidence UI noise.
4. Observed systems retain evidence, confidence, and review metadata.
5. Component variants show recognizable, readable previews rather than blank reconstruction boxes.
6. Existing loading and empty states continue to work.
7. Targeted tests, the full test suite, the production build, and browser visual QA pass.
