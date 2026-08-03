# Motion spec — "Two-register SaaS explainer"

Reverse-engineered from `pinterest_33284484742303187.mp4` (Flike, 16:9, 74.3s, 24 frames sampled).
Frames: `<scratchpad>/frames2/` + `contact-sheet.png`.

The reference's art direction — pale blue, the Flike mark, a person's portrait — is
**disposable**. The structure below is the reusable asset.

---

## 1. Camera grammar (the transferable core)

- **There is no camera.** Nothing dollies, orbits or rotates. Every element is a flat 2D card;
  depth is faked by rendering them at different blur radii and scales on one plane. Elements
  drift and re-focus rather than the frame moving. Cheap to produce, reads expensive.
- **The signature move — rack focus on flat art.** One element is pin-sharp and centred; every
  other card sits behind it at heavy bokeh. Attention is directed by *blur*, not by position or
  motion. This is the single thing that makes it feel like a film instead of a slide deck.
- **Two registers, strictly alternated.** *Blur register* (abstract: floating logos, ribbons,
  diagrams, everything soft) carries the argument. *Sharp register* (full-frame real product UI,
  flat and legible) carries the proof. Never both at once — the cut between them is the beat.
- **Framing arc: flat.** Subject size barely changes across 74s. Variety comes from register
  swaps and layout changes, not from scale. Nothing zooms.
- **Diagram beats read left-to-right.** Source logos stack on the left, soft bezier ribbons bend
  rightward and converge into one labelled circular node on the right. Causality, drawn.
- **Bookends: an orbit motif, used twice.** A circular subject ringed by a segmented multicolour
  arc opens the film (0–12s) and returns near the end (~62–66s) before the end card. The brand
  mark also appears twice — a mid-film sting at ~15s and the closing card — bracketing the body.
- **One deliberate pattern interrupt.** At ~55s, a celebrity reaction shot with giant type breaks
  50 seconds of polish. It exists purely to reset attention before the close.
- **Rhythm: slow.** ~10 stations over 74s, 5–8s each. This is a site/YouTube explainer, not paid
  social. Cut it to 30s and the argument stops landing.

---

## 2. Beat spec — mapped to Vitrines

Swap slots: **Object** = the Vitrines catalog · **Orbit motif** = the Vitrines mark ringed by
real catalog app icons · **Palette** = inverted to the dark theme (`#111112` ground, `#ffffff`
ink) — the reference's pale blue becomes a dark radial glow · **Bookend** = Vitrines wordmark
sting + end card · **Pattern interrupt** = the "one screenshot lies" reveal.

Asset column = what already exists in this repo. Only beats 3–5 and the vector/type work remain.

| # | Time | Register | Content | Asset (in repo) | Empty half |
|---|---|---|---|---|---|
| 1 | 0–12s | Blur | Vitrines mark centred, ringed by real catalog icons (Quo, Aboard, Tide Guide, Agoda, Comet, Threads sharp; 8 more blurred behind) + segmented arc in each app's real accent | ✅ [`ad-assets/generated/orbit-motif.mp4`](../ad-assets/generated/orbit-motif.mp4) — 12.0s, seamless loop | full-bleed, centred |
| 2 | 12–16s | Sting | Wordmark on near-black. Hard cut in, hard cut out | `public/favicon.svg` + type in the edit | centred |
| 3 | 16–19s | Blur | Ambient ribbon transition, no text | ✅ [`ad-assets/generated/ribbon-transition.mp4`](../ad-assets/generated/ribbon-transition.mp4) — 5s, fades in/out from empty `#111112`; trim to 3s or let it breathe | — |
| 4 | 19–26s | Blur | Diagram: platform logos left → ribbons converge → node **"422K captured screens"** | ⬜ vector work; numbers from `/api/catalog/stats` | left third holds logos, copy right |
| 5 | 26–33s | Blur | Second diagram: screens + flows + UI elements → node **"One research project"** | ⬜ vector work | copy right |
| 6 | 33–42s | **Sharp** | Real catalog UI, full frame — grid, filters, platform switch | ✅ [`public/landing/astryx-product-demo.mp4`](../public/landing/astryx-product-demo.mp4) — 22.9s real session, trim any 9s | full-bleed |
| 7 | 42–50s | **Sharp** | Real flow strip panning: *Resetting password — 12 screens · observed in 277 apps* | ✅ [`ad-assets/resetting-password/strip-pan.mp4`](../ad-assets/resetting-password/strip-pan.mp4) — 8.2s, fits the slot as-is; claim still: `stills/claim-card.png` | full-bleed |
| 8 | 50–56s | **Sharp** | Real project / handoff view, sources still attached | ◐ [`public/landing/astryx-public-preview-real-flows.png`](../public/landing/astryx-public-preview-real-flows.png) — still only; slow push-in in the edit, or record the live view with `record-page.ts` | full-bleed |
| 9 | 56–60s | Interrupt | Pattern break — the perfect screenshot, then the ten ugly ones around it. Giant type | ◐ [`ad-assets/resetting-password/screens/01–06.png`](../ad-assets/resetting-password/screens) — 1920×1199 captures; layout + type in the edit | type over full frame |
| 10 | 60–68s | Blur | Orbit motif returns, ring completes | ✅ reuse `orbit-motif.mp4` (it loops — enter at any point) | centred |
| 11 | 68–74s | End card | Wordmark, `Explore the library`, `vitrines.app` | `stills/flows-wall.png` as a dimmed backplate + type | centred |

Cut hard on every register change. Hold each sharp beat long enough to actually read one label —
that is the whole point of the sharp register.

**Coverage: ~48 of 74 seconds already have final-quality footage.** The gap is beats 3–5 (one
generated transition + two vector diagrams) and the type passes. Also on the shelf from the 15s
ad, usable as B-roll here: [`ad-assets/generated/beat1-coldopen.mp4`](../ad-assets/generated/beat1-coldopen.mp4)
(12s, 9:16 — vertical, so a centre-crop or split-screen insert only).

---

## 3. Production reality — read before generating anything

**This reference is ~90% deterministic motion graphics, not AI video.** Beats 2, 4, 5, 9, 11 are
vector diagrams and typography with legible labels; beats 6, 7, 8 are product UI. An AI video
model will mangle every one of them — it garbles small type and invents interface detail, which
on a product selling accurate references is fatal. This session already proved the failure mode
twice.

Build it like this:

| Beats | Status | How | Source |
|---|---|---|---|
| 6, 7 (sharp/product) | ✅ recorded | Screen recording via [`scripts/record-hero-demo.ts`](../scripts/record-hero-demo.ts) / [`scripts/generate-ad-assets.ts`](../scripts/generate-ad-assets.ts) | `public/landing/astryx-product-demo.mp4`, `ad-assets/resetting-password/strip-pan.mp4` |
| 8 (handoff view) | ◐ still only | Push-in on the still, or record the live page with [`scripts/record-page.ts`](../scripts/record-page.ts) | `public/landing/astryx-public-preview-real-flows.png` |
| 1, 10 (orbit motif) | ✅ built | [`public/orbit.html`](../public/orbit.html) recorded via `record-page.ts` — icons and arc colours live from `/api/catalog`, every animation period divides 12s so it loops; re-record any time | `ad-assets/generated/orbit-motif.mp4` |
| 2, 4, 5, 11 (type, diagrams, end card) | ⬜ | Vector + type in the edit; stats from `/api/catalog/stats`, never hand-typed | — |
| 3 (ribbon transition) | ✅ generated | **The one AI-safe beat** — Seedance 2.0, the `#111112` swatch pinned as start AND end image; verified: bookends pixel-empty (max value 17), no text, ribbons white-only | `ad-assets/generated/ribbon-transition.mp4` |
| 9 (interrupt) | ◐ assets ready | Real captures + burned-in type, laid out in the edit | `ad-assets/resetting-password/screens/01–06.png` |

The rack-focus signature is a blur-radius ramp on flat layers. It does not need 3D, and it does
not need a model.

---

## 4. Generation prompt — beat 3 only

✅ **Already generated → `ad-assets/generated/ribbon-transition.mp4`** (5s, 1920×1080). The
run pinned a flat `#111112` swatch as BOTH start and end image, and the delivered clip's
bookend frames are pixel-empty — it cuts cleanly from the beat-2 sting and into the beat-4
diagram. One deliberate change from the draft below: the ribbons fade in from empty and out
to empty rather than "settling back", which is what the swatch bookends require and what a
transition beat wants.

Prompt kept for regeneration (different ribbon character, longer take):

Model: `seedance_2_0` · 16:9 · 5s · 1080p

```
higgsfield generate create seedance_2_0 --aspect_ratio 16:9 --duration 5 --resolution 1080p --generate_audio false --wait --prompt "Abstract motion graphic on a uniform near-black background, exactly #111112 as in image 2 — never lighter, never tinted, no vignette.

Camera model: there is no camera. The frame is completely static — it never pans, tilts, zooms, dollies, rotates or shakes. The only motion is the ribbons themselves.

Three or four smooth translucent ribbons of soft white light flow horizontally from the left edge to the right edge, crossing and separating in gentle S-curves like slow silk. Their edges stay soft and slightly blurred. They are pure light with no texture, no material, no reflections.

Colour law: ribbons are white and very pale grey only. No blue, no orange, no rainbow, no gradient shift.

Timed beats: 0–1s ribbons enter from the left edge. 1–4s they cross the frame and braid slowly through the centre. 4–5s they settle back to the same arrangement as the first frame.

Invariants: no text, no letters, no numbers, no logos, no interface, no objects, no people appear at any point. Nothing new enters after the first second. The background is uniform #111112 in every frame. First frame and last frame are identical."
```

> If the ribbons keep rendering coloured after two attempts, stop rewriting the prompt and pass a
> white-swatch reference image instead. A recurring drift needs pixels, not more adjectives.
> If the ends do not match for the loop, reverse the clip onto itself rather than regenerating.

---

## 5. What is worth stealing, and what is not

**Steal:** the two-register alternation, the rack-focus-on-flat-art signature, the left-to-right
converging diagram, the double bookend, and the mid-film pattern interrupt. All five are
structural and free.

**Do not steal:** the 74-second length, unless this is a site-embed or YouTube asset. Your
strongest existing claim — *observed in 277 apps* — lands in 15 seconds
([`ad-assets/SCRIPT.md`](../ad-assets/SCRIPT.md)). This spec is the long-form companion to that,
not a replacement for it.

*Reference frames: `<scratchpad>/frames2/`*
