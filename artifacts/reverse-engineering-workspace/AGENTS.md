# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

This prototype is a Vitrines-styled component reverse-engineering workspace. Always render the source in a real, visible Playwright Chromium window rather than streaming screenshots into React. Vitrines is the companion inspector: the user browses natively, explicitly starts Select mode, and clicks the real DOM element in Chromium. The app receives only the selected element metadata and one cropped preview, then creates a structured reverse-engineering request. Keep this working end to end rather than replacing it with a static mock or continuous MJPEG transport.
