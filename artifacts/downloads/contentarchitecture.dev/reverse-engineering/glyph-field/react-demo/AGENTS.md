# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Recovered component boundary

This prototype reconstructs the raw `GlyphField` canvas selected inside the source site's `#features` section. It is the ASCII globe/terminal background behind “Every decision already made,” not the separate click-and-hold spiral component.

- Preserve the recovered brightness data, claims phrase, glyph atlas, shaders, and bundled Geist Mono font.
- Keep the field parent-sized and responsive: the model sits on the right at desktop widths and at the bottom below 1024px.
- Preserve entrance, hover dissolve, ambient glyph flips, click ripple/scramble, reduced-motion, visibility, intersection, resize, and DPR behavior.
- Do not add the source section's dark overlay or foreground page copy to `GlyphField`; those are sibling page elements outside the selected canvas.
