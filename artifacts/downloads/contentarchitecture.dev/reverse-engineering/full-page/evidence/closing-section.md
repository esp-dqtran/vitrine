# Closing section evidence packet

Component IDs: `closing-section`, `pull-window`, `closing-ascii-card`

Status:

- `closing-ascii-card`: verified
- `closing-section`: verified
- `pull-window`: verified, including a real browser pointer gesture

## Downloaded sources

- DOM: `../../../2026-08-18T09-36-04-737Z/index.source.html`
- styles: `../../../2026-08-18T09-36-04-737Z/network-assets/d2ed906b7813000307abcbd3.css`
- `PullWindow` and `TerminalWindow` behavior:
  `../../../2026-08-18T09-36-04-737Z/network-assets/48ef6040a1f791a105273355.js`

## Structure and sizing

The source is an off-white padded section containing a `PullWindow`, a
checkerboard dither frame, a terminal header, and an ASCII `pre` with
`role="img"`.

The terminal is not fixed-height. Its body is an inline-size container and the
ASCII text uses `font-size: calc(100cqw / 82.8)`. Header, body padding, text line
count, frame padding, and section padding determine every outer height.

| Viewport | Section height | Frame height | ASCII width | ASCII height |
|---|---:|---:|---:|---:|
| 390 × 844 | 297.359 px | 153.359 px | 314 px | 83.359 px |
| 1024 × 768 | 450.734 px | 290.734 px | 816 px | 216.734 px |
| 1159 × 863 | 486.656 px | 326.656 px | 951 px | 252.656 px |
| 1280 × 720 | 518.797 px | 358.797 px | 1072 px | 284.797 px |

All measured reconstruction deltas were `0 px` at all four viewports.

## Drag behavior

The downloaded `PullWindow`:

- starts dragging only from its terminal header;
- uses elastic drag `0.2` with zero-distance constraints;
- disables momentum;
- snaps back to the origin;
- uses spring settings `bounceStiffness: 320` and `bounceDamping: 24`;
- fades a dashed boundary to opacity `1` in 150 ms while dragging and back to
  `0` on release.

The reconstruction implements those exact properties with `motion/react`.

## Real pointer verification

The downloaded page and React reconstruction were each scrolled to the closing
card at the same `737 x 863` viewport. A real CDP mouse sequence pressed the
header center, moved the pointer by `120 x 72` CSS pixels in six timed steps,
sampled the card before release, then sampled it again after the spring settled.

| State | Downloaded page | React reconstruction |
|---|---|---|
| origin | `x=16`, boundary opacity `0`, transform `none` | `x=16`, boundary opacity `0`, transform `none` |
| held at `+120,+72` | transform `translate(24px, 14.4px)`, boundary opacity `1` | transform `translate(24px, 14.4px)`, boundary opacity `1` |
| 900 ms after release | `x=16`, boundary opacity `0`, transform `none` | `x=16`, boundary opacity `0`, transform `none` |

The `24 x 14.4` displacement is the expected `0.2` elastic movement against
zero-distance constraints. A second real pointer sequence started inside the
React card body and moved by the same amount; the card stayed at `x=16`, the
transform remained `none`, and boundary opacity remained `0`. This proves the
header is the only drag handle.
