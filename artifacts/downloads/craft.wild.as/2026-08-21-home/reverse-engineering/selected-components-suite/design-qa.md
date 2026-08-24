# Design QA

## Scope and truth source

The React suite was compared with the downloaded, locally runnable source page
at `http://127.0.0.1:4174/`. The source DOM, downloaded CSS, local assets, and
captured interaction states are the implementation truth. The five new source
roots are:

- `section#hero`
- `section#work > div.track-wrap`
- `section#process > div.wrap`
- `section#protocol-parts > div.wrap > div.reveal.in`
- `section#lab > div.track-wrap:nth-of-type(2)`

The previously verified Contact and Tetris Footer remain in the same suite.

## Normalized visual evidence

All images use CSS-pixel density: one screenshot pixel per CSS pixel. Desktop
source and implementation captures are both 1280×720 pixels at a 1280×720 CSS
viewport. Mobile comparisons are both 390×844 pixels at a 390×844 CSS
viewport. Each comparison places the source on the left and React on the right.

| Section | Desktop full-view comparison | Mobile/focused comparison |
| --- | --- | --- |
| Hero | `evidence/qa-compare-hero-source-left-1280x720.jpg` | `evidence/qa-compare-hero-source-left-390x844.jpg` |
| Work carousel | `evidence/qa-compare-work-source-left-1280x720.jpg` | `evidence/qa-compare-work-source-left-390x844.jpg` |
| Process flow | `evidence/qa-compare-process-source-left-1280x720.jpg` | `evidence/qa-compare-process-source-left-390x844.jpg` |
| Protocol parts | `evidence/qa-compare-protocol-source-left-1280x720.jpg` | `evidence/qa-compare-protocol-source-left-390x844.jpg` |
| Experiments carousel | `evidence/qa-compare-lab-source-left-1280x720.jpg` | `evidence/qa-compare-lab-source-left-390x844.jpg` |
| Cursor click burst | `evidence/qa-compare-click-burst-source-left-883x863.jpg` | `evidence/react-header-double-click-burst-883x863.jpg` |

Focused regions are represented by the section-level comparisons: the carousel
captures keep media, arrow controls, title, body copy, and tool tags readable;
the process captures keep both the canvas and all four labels readable. Separate
smaller crops were not needed.

The click-state comparison uses source on the left and React on the right at an
883×863 CSS viewport. Both screenshots are 883×863 pixels and were captured
260ms after a quick click at `(440, 420)` with device pixel ratio 2; browser
capture normalized both outputs to one screenshot pixel per CSS pixel. Because
the underlying pixel field is seeded and time-dependent, the comparison judges
the interaction morphology: click-centered deposit, expanding stepped ring,
source color bands, decay, and shake.

## Findings

No actionable P0, P1, or P2 visual or functional differences remain.

- [P3] Generative pixel topology varies between captures.
  Location: Hero, Process Flow, and Protocol Parts canvases.
  Evidence: source and React use the same grid scale, palette, density, section
  bounds, and directional composition, but time/seed-dependent cells differ.
  Impact: none to layout, readability, or interaction.
  Follow-up: retain nondeterminism; do not freeze a screenshot into the UI.

- [P3] The source global ambient field can momentarily frame the first carousel
  media tile while the isolated carousel component keeps its copy unobstructed.
  Location: Work and Experiments carousels.
  Evidence: the source mobile capture contains transient pixels around the first
  media tile; the React carousel retains the media, crop, arrows, copy, and hover
  reveal without painting pixels over text.
  Impact: minor decorative variation only.
  Follow-up: optional future polish if the global field is later made aware of
  carousel safe areas.

## Required fidelity surfaces

- Fonts and typography: passed. Local Sneak Regular/Medium files, weights,
  scale, leading, tracking, capitalization, wrapping, and centered carousel copy
  match the downloaded styles.
- Spacing and layout rhythm: passed. Desktop 56px and mobile 28px gutters,
  28px slide gaps, 350px media height, process breakpoints, and section rhythm
  match the source contract.
- Colors and visual tokens: passed. Paper, ink, muted gray, blue, yellow, red,
  neon, grid lines, tool-tag colors, and stepped hover overlays use source tokens.
- Image quality and asset fidelity: passed. The exact downloaded videos, AVIFs,
  font files, and Wild logo are local; no placeholder or hotlinked media is used.
- Copy and content: passed. All selected headings, descriptions, case-study text,
  experiment text, and tags match the downloaded DOM.
- Icons and controls: passed. Source arrow paths, stepped button silhouette,
  disabled states, semantic labels, and local Wild logo are present.
- Accessibility and reduced motion: passed. Sections have labels, buttons have
  accessible names and disabled states, media is muted/plays inline, images have
  alt text, and reduced-motion rules disable entrance animation plus click-ring
  travel and shake while retaining a static click deposit.

## Comparison and fix history

1. Consolidated the already pure-React Process Flow and Protocol Parts into the
   suite, then added React-owned Hero, Work Carousel, and Experiments Carousel.
2. First interaction pass found overly strong carousel projection: one mobile
   swipe could jump to the final slide. Momentum was capped to 35 percent of one
   step; a 390px gesture now snaps from `0` to `-379px`.
3. First mobile visual pass found the contact/footer ambient field could leave
   pixels over Experiments copy. Its deposit zone was scoped to Contact/Footer;
   the revised capture is `evidence/consolidated-react-mobile-lab-clean.jpg`.
4. Re-captured all five sections at normalized 1280×720 and 390×844 states and
   reviewed the side-by-side files listed above. No P0/P1/P2 differences remain.
5. Captured the source cursor interaction and copied its exact timing model into
   React: 2.2s charge ramp, 1.5s wave lifetime, diagonal-scaled ring expansion,
   stepped heat colors, release shake, and stronger double-click burst. The
   post-fix comparison is
   `evidence/qa-compare-click-burst-source-left-883x863.jpg`.

## Interaction and runtime verification

- Work carousel next arrow: transform changed from `0` to `-448px`; Previous
  became enabled.
- Experiments carousel next arrow: transform changed from `0` to `-448px`;
  Previous became enabled.
- Mobile Work swipe: transform changed from `0` to `-379px`, one slide.
- Process first-step hover: opacities `[1, .45, .45, .45]`; pixel line opacity `1`.
- Protocol hover, Contact button, Footer open/close, keyboard controls, rotate,
  hard drop, and replay retain their prior verified React behavior.
- Runtime ownership: all five new sections render as JSX/components and hooks;
  no dynamic scripts, `dangerouslySetInnerHTML`, or extracted runtime bundles.
- Cursor background: quick click renders the source-style local deposit and
  expanding pixel wave; double-click renders the stronger blast; interactive
  links/buttons remain excluded from charging.
- Browser console: no warnings or errors after desktop/mobile navigation and
  interaction testing.

## Build verification

- `npm run build` — passed; Vite production and Sites packaging completed.
- `npm run test:react` — 6/6; covers all selected components,
  script/HTML-injection absence, React-owned interactions, cursor charge/wave
  constants, and local source media.
- `npm run test:sites` — passed, 4/4 tests.
- `git diff --check` — passed.

## Follow-up polish

- Optional P3: add the source global carousel-edge pixel frame while preserving
  text safe areas.

final result: passed
