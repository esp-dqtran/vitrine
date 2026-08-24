# GlyphField reverse engineering notes

## Selected source

- Page: `https://www.contentarchitecture.dev/#features`
- Selected element: the full-size WebGL canvas inside the features section
- Selector captured by Vitrines:

  ```css
  main.relative.z-1 > div.relative.isolate:nth-of-type(3) > div.absolute.inset-0:nth-of-type(1) > div.size-full.lg\:sticky:nth-of-type(1) > div.relative.size-full > canvas
  ```

- Source CSS size: 1240 × 753 px in the desktop capture
- Source backing buffer: 2480 × 1506 px at DPR 2
- Recovered component names: `BenefitsSectionBackground` wrapping `GlyphField`

The selection is only the canvas. The source page's `bg-black-deep/30` wash, navigation, section text, and cards are sibling DOM elements and are not part of this component.

## Recovered data and rendering

- Renderer: WebGL2 through OGL, using instanced character quads
- Cell target: 14 px high with a 0.55 glyph aspect ratio, then fitted to the container
- Model data: 160 × 88 brightness cells, 14,080 values
- Brightness model: the original embedded base64 field, not a traced image or screenshot
- Character atlas: ` ·.ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*#@`
- Claims phrase: the original “EVERY DECISION ALREADY MADE … WIRED UP NOT JUST CLONED” sequence
- Typeface: bundled Geist Mono variable font
- Colors: `#232323` canvas background and `#ffffff` glyphs
- Desktop model placement: right aligned and vertically centered
- Narrow model placement: horizontally centered at the bottom
- DPR: capped at 2
- WebGL configuration: no antialias, depth, or stencil; high-performance preference

## Recovered behavior

- A 2.35-second radial entrance wave reveals the field.
- Slow hashed flips animate individual glyphs inside the brightness model.
- Pointer proximity dissolves glyphs around the cursor.
- The cursor-following label reads `CLICK`.
- A click emits a 1.8-second radial wave that brightens and scrambles glyphs.
- The animation pauses when hidden or outside the viewport.
- ResizeObserver rebuilds the grid when its parent changes size.
- Reduced-motion preference stops time-based animation while retaining a rendered frame.

## React API

```jsx
<GlyphField
  backgroundColor="#232323"
  color="#ffffff"
  entrance
  interactive
  modelLayout="auto"
/>
```

`GlyphField` always fills its parent. Give the parent the desired dimensions. `modelLayout="auto"` matches the source breakpoint: `right` at 1024px and above, `bottom` below it. A tall mobile source section places the bottom-aligned model near the end of that section; the included demo uses a viewport-height parent so the entire reusable component is immediately visible.

## Source artifacts consulted

- `network-assets/65d0ba2cf2a9fa15b8754458.js`: benefits-section wrapper and claims phrase
- `network-assets/cd0b42b2283151dd51423f11.js`: lazy `GlyphField` WebGL implementation
- `network-assets/3b1404194dab861afe57d62a.js`: embedded glyph-field model data
- Existing captured `geist-mono.woff2`: exact source typeface
