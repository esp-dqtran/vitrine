# Models slider parity audit

Audited 2026-08-21 against the downloaded Melius mirror at `http://localhost:4186/#models` and the React reconstruction at `http://localhost:4185/slider`. The live website was not used.

## Confirmed parity

- The desktop DOM geometry matches at 1280 x 720: section, background canvas, WebGL canvas, heading, drag surface, controls, rail, and shuttle dimensions and positions.
- The heading typography and wrapping match: Reckless, 56px size and line height, -1.12px tracking.
- All 17 provider assets are present, valid WebP files, and 512 x 487 pixels.
- The accessible provider group, labels, card order, and previous/next button labels match.
- The React WebGL canvas loads all 17 cards and exposes a ready state.

## Confirmed gaps

1. The background dot field uses 1 x 1 dots centered at 7.5px. The downloaded implementation uses a 15px tile with a 2 x 2 dot positioned at 6.5px, so the React field is visibly too faint.
2. The shuttle progress formula applies a positive modulo before the source's `.999` remainder. After one previous action, the downloaded shuttle is at 98.8235px while React is at 98.929px.
3. The slider buttons are missing the downloaded global focus-visible treatment: 2px orange outline with 2px offset. React currently falls back to the browser's 1px blue outline.
4. Device behavior is selected from viewport width in React. The downloaded runtime selects desktop/mobile parameters from the device user agent. This changes pitch, card width, entrance offset, and cylindrical distortion in narrow desktop and wide mobile/tablet cases.
5. Motion timing is approximate rather than source-equivalent: React caps frame delta at 50ms instead of 100ms and uses power4 easing for the cylindrical entrance instead of expo-out.
6. Previous/next/wheel APIs are active before all image textures are ready. The downloaded runtime attaches those interactions only after its slider has initialized, so React can accumulate a hidden offset or consume horizontal wheel input during slow loading.
7. Minor DOM difference: React adds `aria-hidden="true"` to the nonsemantic drag surface while the downloaded DOM does not.

## Intentional implementation difference

The downloaded slider uses Three.js r184 and continuously renders while visible. The React reconstruction uses native WebGL and stops rendering after motion settles. The current static geometry and card output remain close, so this is not itself a parity failure unless later effects depend on continuous frames.

## Evidence

- `01-source-idle.jpg`
- `02-react-idle.jpg`
- `03-source-previous.jpg`
- `04-react-previous.jpg`

