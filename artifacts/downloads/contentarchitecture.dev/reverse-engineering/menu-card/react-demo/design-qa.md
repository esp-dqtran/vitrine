# Design QA — responsive menu

Final result: passed

## Reference and implementation

- Source closed state: `../evidence/source-closed-crop.jpg`
- Source open state: `../evidence/source-open-crop.jpg`
- React closed state: `../evidence/implementation-closed.png`
- React open state: `../evidence/implementation-open.png`
- Combined comparison: `../evidence/source-vs-react-comparison.png`
- Desktop React viewport: `implementation-desktop-menu-full.png`
- Desktop React hover viewport: `implementation-desktop-menu-hover.png`

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Component boundary | Passed | DOM, styles, state, and events are owned by one `MobileMenuCard`; link rows are data. |
| Closed geometry | Passed | Frame is 172 × 66 px; inner panel is 160 × 54 px. |
| Open geometry | Passed | Frame is 172 × 241.5 px; inner panel is 160 × 229.5 px. |
| Visual assets | Passed | Uses the captured source logo and GeistMono font; the logo is rasterized from the source SVG for reliable external rendering. |
| Typography and spacing | Passed | 12.6/15.75 px type, 24 px header, 27.75 px link rows, and source padding/gaps. |
| Open/close behavior | Passed | Toggle, Escape, outside pointer press, and link selection all close or open the menu correctly. |
| Motion | Passed | 0.32 s menu transition, staggered link reveal, reduced-motion support, and animated 6 px status pulse. |
| Accessibility | Passed | Semantic nav/list/links, accessible toggle name, `aria-expanded`, `aria-controls`, and optional `aria-current`. |
| Runtime | Passed | Clean final browser load with no console errors. |
| Build | Passed | `npm run build` and `npm run test:sites` both pass. |
| Desktop geometry | Passed | At 1139 × 863, source and React both measure 504.21875 × 76 px at x=317.390625, y=16; inner panel, links, and 18 px announcement strip match to subpixel precision. |
| Desktop responsive branch | Passed | Desktop appears at 1024 px and above; the existing compact menu appears below 1024 px. |
| Desktop odometer | Passed | Exact recovered six-glyph columns, 520 ms cubic-bezier transition, and 28 ms character stagger render on hover/focus. |
| Desktop status and marquee | Passed | Pricing uses the source 6 px orange dot/ping; announcement text loops within the exact 480.21875 × 18 px strip. |
| Desktop runtime | Passed | Large-screen preview loads with no console warnings or errors. |

No P0, P1, or P2 visual or interaction issues remain.
