# Learn more drawer evidence

Status: `verified`

## Downloaded implementation evidence

- Page structure and content: `../../../2026-08-18T09-36-04-737Z/raw.html`
- Drawer behavior: `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`, module `361944`
- Drawer and typography utilities: `../../../2026-08-18T09-36-04-737Z/network-assets/d2ed906b7813000307abcbd3.css`
- Deferred media supplement: `../../../2026-08-20-lazy-variants/capture-manifest.json`
- React reconstruction: `../react-demo/src/components/LearnMoreDrawer.jsx`
- Owned styles: `../react-demo/src/page.css`

The downloaded module proves that the fixed light trigger opens a portal dialog
with a 60% black backdrop, 500 ms horizontal drawer transition, 400 ms backdrop
transition, Escape handling, focus trap, close-button autofocus, focus return,
and three measured/truncated navigation labels. Navigation uses the internal
Lenis scroller with a `-32px` section offset and records the clicked section as
current.

## Structure and media

The dialog contains a responsive navigation shell and one independently
scrolling content surface. Its author section contains both an inline portrait
and a 16:9 Mux media block; neither can be recovered by flattening the prose.
The reconstruction uses local files only:

| Asset | Local file | SHA-256 |
|---|---|---|
| Inline author portrait | `public/assets/author-inline-portrait.jpg` | `c7d2fddb07a70b48e9173bfb2a5c73b412356a0d0d57a6b49e4b25340ae5013d` |
| Video poster | `public/assets/author-video-poster.webp` | `3b8d9277cc85f71d2a345475ea8526c543d48467c0ff68d65053eb6fb115d9e3` |
| Video-only 1920x1080 MP4 | `public/assets/author-video-1080p.mp4` | `ea63c2d004848ea24532ca4f784c3c089995f2287ddbfe6aaf9095128142b8db` |

The MP4 is a stream-copy reconstruction from the public Mux HLS master. It is
muted, autoplaying, looping, inline, and poster-backed like the downloaded Mux
configuration. The local browser reported duration `78.433333`, ready state 4,
muted `true`, loop `true`, and paused `false`.

## Responsive geometry

Both pages were reloaded after each emulated viewport change, fonts were
confirmed with `document.fonts.check`, the drawer was opened, and direct-child
geometry was measured after transitions settled.

| Viewport | Dialog | Navigation shell | Scroll surface | Section heights |
|---|---|---|---|---|
| 390x844 | `0,0 390x844` | `8,8 374x88.070` | `8,96.070 374x739.930` | `606.727 / 697.844 / 429.180` |
| 1024x768 | `64,0 960x768` | `80,16 184.883x87.164` | `264.883,16 743.117x736` | `438.695 / 480.125 / 577.906` |
| 1159x863 | `199,0 960x863` | `215,16 179.438x87.820` | `394.438,16 748.562x831` | `443.891 / 485.922 / 583.320` |
| 1280x720 | `320,0 960x720` | `336,16 181.547x88.430` | `517.547,16 746.453x688` | `487.227 / 491.094 / 584.234` |

Source and reconstruction returned the same values in every row. The adaptive
navigation widths are produced by the downloaded character-count truncation
model; the full labels remain available through `aria-label`.

## Behavior and accessibility checks

- Trigger exposes `aria-haspopup="dialog"` and live `aria-expanded` state.
- Dialog exposes `role="dialog"`, `aria-modal="true"`, and an associated title.
- Open state autofocuses Close.
- Escape and the desktop backdrop close the drawer and return focus to trigger.
- Forward Tab from the final mail link wraps to section 001; Shift+Tab from
  section 001 wraps to the mail link.
- Section navigation lands 32px below the internal scroller edge and records
  `aria-current` on the selected item.
- The body scroll lock and every document listener are restored on close.

The live page was used only to confirm the deferred Mux activation state and
active playback values that the initial interaction capture did not exercise.
The DOM, CSS, behavior, content, playback ID, and source URLs are all present in
the downloaded HTML and JavaScript; recovered media is retained in the dated
supplement rather than altering the immutable original capture.
