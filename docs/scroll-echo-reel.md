# Motion spec — "Scroll Echo" website showcase reel

Reverse-engineered from `pinterest_844493676784201.mp4` (9:16, 22.6s, 24 frames sampled).
Frames: `<scratchpad>/frames/` + `contact-sheet.png`.

The reference's art direction (RedSun, orange `#ff6a1f` on near-black) is **disposable**.
The camera grammar below is the reusable asset.

---

## 1. Camera grammar (the transferable core)

- **Path shape** — no camera at all. A **fixed browser card** (91% frame width, 38% frame
  height, centered at exactly 50% height) never moves, never rotates, never zooms. All motion
  is the page scrolling *inside* it. This is why the UI text stays razor-sharp.
- **The signature move** — behind the card, the **same page at ~3× scale**, dimmed to ~12% and
  blurred ~2px, sharing the same scroll offset. At 3× scale the same offset reads as 3× the
  speed, so the background is a giant ghost of itself racing past. That echo *is* the effect.
- **Framing arc** — constant. Subject size never changes across 22.6s. Depth comes only from
  the scale gap (1× card vs 3× echo), not from dollying.
- **Beat rhythm** — 10 stations, ~2.2s each: fast scroll ~0.5s → settle-hold ~1.7s. The hold is
  long enough to read one headline. Never a constant-velocity scroll.
- **Bookends** — opens on a 0.5s near-black fade-up where only the hero headline is lit (reads
  as "page still painting"); closes on a **3s dead hold** on CTA + footer. Deliberately *not* a
  loop — first frame ≠ last frame.
- **Negative-space side** — the page's own alternating image-left/text-right layout supplies it
  per beat. The frame reserves the **bottom third** (below the card, pure dark echo) as the
  band for a caption sticker or CTA.
- **Authenticity tell** — a real macOS arrow cursor drifts inside the card and flips to an
  I-beam over text. Cheap, and it's what makes it read as a screen recording instead of a mock.
- **Constant anchor** — the echo's sticky nav strip pins at the top of the vertical frame and
  never scrolls. One fixed element to hold the eye against all that motion.

---

## 2. Beat spec — as built for the Vitrines landing

Swap slots: **Object** = Vitrines landing (`/`) · **"Turn" analog** = page scroll · **Palette** =
whatever the landing already renders · **Bookend motif** = the sticky Vitrines nav · **Copy band**
= bottom third of the frame.

The landing has 7 `<section>` elements, so the reference's 10 stations map to 7. Rhythm, framing
arc and bookends are unchanged. Stations are derived at runtime, not hardcoded — these are the
values from the current landing:

| # | t (s) | scrollY | Card content | Echo behind (3×) |
|---|---|---|---|---|
| — | 0.0–0.5 | — | fade up from black | black |
| 1 | 0.5–2.2 | 0 | Hero — "Product research for decisions that ship" | hero headline, huge |
| 2 | 2.7–4.4 | 802 | Catalog preview grid | hero bleeding out |
| 3 | 4.9–6.6 | 1434 | App marquee — "research across the products people use" | preview cards |
| 4 | 7.1–8.8 | 3527 | "Evidence that works alongside you" + browse mock | headline, huge |
| 5 | 9.3–11.0 | 4598 | "Start with the product, not a blank search box" | headline, huge |
| 6 | 11.5–13.2 | 6141 | Flow-tracing story | prior section crop |
| 7 | 13.7–18.4 | 7117 | Closing CTA — **dead hold 3s** | footer crop |

Move 0.5s ease-out, hold 1.7s, 3s tail freeze → **18.4s total** (reference was 22.6s over 10
stations; same cadence, fewer sections).

---

## 3. Build — `public/reel.html`

Built and verified. Two same-origin iframes of the live landing, one scroll variable, no video
assets, no render step. Served by the existing Vite dev server.

```bash
npm run dev
```

Then open `http://localhost:5173/reel.html` (the dev server may pick another port), size the
window so the 720×1280 frame is fully visible, and screen-record just that frame. `R` replays.

Key parameters, all in the `:root` block of that file:

| Var | Value | Why |
|---|---|---|
| `--card-scale` | `0.455` | 1440×1068 viewport → 655×486 on screen = 91% × 38% of the frame |
| `--echo-scale` | `1.365` | exactly 3× the card scale — same scroll offset then reads as 3× speed |
| `MOVE` / `HOLD` / `TAIL` | `500` / `1700` / `3000` ms | the reference's cadence |

Stations come from `doc.querySelectorAll('section')`, each **centered** in the card viewport —
landing on a raw section top leaves the bottom half of the card empty, which is what kills the
framing. Nothing to re-measure when the landing changes.

Two things to know before recording:

- **Keep the tab focused.** Background tabs throttle `setTimeout`/`rAF`, so the reel runs slow
  and uneven if you switch away mid-take.
- The cursor is a synthetic SVG on a slow lissajous drift. Swap it for a real pointer recording
  if you want the tell to be perfect.

## 4. AI-video prompt (fallback only — expect text mangling)

Use only if you want a *stylized* version and don't need legible UI. Upload references in this
order: **1** bookend frame (t=0 fade-up), **2** hero station composite, **3** mid-page station,
**4** CTA+footer station, **5** your logo/wordmark as a clean PNG, **6** a flat swatch of
`#111111`.

> Vertical 9:16, 23 seconds. Composition is locked to image 1 for the entire clip.
>
> **Camera model:** there is no camera. The frame is completely static — it never pans, tilts,
> zooms, dollies, rotates, or shakes. The only motion in the entire clip is content scrolling
> vertically upward.
>
> **Layers:** a sharp browser window card occupies 91% of the frame width and 38% of the frame
> height, centered at exactly 50% height, with 18px rounded corners, a 1px `#2a2a2a` border and
> a soft black drop shadow. Behind it, filling the whole frame, the identical page content
> rendered at 3× the card's scale, at 12% opacity with a 2px blur, scrolling three times faster
> than the card. A sticky navigation strip from that background layer is pinned at the very top
> of the frame and never scrolls.
>
> **Color / material law:** background is exactly `#111111` (image 6) — never lighter, never
> tinted, never gradient. Card panels are `#0a1317`. The only bright element is white `#ffffff`
> text and buttons. No orange, no blue, no color cast of any kind.
>
> **Timed beats:**
> 0–0.5s fade up from black, only the hero headline lit, rest of the card dark.
> 0.5–2.5s hero station (image 2), bottom third of the frame empty.
> 2.5–6.5s scroll to the product-mock station, bottom third empty.
> 6.5–8s logo row station, left and right gutters empty.
> 8–13s bento-grid then section-title stations (image 3), bottom third empty.
> 13–17.5s feature row then pricing stations, right half empty on the feature row.
> 17.5–20s gallery-card station, bottom third empty.
> 20–23s CTA and footer station (image 4), completely frozen — no motion at all for the last
> three seconds.
> Every scroll move takes 0.5s with an ease-out and is followed by a still hold.
>
> **Invariants:** each UI element appears exactly once. Nothing new appears that is not in the
> reference images. The logo is exactly image 5 and never changes shape. The background is
> uniform `#111111` in every frame. The card's position and size are identical in every frame.
> No lens flare, no particles, no light sweeps, no camera shake.

---

*Reference frames: `<scratchpad>/frames/`*
