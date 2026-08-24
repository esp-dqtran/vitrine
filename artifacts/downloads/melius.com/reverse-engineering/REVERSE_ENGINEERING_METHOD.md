# Component-first website reverse engineering

Use this process for every downloaded site. The downloaded capture—not a live
page screenshot—is the source of truth.

## 1. Capture and serve the source

- Download the page HTML, stylesheets, JavaScript chunks, fonts, media, SVGs,
  and network assets.
- Serve the download locally so the original DOM, CSS, and JavaScript can be
  inspected without relying on the live site.
- Capture desktop and mobile reference states before implementation.

## 2. Build an evidence inventory

For each candidate component, record:

- source DOM selector and relevant HTML;
- CSS classes, computed layout, fonts, colors, and assets;
- JavaScript owner and interaction state machine;
- required breakpoints and states; and
- a verification status.

Do not treat a screenshot or a final visual state as enough evidence when the
downloaded source exposes DOM, CSS, or JavaScript evidence.

## 3. Reverse engineer in this order

1. **Primitives** — text styles, links, buttons, toggles, icons, logos,
   checkboxes, and input controls.
2. **Composites** — announcement bars, headers, cards, menus, and form groups.
3. **Sections** — hero, carousel, pricing, FAQ, footer, and other page regions.
4. **Page assembly** — compose only components already verified at their own
   level.

A composite cannot be marked verified while one of its primitives is still an
approximation. A section cannot be marked verified while one of its composites
is still unverified.

## 4. Reproduce behavior, not only appearance

Read the downloaded JavaScript for every interactive component. Recreate the
observed state machine in React rather than replacing it with an instant
boolean show/hide.

For example, Melius's header menu uses a Radix Accordion:

- trigger `aria-expanded` and `data-state` values;
- mounted content lifecycle during expansion and collapse;
- measured content-height CSS variables; and
- `accordion-down` / `accordion-up` height keyframes lasting 300ms with
  `cubic-bezier(.76, 0, .24, 1)`.

The React `MenuToggle` and `AccordionContent` primitives were built from this
source evidence, not from the final screenshot alone.

## 5. Verify each required state at each breakpoint

For every component, compare the local React component against the served
download at the same viewport and state:

- desktop reference viewport;
- mobile reference viewport; and
- every interactive state: closed/open, idle/active, collapsed/expanded,
  loading/complete, and hover/focus where visible.

Record concrete measurements when available. For the Melius header, the source
and reconstruction match at:

| Viewport | Closed panel | Open panel |
| --- | --- | --- |
| 1280 × 720 | `x=16 y=56 w=230 h=42` | `x=16 y=56 w=230 h=242` |
| 390 × 844 | `x=12 y=52 w=140 h=42` | `x=12 y=52 w=366 h=362` |

Only mark the component verified after its visual geometry and interaction
behavior have both been compared. Keep remaining work explicitly marked as
analysis captured, in progress, or pending visual QA.
