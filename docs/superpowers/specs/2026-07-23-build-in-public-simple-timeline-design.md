# Build in Public: Simple Timeline Design

## Goal

Replace the current card-heavy Build in Public page with a single, immediately readable project timeline. Visitors should understand what Astryx has shipped, what is being built now, and what comes next without scanning unrelated statistics or promotional sections.

## Visual direction

The page follows the compact milestone rhythm seen in Linear's milestone flow: dates and status sit beside one continuous vertical rail, while milestone content remains lightweight and secondary to chronology.

The page contains only:

- the existing minimal public navigation;
- a small page title, one-sentence introduction, and last-updated date;
- one vertical timeline;
- compact milestone entries with date, status, title, and description.

The current hero treatment, catalog snapshot, promotional buttons, closing call to action, decorative glow, and footer are removed.

## Timeline states

- **Shipped:** muted text with a completed check marker.
- **Building now:** the only strongly emphasized item, using the product accent color and a subtle highlight behind its content.
- **Up next:** neutral text with an outlined marker.
- **Exploring:** quieter neutral treatment with a dashed marker.

The rail remains continuous so the page reads as one journey rather than a stack of cards. Entries have no borders, shadows, pills, or independent card containers.

## Responsive behavior

On desktop, dates occupy a narrow left column and content occupies the right column. On small screens, the date moves above each milestone title while the rail remains on the left. The current milestone stays visually prominent at every width.

## Content and behavior

The existing roadmap content and public navigation callbacks remain unchanged. The completed crawl milestone retains its catalog evidence in plain supporting text rather than badges. No new data loading, interactions, or routes are introduced.

## Accessibility

The timeline remains an ordered list. Status meaning is written as text instead of communicated only by color. Decorative rail and marker details are hidden from assistive technology, and the existing semantic headings remain.

## Verification

- A focused component test verifies the minimal page structure and removal of the snapshot and promotional sections.
- Existing route and navigation tests remain green.
- The full test suite and production build pass.
- Browser verification covers desktop and narrow mobile layouts at `/build-in-public`.
