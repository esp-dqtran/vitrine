# Build-in-Public Motion Spec — "Descent Through the Machine"

Reverse-engineered from two references:
- **Gcore "Inference at the Edge" showcase** (Pinterest pin 893331276096259770) — scroll-dwell beat rhythm.
- **tungvu.tech** — narrative depth-scroll grammar (fixed crossfading background, persistent depth HUD, one metaphor carrying every section).

Astryx's three pillars become three depth zones of one machine: you descend from the
open web (crawl) through the analysis depths down to the build floor (shipped product).

## Camera grammar (the reusable DNA)

- **No browser frame** — the viewer is *inside* the world; the page is the environment.
- **Path**: one continuous vertical descent. Content scrolls; the fixed background only
  crossfades between zone palettes so depth is felt through light, not section borders.
- **Persistent instrument**: fixed HUD on the right edge tracking progress (LAYER 01 → 02 → 03);
  never leaves the screen, gives the scroll a destination.
- **One metaphor, every section renamed into it** — no generic section headers.
- **Beat rhythm**: settle on each zone ~3–4s, quick descent (~1s) between; ambient particle
  layer never stops moving, even at rest.
- **Mascot vehicle** (Astryx crawler probe) travels with you and bookends the journey.
- **Signature move**: the background darkening itself — the world's color IS the scroll position.

## Beat spec (full-length, 46s)

| Beat | Time | Zone | What's framed | Copy side |
|---|---|---|---|---|
| 1 | 0–2s | — | Astryx mark, bright surface light, probe idle | bookend |
| 2 | 2–8s | SURFACE · THE OPEN WEB | Hero: "We build Astryx in the open. Descend into the machine." Probe + drifting app-screen fragments; "SCROLL TO DESCEND" | centered |
| 3 | 8–14s | LAYER 01 · THE CRAWL FIELD (blue #2f64e9) | Captured screens drift past; counters 465 apps · 137K+ screens; HUD reads 01 | copy left |
| 4 | 14–20s | LAYER 02 · THE ANALYSIS DEPTHS (purple #7a55c5, darker) | Screens dissolve into structure — flow trees, 647 UI elements, tokens; wireframes glow like bioluminescence | copy right |
| 5 | 20–26s | wow beat | Full-viewport flow-hierarchy constellation lights up node by node | centered |
| 6 | 26–32s | LAYER 03 · THE BUILD FLOOR (green #16845b, darkest) | Shipped-feature log cards with product screenshots, dated like a captain's log | copy left |
| 7 | 32–38s | THE FLOOR | "You made it to the floor — and we're still building." Road-ahead + CTA; probe headlight sweeps once | centered |
| 8 | 38–46s | — | HUD complete; fade toward surface light; mark returns | bookend |

Ambient rule (every beat): one fixed gradient stack crossfading blue → purple → green on
descent; drifting data-particles replace bubbles; depth HUD visible in every frame.

## Generation prompt (reference-image version)

```
Reference images (upload in this order):
1. Bookend — Astryx mark on bright blue surface-light gradient. FIRST AND LAST FRAME.
2. Hero composition — probe mascot centered, screen-fragments drifting, headline above,
   "SCROLL TO DESCEND" below.
3. Layer 01 composition — copy left, drifting captured app screens right, HUD gauge right edge.
4. Layer 02 composition — copy right, glowing flow-tree structures left, darker purple water.
5. Constellation wow-frame — full-viewport flow hierarchy of glowing nodes.
6. Layer 03 composition — shipped-feature log cards, darkest green-black depth.
7. Exact Astryx logo mark.
8. Three-swatch strip: #2f64e9 / #7a55c5 / #16845b (zone color lock).

Camera: one continuous vertical descent through a single fixed environment; the camera only
moves down, never rotates, never cuts; the background NEVER scrolls — it only crossfades
between the three zone palettes (image 8) as depth increases.

Color law: zone colors exactly as image 8, in that order, top to bottom; light always dimmer
than the zone above; small white data-particles drift upward in every frame; the depth HUD
(right edge) is visible in every frame and reads 01, 02, 03 as zones change.

Beats:
0–2s   image 1 exactly; hold.
2–8s   settle on hero (image 2); headline fades in; particles drift; probe bobs gently.
8–14s  descend 1s, settle on image 3; counters tick up to 465 and 137K+; HUD reads 01.
14–20s descend 1s, settle on image 4; flow-trees draw themselves in over 2s; HUD reads 02.
20–26s settle on image 5; constellation lights node by node from center outward; no scroll.
26–32s descend 1s, settle on image 6; log cards rise 20px with stagger; HUD reads 03.
32–38s settle on floor CTA; probe headlight sweeps left to right once; darkest frame.
38–46s hold 2s, then cross-fade to image 1 (return to surface light).

Invariants: each element appears exactly once; nothing appears that is not in a reference
image; the HUD gauge is identical in style in every frame; background gradient is the only
thing that changes color; first frame == last frame.
```

## Frames

Reference frames extracted to scratchpad: `frames/` (24 frames + contact-sheet.png) from the
Gcore showcase video.
