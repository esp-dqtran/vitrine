# Design QA — ASCII GlyphField

## Source and implementation

- Source page: `https://www.contentarchitecture.dev/#features`
- Source desktop capture: `evidence/source-desktop-idle.png`
- Normalized source desktop capture: `evidence/source-desktop-idle-normalized.png`
- React desktop capture: `evidence/implementation-desktop-idle.jpg`
- Side-by-side comparison: `evidence/source-vs-react-desktop.png`
- Hover capture: `evidence/implementation-desktop-hover.jpg`
- Click-ripple capture: `evidence/implementation-desktop-ripple.jpg`
- Source mobile capture: `evidence/source-mobile-features-390.jpg`
- React mobile capture: `evidence/implementation-mobile-idle.jpg`

Desktop comparison used a 1240 × 753 CSS-pixel viewport. The source canvas had a 2480 × 1506 backing buffer at DPR 2 and was normalized to 1240 × 753 for comparison. Mobile behavior was checked at 390 × 844 with a 780 × 1688 backing buffer at DPR 2.

The source element capture contains composited sibling page content and a 30% dark overlay even though those nodes are outside the selected canvas. Consequently, exact full-frame pixel differencing would be misleading. QA compared the unobscured field regions, placement, density, typography, brightness model, and interaction behavior, and cross-checked those observations against the recovered renderer, data, and source component properties.

## Surface review

| Surface | Result | Evidence |
| --- | --- | --- |
| Font | Passed | Exact captured Geist Mono font is embedded and used to generate the atlas. |
| Layout | Passed | Parent-sized field; right/center desktop model and bottom/center narrow model match recovered rules. |
| Grid density | Passed | 14 px target row height and 0.55 glyph aspect match the source. |
| Color | Passed | Raw canvas uses source `#232323` background and white glyphs. The sibling page overlay is deliberately excluded. |
| Model image | Passed | Original 160 × 88 brightness data is decoded directly; no screenshot or remote hotlink is used. |
| Copy | Passed | Original claims phrase and `CLICK` pointer label are preserved. |
| Responsiveness | Passed | No horizontal overflow at 390 px; DPR backing size and bottom model layout verified. |

## Interaction review

| State | Result |
| --- | --- |
| Entrance wave | Passed — radial reveal completes and settles. |
| Hover | Passed — local dissolve and pointer-following `CLICK` label verified. |
| Click | Passed — visible radial brighten/scramble wave verified. |
| Ambient motion | Passed — sparse model glyph flips remain active. |
| Resize | Passed — grid and canvas backing size update with the container. |
| Visibility/intersection | Passed — animation scheduling pauses outside active visibility. |
| Reduced motion | Passed — time progression pauses while a stable frame remains rendered. |
| Console | Passed — no new warnings or errors after the uniform-array correction. |

## Comparison and findings

The first runtime pass exposed an OGL array-uniform warning because the phrase indices were supplied as a typed array. Changing that uniform to the array representation expected by OGL removed the warning. The subsequent visual and interaction pass found no P0, P1, or P2 differences.

One intentional P3 context difference remains: the standalone demo is one viewport high, whereas the source mobile features section is substantially taller. Because the field is parent-sized and the model is bottom-aligned on narrow screens, embedding this component in an equally tall parent reproduces the source placement. This does not change the component itself.

final result: passed
