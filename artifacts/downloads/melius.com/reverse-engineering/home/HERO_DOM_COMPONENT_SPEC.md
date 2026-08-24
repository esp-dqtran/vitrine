# Hero DOM component contract

Source of truth: the downloaded Melius home capture served at `http://localhost:4186/`. The public website was not used for this reconstruction.

## Ownership boundary

The visible prompt is **not owned by `#hero`** in the downloaded DOM. The hero owns an empty `#hero-prompt-slot` placeholder. A shared prompt/dock owned by the following `#canvas` section is translated upward over that slot, then morphs into the canvas navigation while scrolling.

This component therefore reconstructs only the source-owned hero DOM. The shared prompt/dock must be implemented and verified as a separate composite component.

## Source hierarchy

```text
section#hero[data-background="gray-background"]
├── div background layer
│   └── div dotted field
│       └── canvas sticky background canvas
├── div scene layer
│   ├── div mask wrapper
│   │   └── svg > path#melius
│   └── div WebGL wrapper
│       └── canvas hero scene
└── div content layer
    ├── h1
    │   ├── span "One platform."
    │   └── span "Every creative outcome."
    └── div intro
        ├── div copy
        │   └── p with one explicit br
        └── div#hero-prompt-slot[aria-hidden="true"]
```

Both the downloaded source and the React reconstruction contain 19 elements and the same ordered tag paths.

## Desktop contract: 1280 × 720

| Node | Source geometry | React geometry | Maximum delta |
| --- | --- | --- | --- |
| `#hero` | 0, 40, 1280, 738.703 | 0, 40, 1280, 738.719 | 0.016 px |
| content | 0, 40, 1280, 738.703 | 0, 40, 1280, 738.719 | 0.016 px |
| `h1` | 373.438, 120, 533.125, 112 | exact | 0 px |
| intro | 400, 536, 480, 162.703 | 400, 536, 480, 162.719 | 0.016 px |
| copy | 400, 536, 480, 72 | exact | 0 px |
| prompt slot | 480, 644, 320, 54.703 | 480, 644, 320, 54.719 | 0.016 px |

Typography matches the downloaded computed values: 56/56 Reckless heading at `-0.02em`, 16/24 body copy, and 12.8/15.36 prompt slot at `-0.03em`.

## Mobile contract: 390 × 844

- Section and content: 390 × 844, beginning immediately below the 40 px announcement.
- Content padding: 80 px block, 20 px inline.
- Heading: 350 × 168 at x 20 and section-relative y 116.64.
- Intro: 320 × 210.72 at x 35 and section-relative y 516.64.
- Copy: 320 × 120.
- Prompt slot: 320 × 54.72.
- Intro margin: 232 px; intro gap: 36 px.

## Entrance state

- Heading and intro begin at opacity 0 and scale 1.2.
- They reveal to opacity 1 and scale 1 with the downloaded 1.5 second expo-style easing.
- Intro begins 0.2 seconds after the heading.
- Reduced-motion mode renders both in their settled state without transitions.
