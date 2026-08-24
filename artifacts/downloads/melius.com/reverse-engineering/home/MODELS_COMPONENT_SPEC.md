# Models component reverse-engineering specification

Scope: downloaded Melius home-page `section#models` only.

## Evidence boundary

- Runtime DOM: `2026-08-20-home/index.html` and the hydrated offline mirror on port 4186.
- Composition and input handling: `2026-08-20-home/network-assets/9aa9e990ef106d45ccfc.js`.
- WebGL carousel state and rendering: `2026-08-20-home/network-assets/5dd6a9490ab4200512b4.js`.
- Styling and responsive utilities: `2026-08-20-home/network-assets/33937522490f8ff3aa27.css`.
- Media: all 17 provider textures are local files in `react-demo/public/assets/`.

No screenshot was used as the implementation or acceptance source.

## React component tree

```text
ModelWebGLCarousel
├── ModelBackgroundCanvas
├── ModelCanvas
├── DragSurface
├── ModelCarouselControls
│   ├── PreviousButton
│   ├── ProgressRail + 35px shuttle
│   └── NextButton
├── AccessibleProviderList
└── ModelsHeading
```

The media cards stay in WebGL. They are not reconstructed as hidden or visible DOM cards.

## Provider order

1. Google
2. OpenAI
3. ElevenLabs
4. Sync Labs
5. Mistral
6. DeepSeek
7. PixVerse
8. ByteDance
9. KlingAI
10. Black Forest Labs
11. Topaz Labs
12. MultiTalk
13. HeyGen
14. Vidu
15. Meta
16. xAI
17. Lightricks

The accessible equivalent is `role="group" aria-label="Available AI models"` containing one `ul` and 17 `li` nodes in this order.

## DOM and responsive contract

Desktop, 1280 × 720:

- section: 1280 × 720, `position: relative`, one viewport high.
- background layer: x 0, y -1, 1280 × 722.
- render canvas: x 0, y 0, 1280 × 720; backing store 2560 × 1440 at DPR 2.
- drag surface: x 0, y 180, 1280 × 360; `cursor: grab`; `touch-action: pan-y`.
- controls: x 502, y 540, 276 × 44.
- buttons: 44 × 44; rail: 140 × 2; shuttle: 35 × 2.
- heading wrapper: x 0, y 68, 1280 × 112, 32px inline padding.
- heading: 56/56 Reckless, -1.12px tracking, centered.

Mobile, 390 × 844:

- section and render canvas: 390 × 844.
- heading wrapper: x 0, y 98, 390 × 224, 20px inline padding.
- heading content: x 20, y 98, 350 × 224, four 56px lines.
- drag surface: x 0, y 211, 390 × 422.
- controls: x 57, y 633, 276 × 44; still at 75%.

## Runtime state machine

- Desktop pitch: 1.3 world units; mobile pitch: 1.1.
- Card width: 1.1 world units desktop; 0.9 mobile; texture aspect is 512/487.
- `next`: snap target, then subtract one pitch.
- `previous`: snap target, then add one pitch.
- drag: `dragStart + relativeX * visibleCameraWidth`.
- release: snap target to the nearest pitch.
- horizontal wheel or Shift + vertical wheel: target changes by `delta * 0.003`; ordinary vertical wheel remains available to the page.
- frame-rate-corrected easing: `1 - 0.9^(dt / 16.6667)`.
- progress: `modulo(-currentOffset / (17 * pitch), 1)`.
- the 35px shuttle translates through the remaining 105px of the rail.
- rendering begins in view, pauses out of view, and resumes only while entrance or offset easing is active.
- card entrance: y -0.85 desktop / -0.65 mobile to 0 over 1.25s; scale 0.75 × 0.85 to 1 over 0.75s; alpha 0 to 1 over 0.75s; visible cards are distance-staggered.
- cylindrical post-process settles at 0.7 desktop / 0.85 mobile.
- reduced motion renders the final state immediately.

## Validation result

The isolated React route `/models` was compared by DOM and computed style against the hydrated downloaded mirror:

- desktop geometry matches every measured layer, control, title, and canvas dimension.
- mobile geometry matches every measured layer, control, title, and canvas dimension.
- all 17 provider list nodes are present in source order.
- next advanced to progress 0.0587; previous returned to progress 0.0001.
- a mobile drag snapped to the next card and progress 0.0584.
- no warning or error console messages were emitted.
- production build completed successfully.
