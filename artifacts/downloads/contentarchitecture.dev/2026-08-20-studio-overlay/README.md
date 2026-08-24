# Studio overlay deferred-state supplement

This supplement preserves public JavaScript requested only after the downloaded
page's **Inspect this page in Studio mode** control was activated at a
`1280 x 720` desktop viewport.

The immutable `2026-08-18T09-36-04-737Z` capture contains the minimap,
controller, event names, and deferred chunk URLs, but it did not exercise the
Studio state and therefore omitted nine lazy dependencies. Those files remain
outside the original capture and are recorded here with response headers,
bytes, and SHA-256 checksums.

Trigger:

1. load `https://www.contentarchitecture.dev/` at `1280 x 720`;
2. wait for fonts, hydration, and the minimap;
3. activate `button[aria-label="Inspect this page in Studio mode"]`;
4. wait for the field overlay and `role="dialog"` editor to settle;
5. retain the newly requested public chunks.

The supplement is implementation evidence for `page-minimap`, `studio-panel`,
and `studio-field-overlay`. It does not replace or modify the original capture.
