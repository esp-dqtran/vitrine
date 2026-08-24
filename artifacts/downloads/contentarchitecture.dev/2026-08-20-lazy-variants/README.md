# Deferred interaction-state supplement

Source page: `https://www.contentarchitecture.dev/`

This supplement closes deferred-state gaps in the immutable
`2026-08-18T09-36-04-737Z` browser capture. The initial capture recorded the
repository explorer's Next.js state, but did not activate its Astro edition or
open the Learn more drawer far enough to load its author portrait and video.
The downloaded loader module
`../2026-08-18T09-36-04-737Z/network-assets/f0f242b634222c280f79339e.js`
proves that activating Astro requests
`/_next/static/immutable/chunks/1dxb-dyj08pik.js`.

That immutable public response was downloaded separately instead of modifying
the original capture. Its `Last-Modified` value is
`Tue, 18 Aug 2026 02:45:59 GMT`, the same deployment window as the original
snapshot. The response headers, byte size, URL, and SHA-256 digest are retained
beside the asset.

The drawer supplement retains the downloaded inline portrait, Mux poster, and
a video-only 1920x1080 MP4 stream copy derived from the public Mux HLS master.
The MP4 is a deterministic local reconstruction asset; the manifest records
its source URL, derivation, byte size, and SHA-256 digest.

The original loader also named two deferred chunks for email validation. Those
immutable public responses are retained here with their response headers and
digests. They prove the exact trimmed email messages: `Enter your email
address.` and `Enter a valid email address.` The dated headers show that this
recovery occurred after the original snapshot, so it remains supplemental
evidence rather than being folded into the immutable capture.

These files are evidence for the observed deferred states, not proof that the
original capture exercised every deferred interaction state.
