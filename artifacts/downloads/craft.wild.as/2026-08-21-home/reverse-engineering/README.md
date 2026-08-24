# Craft reverse-engineering workspace

This capture follows the component-first workflow:

1. Capture the public source at desktop and mobile sizes.
2. Walk the entire page to observe lazy and scroll-triggered states.
3. Download the source HTML and every observed first-party visual/runtime asset.
4. Serve an offline mirror and verify it before writing React.
5. Split the captured DOM into React page components.
6. Reuse the source CSS and interaction runtime so the first pass is behaviorally faithful.
7. Refactor individual components from captured HTML fragments to typed JSX only after parity is established.

## Local projects

- `../mirror/`: downloaded, analytics-free source mirror.
- `../react-reconstruction/`: Vite/React reconstruction composed from 13 React components.
- `../screenshots/`: desktop, mobile, carousel, Tetris, mirror, React, and side-by-side QA captures.
- `../source/`: hydrated DOM, asset inventories, geometry, media, and interaction evidence.

## Important implementation boundary

The current React pass deliberately preserves exact captured DOM fragments using `dangerouslySetInnerHTML`. This is the source-faithful bridge, not the final reusable API. It prevents visual drift while each significant primitive and composite is converted to explicit JSX with props and isolated hooks.

The runtime contains nine captured behavior blocks plus the downloaded Tetris module. Analytics was intentionally removed from the offline mirror and reconstruction.

## Recommended extraction order

1. `PixelButton`, `MonoLabel`, `TagChip`, and `MediaSurface`.
2. `CaseStudyCard`, `ExperimentCard`, and `EditorialHeading`.
3. `MomentumCarousel` and media lifecycle hooks.
4. `HeroPixelField`, `ProcessHelixCanvas`, and `BrandConstellationCanvas`.
5. `FooterCityCanvas` and `FooterTetrisGame`.
6. Replace each source fragment with typed JSX while keeping the comparison screenshots as acceptance references.

