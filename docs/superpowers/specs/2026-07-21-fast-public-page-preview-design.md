# Fast Public Page Preview Design

## Goal

Reduce the time required to record and watch continuously scrolling public-page previews without changing full-page screenshots, section crops, or stored capture metadata.

## Chosen behavior

- Keep `scrollPixelsPerSecond` as the minimum scroll speed so short pages never become slower.
- Add `maxScrollDurationMs` with a 20,000 ms default.
- Compute scroll duration as the lesser of the distance-based duration and `maxScrollDurationMs`. Long pages therefore scroll faster automatically.
- Reduce the default hold at the top and bottom from 1,000 ms to 500 ms.
- Keep the existing continuous `requestAnimationFrame` animation, zero intermediate stops, and full-page screenshot capture unchanged.
- Preserve explicit test and caller overrides for scroll speed and hold duration.

For the measured Mobbin homepage, the 9,925 px scroll distance changes from about 49.6 seconds of scrolling plus two 1-second holds to 20 seconds of scrolling plus two 0.5-second holds: roughly 21 seconds total, with smoother movement.

## Alternatives considered

1. Use a fixed speed near 800 px/s. This fixes Mobbin but still creates long previews for taller pages.
2. Record slowly and accelerate the WebM afterward. This adds transcoding cost and another failure surface.
3. Cap browser scroll duration dynamically. This is the selected approach because it is deterministic, requires no new dependency, and preserves smooth continuous motion.

## Testing

- Add a unit-level timing test for short and tall scroll distances.
- Verify the browser capture test still produces a WebM and ordered section crops under both Node strip-types and the worker's `tsx` runtime.
- Run focused crawler and worker tests plus the production build.
- Re-run the isolated Mobbin.com E2E and confirm the resulting WebM duration is below 20 seconds.

## Scope

Only public-page preview timing changes. Screenshot dimensions, HTML analysis, section detection, queue isolation, API shape, and object-store layout remain unchanged.
