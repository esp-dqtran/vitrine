# ASCII Reveal Card for Framer

`AsciiRevealCard.tsx` is the standalone Framer Code Component source.

It accepts a Framer responsive image and generates the ASCII representation in the browser. It does not contain the downloaded Good Fella artwork or its precomputed cell data.

The default presentation matches the reconstructed source card: a square `#232323` surface, white 120-column ASCII, a 12 px title gap, and a 500 ms crossfade using `cubic-bezier(0, 0, 0.2, 1)`. Hovering anywhere on the card reveals the image; on coarse-pointer devices the reveal follows the card as it crosses the viewport center.

## Supported controls

- Responsive image and alternative text
- Editable title with visibility, case, color, size, and spacing controls
- Cover or contain fitting
- Character ramp, ASCII detail, contrast, brightness, and inversion
- ASCII and background colors
- Source-style full-card hover/touch activation or optional tap activation
- Crossfade or pointer-centered spotlight reveal
- A revealed-state preview control for design review
- Reveal size, transition duration, and corner radius
- Optional destination link and new-tab behavior

Framer-hosted images work with pixel sampling. A remote image server must allow cross-origin canvas access; otherwise the component safely falls back to displaying the source image.
