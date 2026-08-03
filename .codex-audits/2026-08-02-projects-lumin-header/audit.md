# Projects header comparison

## Scope

Compare the Astryx Projects workspace header with Lumin's workspace header at the same responsive browser size, then update only the header and its Team-menu anchor.

## Evidence

1. `01-lumin-header.png` — Lumin desktop header.
2. `03-lumin-responsive-header.png` — Lumin responsive header at the user's viewport.
3. `04-astryx-before-867.png` — Astryx header before the update at the same viewport.

## Findings

- Lumin uses a single-row white app bar with a compact brand and utility actions. Astryx used stacked workspace identity copy, which made the bar read like page content.
- Lumin keeps workspace identity and switching inside its navigation surface. Astryx repeated that identity in both the header and Team drawer.
- Astryx's labeled Team-menu trigger was clearer for assistive technology than Lumin's unlabeled workspace avatar, so that label should be preserved.
- The Team drawer must stay anchored to the responsive header height after the header changes.

## Recommendation

Use a 64px desktop and 72px responsive app bar, keep the hamburger as the labeled Team-navigation trigger, show the Astryx brand, add responsive project search and compact utility controls, and keep Team identity inside the drawer.

## Result

- The header is now a single white responsive app bar with Lumin-matched 16px edge spacing at the reviewed 867 x 855 viewport.
- Project search expands from the utility icon, filters the active Personal or Team scope, and provides a clear no-results state.
- The Team drawer opens directly below the 72px responsive header and retains its accessible name, expanded state, focus handling, and Escape behavior.
- Final comparison: `12-header-final-side-by-side.png`.
- Final Team navigation state: `13-team-menu-after.png`.
