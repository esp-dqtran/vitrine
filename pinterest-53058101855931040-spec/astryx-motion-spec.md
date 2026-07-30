# Astryx Motion Spec — reference DNA × app knowledge × generation prompt

One document, three layers: (1) the camera grammar reverse-engineered from the Pinterest
reference clip, (2) the Astryx product/app knowledge it maps onto, (3) the ready-to-run
generation prompt in the verified design system.

- Reference: `pinterest_53058101855931040.mp4` (20.4s scroll-driven 3D site, Nubian pyramids)
- Reference frames: `frames/` (24 + `contact-sheet.png`)
- Renders so far: `seedance-render-v1.mp4` (pyramid re-shoot) · `astryx-render-v1.mp4`
  (v1 — pre-correction violet palette) · `astryx-render-v2.mp4` (v2 — verified tokens, real
  UI bookend, persona narrative) · stills in `astryx-refs/`
- Current content direction (v3 target — §8): **the zoom is the containment hierarchy** —
  FLOWS → zoom → SCREENS → zoom → UI ELEMENTS → land inside one Element Detail; v2's
  requirements-workspace ending is superseded

---

# Part I — The reference's reusable DNA

## 1. Camera grammar

- **Path shape:** one continuous *telescoping dolly-through* — macro → micro. Space → planet
  zoom → whiteout → aerial descend → orbit around the monument → push-in → cross the doorway
  threshold → interior. Never cuts; every scene change is a camera move or a fog mask.
- **Framing arc:** extreme wide (planet) → wide aerial (site) → full-figure (monument) →
  3/4 orbit → tight face → doorway CU → immersive interior wide. Subject grows monotonically
  until you're *inside* it.
- **Beat count & rhythm:** 7 stations over ~20s. Each station holds ~2–3s while copy and
  annotations settle; moves between stations are fast (~1s). Slow-hold / fast-move cadence.
- **Bookends:** opens in darkness (space), closes in darkness (interior ceiling shadow) —
  a light journey of dark → bright → dark. A right-edge scroll rail with progress nodes
  persists through every frame as the connective UI motif.
- **Scene-cut mask:** the *whiteout* — sand-fog floods the frame to pure background color
  (~25% mark), hiding the swap from planet scale to site scale. This is the licensed "cut."
- **Signature move #1:** accent-colored line-drawn technical annotations (angle dims,
  construction machine, human figures, artifacts) that *draw themselves on* during holds,
  over the photoreal 3D scan — blueprint layer over reality.
- **Signature move #2:** the threshold cross — dollying through the physical doorway to end
  inside the subject. The clip earns its ending by entering the thing it introduced.
- **Copy side:** alternates per beat — top-left (1), center (2), left (4, 5), right (7).
  The subject always sits in the opposing half; annotations live on the subject's half.

## 2. Reference beat spec (source palette: cream `#F4EFE6`-ish, red `#E8380D`-ish)

| Beat | Time / scroll% | Camera | What's framed | Copy side |
|---|---|---|---|---|
| 1 | 0–5s (0–25%) | Slow push toward planet from high orbit | Dark space, Earth with region labels; marker pin lands as zoom tightens | Top-left: kicker + title + paragraph; "scroll to explore" bottom-left |
| 2 | 5–6s (25–30%) | Push continues; fog floods frame | Whiteout — only the scroll rail visible | none (breath beat) |
| 3 | 6–7.5s (30–37%) | Aerial top-down emerging from fog, descending | Site overview, hero object centered | Center: section title |
| 4 | 7.5–11s (37–54%) | Settle to full-figure 3/4 view at ground level | Hero object full height, entrance visible | Left: heading; red angle-dimension draws top-right |
| 5 | 11–15s (54–73%) | Slow orbit left (~45°) | Object rotating; line-drawn construction diagram animates; sketched figures at base | Left: paragraph block |
| 6 | 15–18s (73–88%) | Orbit resolves into straight push-in | Face fills frame, doorway CU, threshold crossed | none (movement beat) |
| 7 | 18–20.4s (88–100%) | Inside: slow forward drift, slight rise | Interior walls, dark ceiling band; sketched artifacts draw on floor | Right: title + paragraph |

---

# Part II — Astryx app knowledge

## 3. What Astryx is

Astryx (frontend codename **Vitrine**) is a design-reference research product — *"Mobbin for
complete, evidence-backed application design systems."* It crawls Mobbin and live websites,
runs every screenshot through an AI caption → synthesize pipeline, and reconstructs a
browsable, versioned design system per app: screens, UI elements, flows, tokens, sections —
scoped per platform (iOS / Android / Web).

**Governing principle:** never claim more than was captured. Every token, component, and flow
step links back to source screens — "Observed in 3 screens", "Desktop only".

Sources of truth: `README.md`, `docs/ARCHITECTURE.md`, `docs/astryx-product-designer-ui-flow.md`.

## 4. Domain model (the shape of the catalog)

Three top-level reference types — **Apps | Sites | Flows** — sharing one discovery shell:

- **App** → platforms → versions → **screens** (image + AI analysis: purpose, page type,
  product area, states, components, confidence) → **UI elements** + **flows**.
- **Flow** → ordered, evidence-backed steps; hierarchical category → child flow
  (`normalizedFlowStore.ts`); aggregated cross-app in the flow catalog (`flowCatalogStore.ts`).
- **Site** → versions → pages → **sections** (video/image media, OCR boxes, crops).
- **Published catalog** — entitlement-gated read model (`publicCatalogStore.ts`), ~80 tables.

Ingestion: Playwright crawl → object storage + Postgres → AI analysis (Anthropic batch;
browser providers as fallback per the no-paid-APIs constraint for image extraction) →
published version. Flow analysis is multi-provider with a quality gate on evidence coverage
(`scripts/flow-analysis/README.md`).

Navigation drill-down (`src/vitrine/router.ts`): reference tabs → discovery grid with facets
(`AppsDiscoveryPage`, `SitesPage`, `FlowsPage`) → detail shell (`ReferenceDetailShell`:
screens / ui-elements / flows tabs) → `ScreenDetail` for a single screen. Flows browse via a
collapsible category tree + `flowView=visual|document` toggle. `CommandPalette` is the global
jump. Deep-link state (platform, version, evidence, flow, step) rides in query params.

## 5. How each role works here

### Product designer (primary persona, V1)
Journey per `docs/astryx-product-designer-ui-flow.md` §4:
**discover → understand the visual language → browse screens & flows → inspect tokens →
verify evidence → collect / compare → Figma export.**
Research Projects + Decision Canvas add lanes, decisions, and AI synthesis, ending in a
`DESIGN.md` handoff. The designer's core loop is *evidence verification*: every claim in the
reconstructed design system is clickable back to the screens that prove it.

### Business analyst
Works in the **Document Flow requirements workspace**
(`docs/superpowers/specs/2026-07-27-document-flow-requirements-workspace-design.md`):
requirement cards with Given/When/Then, per-card evidence coverage, and an explicit
missing-evidence list. Deliberately **one document with progressive disclosure** — no separate
BA vs dev modes. A BA turns a browsed flow into testable requirements whose acceptance
criteria cite catalog evidence. PMs branch from the same flow into Feature Documents.

### Developer (and coding agents)
Consumes the same document the BA writes — progressive disclosure reveals the technical
layers. Agents get read-only access via the **Vitrine MCP** design
(`docs/superpowers/specs/2026-07-23-vitrine-mcp-search-design.md`): `search_screens`,
`search_flows`, `search_ui_elements`, `search_patterns` over Streamable HTTP with OAuth/PKCE,
entitlement-enforced, inline thumbnails, cursor pagination. (Spec only in-repo; the live
`search_*` tools in this session run from an external server.) The dev loop:
**flow → requirements doc → implementation, with the catalog as the shared evidence base.**

### The common thread
All three roles walk the same telescoping path at different depths:
**catalog (macro) → app → flow → screen → evidence (micro)** — the designer stops at visual
language, the BA at requirements, the developer at implementation detail. That macro→micro
telescope is exactly the reference clip's camera grammar.

## 6. Design system — verified against `@astryxdesign/core` + live UI

> Correction of an earlier guess: `#725CFF` is **not** the brand accent — it appears once,
> tinting AI-generation callouts (`.ds-generation`). The real system
> (`node_modules/@astryxdesign/core/dist/astryx.css`, confirmed on the running app):

| Token | Light | Dark (default look of the live UI) |
|---|---|---|
| Accent | `#0064E0` | `#2694FE` (blue) |
| Background body | `#F1F4F7` | `#111112` |
| Background surface / card | `#FFFFFF` | `#1F1F22` |
| Text primary | `#0A1317` | `#DFE2E5` |
| Text secondary | `#4E606F` | `#AAAFB5` |
| Purple family (badges/AI) | `#5B08D8` / bg `#7952FF33` | `#7952FF` |

- **Type:** Figtree (reference/discovery pages), system stack elsewhere; SF Mono for code.
- **Shape:** radius scale 4 / 8 / 12 / 28 + full-pill controls — search bar, filter dropdowns
  ("Web ▾ · Categories ▾ · Screens ▾ · UI Elements ▾ · Flows ▾ · Latest ▾") are all pills.
- **Motion tokens:** fast 175ms · medium 410ms · slow 975ms, ease `cubic-bezier(0.24,1,0.4,1)`.
- **Observed UI idioms (live app):** dark-first; Apps | Sites | Flows tab triplet; discovery
  cards = large 16px-radius surfaces with one hero screenshot, app icon, category line, and a
  meta line ("Jul 24, 2026 · 624 screens"); Flows page = taxonomy columns of flow groups +
  "Showing 32,921 flows" + flow cards as horizontal step-screenshot carousels titled
  "*Deleting account* from *Settings* — observed in N apps".

---

# Part III — The Astryx shoot

## 7. Swap table (reference slot → Astryx)

| Slot | ASTRYX |
|---|---|
| Object | one reconstructed **app design system** — a floating 3D stack of its real screens |
| "Zoom origin" | the **catalog galaxy** — discovery grid of app cards on dark, one card gains a marker pin |
| "Threshold" analog | a **screen frame** — the camera dollies through one screen's bezel into its Screen Detail view |
| Annotation layer | **evidence line-work** in accent blue `#2694FE` — flow arrows between screens, UI-element callout boxes, "Observed in N apps" pills (violet `#7952FF` reserved for AI-generated moments only) |
| Palette / tokens | bg light `#F1F4F7` · bg dark `#111112` · surface `#1F1F22` / `#FFFFFF` · text `#DFE2E5` / `#0A1317` · accent `#0064E0`→`#2694FE` — verified tokens, §6 |
| Bookend motif | dark landing (`#111112`) → light catalog (`#F1F4F7`) → dark Screen Detail; pill search bar as the recurring motif |
| Beats / stations | 7 stations below — **the zoom IS the content hierarchy**: FLOWS (macro, beat 3) → zoom → SCREENS (mid, beat 4) → zoom → UI ELEMENTS (micro, beat 5) — each pillar literally contained in the previous; beats 1–2 open the catalog, 6–7 land inside one element |

## 8. Beat spec — Astryx edition (15s render / 20s scroll)

Content arc = one continuous zoom down the containment hierarchy:
**FLOWS → zoom in → SCREENS → zoom in → UI ELEMENTS.**
Every transition is the same forward camera move — each pillar is revealed to live *inside*
the previous one. No orbit-as-detour; the orbit happens *while* descending from flow level
to screen level.

| Beat | Time (15s) | Station | Camera | What's framed | Copy side |
|---|---|---|---|---|---|
| 1 | 0–3.7s | Open | Slow push toward the catalog galaxy floating in dark space | Grid of discovery cards (16px radius, `#1F1F22` surfaces, real screenshots) on `#111112`; a `#2694FE` marker pin lands on the hero card; pill search bar floats above | Top-left: kicker + "Every screen. Proven." + paragraph in Figtree; "scroll to explore" bottom-left |
| 2 | 3.7–4.4s | — | Push continues; light floods the frame | Washout to `#F1F4F7` — only the right scroll rail visible | none |
| 3 | 4.4–6.5s | **FLOWS** (macro) | Emerge high above, slow descending aerial | A whole flow map on `#F1F4F7`: the app's screens laid flat in sequence, connected by `#0064E0` arrows with step numbers drawing themselves; "observed in N apps" pills beside branches | Center then left: "Flows" + one line — ordered journeys, evidence-backed |
| 4 | 6.5–9s | **SCREENS** (mid) | Zoom in: descend + orbit left ~30° toward one step of the flow; its screens rise off the map into a standing 3D stack | The screen stack at 3/4 on `#F1F4F7` — the flow's arrows still visible fading at the edges; `#0064E0` count pills ("624 screens") sketch at the base | Left: "Screens" + one line — every screen captured and analyzed |
| 5 | 9–11s | **UI ELEMENTS** (micro) | Zoom in again: straight push toward the front screen until it fills most of the frame | Close-up of the front screen; thin `#0064E0` callout boxes draw around its components — button, nav, card, input — each with a tiny label line | Left: "UI Elements" + one line — components catalogued across versions |
| 6 | 11–13s | — | Push continues through the screen's bezel into dark | Bezel crosses the frame edge; darkness | none |
| 7 | 13–15s | Close | Inside: slow forward drift, slight rise | **Element Detail** on `#111112`: the inspected component large on a `#1F1F22` surface, `#2694FE` outline + meta pills (purpose, states, "Observed in 3 screens") sketch around it | Right: "Every claim, one click to the proof" |

## 9. Generation prompt — Astryx (copy-paste, Seedance 2.0)

**Reference legend** (upload in this order — prefer REAL screenshots of the live Vitrine UI
over AI-generated stills wherever possible; pixels beat prose)
1. Opening bookend: real dark discovery grid — `#1F1F22` cards on `#111112`, pill search bar,
   Apps | Sites | Flows tabs (also start-image).
2. Beat-3 FLOWS aerial: flow map — screens flat on `#F1F4F7` connected by numbered `#0064E0`
   arrows, "observed in N apps" pills.
3. Beat-4 SCREENS: 3D stack of screen cards, 3/4 view, on `#F1F4F7`, blue count pills at base,
   faint flow arrows fading at the edges.
4. Beat-5 UI ELEMENTS: close-up of one screen with `#0064E0` callout boxes + labels around
   button / nav / card / input.
5. Beat-7 interior: Element Detail — one component large on a `#1F1F22` surface on `#111112`,
   blue outline + meta pills ("Observed in 3 screens") (also end-image).
6. Astryx wordmark / app icon (rounded-square, blue).

**Camera model** — One continuous forward zoom down the containment hierarchy: push-in,
descend over the flow map, descend + orbit left ~30° as the screens rise into a stack, then
straight dolly into the front screen and through its bezel; never cuts, never rolls, never
reverses, never zooms back out.

**Color / material law** — Light beats sit on exactly `#F1F4F7` (soft cool gray — never pure
white); dark beats on exactly `#111112` with `#1F1F22` surfaces; all annotations are thin
blue line-drawings — `#0064E0` on light, `#2694FE` on dark; violet is forbidden except for an
explicit AI-generation moment. UI text in Figtree; controls are full pills, cards 12–16px
radius. Never darker, never gradient.

**Timed beats** — as the table in §8, each beat naming its empty half for copy. Ease every
move with `cubic-bezier(0.24,1,0.4,1)`; holds ≈ the slow token (975ms) scaled to beat length.

**Invariants** — Each element appears exactly once; nothing new after its beat; nothing
merges or duplicates; background uniform in every frame of its beat; first frame matches
image 1, last frame matches image 4.

---

# Appendix — Generic template (re-use with any other brand)

**Reference legend** — 1. bookend frame of `{ZOOM_ORIGIN}` on dark (start-image) · 2. aerial
of `{SITE}` · 3. full-figure 3/4 of `{OBJECT}` on `{BG_HEX}` · 4. interior view (end-image) ·
5. accent swatch `{ACCENT_HEX}` (note: some providers reject flat solid-color images — bake
the accent into the other references instead) · 6. logo `{LOGO}`.

**Camera model** — one continuous forward journey: push-in, descend, orbit left ≤45°, dolly
through `{THRESHOLD}`; never cuts, never rolls, never reverses.

**Color law** — background exactly `{BG_HEX}`; annotations thin `{ACCENT_HEX}` line-drawings
only; never darker, never gradient.

**Timed beats** — 0–25% push to `{ZOOM_ORIGIN}`, pin appears, top-left empty · 25–30% fog of
`{BG_HEX}` floods · 30–37% aerial over `{SITE}`, center clear · 37–54% settle 3/4 on
`{OBJECT}`, dimension line draws, left empty · 54–73% orbit left, `{ANNOTATION}` draws, left
empty · 73–88% push through `{THRESHOLD}` · 88–100% interior drift, sketches draw, right
empty, end on image 4.

**Invariants** — each element once; nothing new after its beat; nothing merges; background
uniform per beat; first frame = image 1, last frame = image 4.
