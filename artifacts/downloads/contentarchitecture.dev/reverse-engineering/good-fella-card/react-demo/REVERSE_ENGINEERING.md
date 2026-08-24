# Good Fella showcase card reconstruction

This component was recovered from the downloaded page implementation and live browser states. Screenshots are used for visual comparison; the rendering behavior comes from the source runtime.

## Recovered structure

- The card is one external link targeting `https://good-fella.com/` in a new tab.
- Its media slot is responsive at a 16:9 aspect ratio with a 12 px gap before the title.
- The resting visual is a two-dimensional canvas renderer using 4,440 precomputed luminance cells: 120 columns, 37 rows, and 64 intensity levels.
- The hover visual is the downloaded Good Fella project image. It is stored locally and is not hotlinked.
- The title uses the downloaded GeistMono variable font, uppercase text, fluid 14–16 px sizing, and the source text-mask structure.

## Recovered behavior

- The canvas and image crossfade over 500 ms with `cubic-bezier(0, 0, 0.2, 1)`.
- The canvas renderer caps device pixel ratio at 2 and redraws after font loading or resizing.
- On coarse-pointer devices, the source activates a card when it crosses the vertical viewport center; the React component preserves that touch behavior.
- Reduced-motion users receive the same states without transition or title entrance motion.
