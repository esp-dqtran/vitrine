# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Full-page reconstruction boundary

This project reconstructs the public homepage at `https://www.contentarchitecture.dev/` as a frontend-only React app. Source evidence is stored in `../../../full-page-capture/evidence/`; the earlier crawler snapshot and assets are in `../../../2026-08-18T09-36-04-737Z/`.

- Preserve the source section order, copy, responsive breakpoints, palette, fonts, fixed navigation, minimap, and floating learn-more control.
- Reuse the recovered menu, click-and-hold spiral, benefits GlyphField, and ASCII showcase behavior under `src/recovered/` and `src/components/`.
- Keep all runtime images and fonts local under `public/assets`; do not hotlink the source site.
- Treat 1280 × 720 as one desktop checkpoint, not as a fixed-height implementation contract. Re-check at a second desktop viewport with a different aspect ratio and preserve viewport-relative sections such as `min-h-svh`/`h-svh`.
- Before implementing any section, inventory every direct DOM child and every visible or accessible control, record its bounding box and computed layout styles, and test its state change. Screenshots establish appearance but are not sufficient evidence of structure or behavior.
- The mobile truth is 390 × 844 with a 12,832px document. Re-test desktop and mobile after any change that alters a section's height.
- Required interactive states include the hero scroll cue, mobile menu, Next.js/Astro repository switching, ASCII-card hover/touch reveal, review navigation, FAQ expansion, spiral hold/release, and GlyphField hover/click.
