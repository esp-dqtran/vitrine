# Problem section evidence

Component IDs: `problems-section`, `problems-terminal`, `problem-row`,
`problems-copy`.

## Downloaded evidence

- Exact section invocation, responsive classes, eleven terminal rows, footer,
  heading, and rich-text content:
  `../../../2026-08-18T09-36-04-737Z/raw.html`.
- `Terminal`, module `64871`, including row construction, numbering, timing,
  viewport entry gate, invisible geometry reserve, tag reveal, editable final
  state, accessible text, cursor, and reduced-motion branch:
  `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`.
- `PullWindow`, module `106104`, and `TerminalWindow`, module `440669`, including
  header-only dragging, zero constraints, `0.2` elasticity, disabled momentum,
  spring return, dashed boundary feedback, dither frame, shell, and body:
  `../../../2026-08-18T09-36-04-737Z/network-assets/48ef6040a1f791a105273355.js`.
- Responsive `caption-10`, `headline-10`, and `body-20` tokens:
  `../../../2026-08-18T09-36-04-737Z/assets/d2ed906b7813000307abcbd3.css`.
- Responsive line splitting and reduced-motion text rendering use the recovered
  `AnimatedText` implementation documented by `main-hero.md`.

## Reconstructed component tree

```text
ProblemSection
├── Terminal
│   ├── PullWindow
│   │   ├── dashed drag boundary
│   │   └── TerminalWindow
│   │       ├── drag handle / title
│   │       └── 13 terminal rows
│   │           ├── 11 numbered problem rows
│   │           ├── blank row
│   │           └── footer row
└── copy
    ├── AnimatedText heading
    └── two AnimatedText rich-text blocks
```

Implementation:

- `react-demo/src/components/ProblemSection.jsx`
- `react-demo/src/recovered/terminal/Terminal.jsx`
- `react-demo/src/components/PullWindow.jsx`
- `react-demo/src/recovered/text/AnimatedText.jsx`
- `react-demo/src/page.css`

## Geometry verification

At `390 x 844`, the local React reconstruction matches the hydrated reference
for the layout flow:

- section origin and padding: `y=1222.9375`, `72px` block padding;
- grid: `390 x 631.5859375`, `16px` inline padding and `32px` row gap;
- copy: `x=16`, `358 x 310.28125`;
- heading lines: `The page builder` / `alone costs you days.` /
  `Every single time.`;
- rich text: `x=16`, `358 x 172.0390625`;
- terminal column: `x=16`, `358px` wide;
- terminal shell: `x=22`, `346px` wide with a `26px` header.

At `1159 x 863`, the local reconstruction matches the hydrated reference for:

- section: `1159 x 673.5625`, with `160px` block padding;
- grid and both columns: `353.5625px` high;
- terminal column: `x=0`, `473.578125px` wide, `100px` left padding;
- terminal shell: `x=108`, `357.578125px` wide;
- copy: `x=587.4921875`, `571.5 x 353.5625`, `80px` right padding;
- rich text: `491.5 x 182.1796875`.

The final editable cursor adds at most `0.5234375px` to the terminal row stack at
mobile and `0.2734375px` at desktop. It does not change section or copy flow,
and the downloaded JavaScript proves the cursor is intentionally appended to
the final editable row when motion is allowed.

## Behavior verification

- Entry-gated typing begins only after the terminal enters the viewport with
  `rootMargin: 0px 0px -10% 0px`.
- At approximately `0.9s`, the local terminal was partially typed with one
  cursor, no visible tags, and 43 visible characters.
- After the full default timing sequence, all eleven tags were visible and the
  thirteen-row container became `contentEditable=true`.
- With `prefers-reduced-motion: reduce`, all thirteen rows and eleven tags were
  immediately complete and editable, with no cursor.
- Dragging the header translated the window and raised the dashed boundary to
  `0.94441` opacity. After release, the spring returned the transform to `none`
  and boundary opacity to `0`.
- The screen-reader-only full text remains present in every animation state.

Desktop and mobile source/reference screenshots were captured at equal
viewports, scroll positions, and reduced-motion completion state. After the
required viewport reload, the problem section is visually aligned. The live
page is used only as a labeled hydration-gap/final visual reference; the
implementation comes from the downloaded files above.

Build: `npm run build` passes. Vite emits only its existing chunk-size warning.
