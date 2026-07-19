# Admin Users Redesign QA

- Source visual truth: `docs/superpowers/specs/assets/2026-07-19-admin-users-option-2.png`
- Implementation screenshot: `docs/superpowers/specs/assets/2026-07-19-admin-users-implementation.png`
- Side-by-side comparison: `docs/superpowers/specs/assets/2026-07-19-admin-users-comparison.png`
- Desktop viewport: 1440 × 1024
- Narrow viewport: 390 × 844
- State: signed-in admin, Users surface, All members selected, no search query

## Full-view comparison evidence

The side-by-side artifact compares the complete selected mock with the complete browser-rendered implementation at the same desktop frame. The implementation preserves the selected member-first split, quiet list rows, compact search/filter bar, vertical divider, and narrow Growth pulse. The implementation intentionally replaces the mock's unsupported invitation, subscriber, and activity concepts with the real administrator/member groups and account fields available from `/api/users`.

## Focused evidence

A separate desktop crop was not needed because the 1440 × 1024 source and implementation remain legible in the full-view comparison and both originals were inspected at native resolution. The narrow browser capture `admin-users-narrow-final.png` was inspected separately because responsive row wrapping, shell clearance, and control stacking cannot be judged from the desktop frame.

## Comparison history

### Pass 1

- [P2] Header member count used `growth.stats.total_users`, which disagreed with the eight loaded users in the live API response.
  - Fix: derive the directory header count from `users.length`; retain the growth API value only in Growth pulse.
- [P2] The member count sat at the far right of the header instead of directly under the description as shown in the selected visual.
  - Fix: move the count into the title stack and reduce it to supporting-text weight.
- [P2] At 390px, the mobile shell obscured the Users heading.
  - Fix: reserve 72px top padding at the phone breakpoint and add a CSS contract test.
- [P3] Multi-letter initials created noisier avatars than the selected visual.
  - Fix: use one deterministic uppercase initial.

### Pass 2

- Desktop browser capture matches the selected layout hierarchy with no actionable P0, P1, or P2 differences.
- Mobile heading is visible at 121px from the viewport top, controls stack, Growth pulse follows the directory, and `scrollWidth === clientWidth` at 390px.
- Search by email, Administrators, Pro, Free, Disabled, and Clear filters were exercised in the live page. The controls update the current in-memory user set without navigation.
- Browser console error check returned zero errors.

## Required fidelity surfaces

- Fonts and typography: Uses the existing Figtree stack. Display, section, row, metadata, and metric weights preserve the source hierarchy; dense row text remains 12–14px and the page title remains the only display-sized text.
- Spacing and layout rhythm: Desktop uses the approved two-to-one directory/Growth pulse split, 36px column separation, thin list rules, and no nested cards. Phone spacing keeps the title clear of the shell and avoids horizontal overflow.
- Colors and visual tokens: Existing Astryx body, surface, text, border, and accent tokens are reused. Blue remains the primary accent; restrained avatar tones and semantic green state dots are the only supporting colors.
- Image quality and asset fidelity: The selected screen contains no raster content beyond the existing Vitrine mark. No placeholder imagery, custom SVG, emoji, gradient, or CSS illustration was introduced.
- Copy and content: Title, description, search, filters, group labels, and Growth pulse copy match the selected intent. Unsupported mock data was not fabricated; every displayed member attribute comes from the current API or a deterministic formatting helper.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- [P3] The selected mock uses decorative metric icons. They were omitted because the current project has no matching UI icon dependency and the metrics remain equally understandable without them.
- [P3] The live list is longer than the mock because all eight real users are rendered; this is an intentional product-data difference.

## Implementation checklist

- [x] Match selected desktop hierarchy.
- [x] Use only real API fields.
- [x] Make search, filters, and clear action functional.
- [x] Preserve accessible labels and color-independent status text.
- [x] Verify desktop and phone layouts without horizontal overflow.
- [x] Check browser console errors.
- [x] Pass focused tests and production build.

final result: passed
