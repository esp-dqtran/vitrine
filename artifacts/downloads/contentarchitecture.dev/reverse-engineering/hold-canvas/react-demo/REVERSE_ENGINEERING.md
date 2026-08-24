# SpiralScene reconstruction

This component was recovered from the downloaded implementation and the live browser state. The screenshots are visual references, not the source of the algorithm.

## Recovered structure

- A single responsive container owns a WebGL 2 canvas and cursor-follow instruction label.
- A generated 512 px glyph atlas contains `THE CONTENT ARCHITECTURE.` in the captured GeistMono font.
- Thirty instanced rings alternate rotation direction. Their radius, type size, density, visible text bands, and initial angle are generated once per mount.
- The vertex shader converts letters into dots near the pointer, freezes and gathers rings while held, applies sparse glyph glitches and tremors, and pushes a release wave through the rings.
- The fragment shader preserves the atlas alpha and slightly brightens outer rings.

## Recovered behavior

- Hover: the cursor label follows the pointer with a 20 px offset and characters dissolve into dots within a soft radius.
- Hold: the label changes to `KEEP HOLDING`; rotation freezes while the spiral slowly gathers and selected glyphs shake or glitch.
- Charged after 0.9 seconds: the label changes to `RELEASE`.
- Release: a 1.8-second outward ripple restores rings progressively.
- Resize, intersection, tab visibility, and reduced-motion behavior are handled without React rerenders in the animation loop.

## Adaptation

The source subscribed to its page-level smooth-scroll provider. This standalone component derives an equivalent velocity impulse from native page scrolling. Its visual renderer, timing constants, pointer states, font, responsive fit, and lifecycle behavior remain aligned with the downloaded source.
