# Melius home canvas showcase — reverse-engineering spec

## Scope and evidence

This spec covers only the downloaded home-page `#canvas` showcase. It was derived from:

- `../../2026-08-20-home/raw.html` — rendered markup plus the serialized `canvasShowcase` data.
- `../../2026-08-20-home/network-assets/9aa9e990ef106d45ccfc.js` — the captured client component. The relevant minified functions are `nw` (orchestrator), `r6` (tab list), `r9`/`r2` (dock and prompt), `nA` (scene), `nd` (media card), `nh`/`np` (connectors), `ng` (responsive scene wrapper), and `ny` (background).
- `../../2026-08-20-home/capture-manifest.json` — original URL to local-asset mapping.
- The offline downloaded mirror at `http://localhost:4186/#canvas` — desktop and mobile interaction checks.

No live Melius page was used for this analysis.

## What this is

It is not a conventional tab panel. The five tab buttons select one of five vertically stacked, scroll-observed scenes. The selected scene controls a sticky full-viewport background and a sticky floating prompt dock. Selecting a tab scrolls to that scene; scrolling to a scene updates the tab. Each category runs a one-time animation sequence that reveals node cards and draws their graph connections.

`#canvas` contains all five scene sections in document order:

1. Advertising
2. E-commerce
3. Filmmaking
4. Fashion
5. Branding

The source starts with Advertising active.

## Recommended React breakup

```text
CanvasShowcase
├── CanvasBackgroundLayer
│   ├── CanvasBackgroundMedia       (cross-faded image or looping video)
│   └── CanvasNoiseOverlay
├── CanvasDock
│   ├── CanvasTabList               (scrollable buttons + animated orange indicator)
│   └── CanvasPrompt                (hero-to-dock morph, typed prompt, CTA)
└── CanvasSceneSection × 5
    └── CanvasViewport
        ├── CanvasDotGrid
        ├── CanvasTrack              (post-playback drag target)
        │   └── CanvasNode × n        (caption, tag, frame, image/video)
        ├── CanvasConnectorLayer      (orange paths and ports)
        └── CanvasEdgeFades
```

Reusable primitives already represented in the local React library are suitable inputs, but they are not enough by themselves: `CanvasNode`, `CanvasNodeCaption`, `CanvasMediaFrame`, `MeliusTag`, and `SegmentedTab` need the scene state machine below.

## Source data contract

Every category has this shape:

```ts
type CanvasCategory = {
  _key: string
  label: string
  prompt: string
  background: ImageMedia | VideoMedia
  scene: {
    width: number                 // logical track width
    media: CanvasMediaNode[]
    connections: { from: string; to: string }[]
  }
}

type CanvasMediaNode = {
  id: string
  x: number
  y: number
  maxWidth?: number
  reducedX?: number               // supplied only by Branding
  reducedY?: number
  tag: 'Image' | 'Video'
  title: string
  model: string
  media: ImageMedia | VideoMedia
}
```

The shared CTA is **Start for Free**, `https://app.melius.com/signup`, and opens in a new tab.

### Category inventory

| Category | Prompt | Logical width | Nodes in source order | Connections |
|---|---|---:|---|---|
| Advertising | Create a Melius Mints campaign from product packaging and a studio-shot reference | 1100 | `node-1`: Product Mockup / GPT Image 2 / Image (64,150,w300); `node-2-image`: Studio Shot / Nano Banana Pro / Image (460,266,w220); `node-2-video`: Lifestyle Moment / Seedance 2.0 / Video (760,15,w270) | 1 → 2-image; 1 → 2-video |
| E-commerce | Create a PDP-ready product image from product, home environment, prop, and natural-light references | 1200 | `node-1-1`: Model / Nano Banana Pro / Image (64,15,w190); `node-1-2`: Pack Shot / GPT Image 2 / Image (64,280,w190); `node-2`: PDP Image / GPT Image 2 / Image (350,110); `node-3`: Product Motion / Kling 3.0 Omni / Video (790,75) | 1-1 → 2; 1-2 → 2; 2 → 3 |
| Filmmaking | Create a cinematic trailer frame from character, environment, camera, lens, lighting, and atmosphere references | 1820 | `node-1`: Still Sketch / GPT Image 2 / Image (56,164,w300); `node-2`: Character Study / Nano Banana 2 / Image (445,143,w380); `node-3`: Movie Cut 1 / Seedance 2.0 / Video (915,115,w380); `node-4`: Movie Cut 2 / Seedance 2.0 / Video (1385,185,w380) | 1 → 2 → 3 → 4 |
| Fashion | Turn a fabric swatch and croquis into a technical flat and campaign-ready garment images | 1020 | `node-1-1`: Croquis / Ideogram 4 / Image (54,15,w135); `node-1-2`: Fabric Swatch / GPT Image 2 / Image (54,285,w135); `node-2`: Garment Mockup / Nano Banana Pro / Image (280,56); `node-3`: Campaign Garment / Nano Banana Pro / Image (645,56) | 1-1 → 2; 1-2 → 2; 2 → 3 |
| Branding | Turn icon variations into a selected mark, website mockup, and out-of-home billboard | 1190 | `node-1-1`: Icon 01 / Ideogram 4 / Image (40,30,w180; reduced 20,20); `node-1-2`: Icon 02 / Ideogram 4 / Image (244,30,w180; reduced 200,20); `node-1-3`: Icon 03 / Ideogram 4 / Image (40,275,w180; reduced 20,275); `node-1-4`: Icon 04 / Ideogram 4 / Image (244,275,w180; reduced 200,275); `node-2-1`: Selected Mark / Ideogram 4 / Image (520,15,w190; reduced 360,20); `node-2-2`: Website Mockup / Nano Banana Pro / Image (520,290,w190; reduced 360,300); `node-3`: OOH Billboard / Nano Banana Pro / Image (810,92,w320; reduced 560,154) | 1-1 → 1-2; 1-3 → 1-4; 1-2 → 2-1; 1-4 → 2-2; 2-1 → 3; 2-2 → 3 |

Coordinates and widths in the table are source logical-track pixels, not final CSS pixels.

## Captured assets

Source paths below are the values consumed by the component. Their downloaded copies are preserved in the capture manifest.

| Category | Background | Local background capture | Node media captures |
|---|---|---|---|
| Advertising | `advertising/background.webp` (2880×1222) | `network-assets/31e3db1c5e47daa7d22d.webp` | `95caea352ed126fa508d.webp`, `88872a5492cfd32bb64e.webp`, `0b35cf63739d10344eb0.webm` |
| E-commerce | `e-commerce/background.webp` (2880×1624) | `network-assets/43a22d7ff031ad3d8798.webp` | `3819d63fe9fcb6c7ebbc.webp`, `26ff88bb49305d60c8c6.webp`, `2aeda84b43e0d0c9d2f1.webp`, `ee59325a84147e4f85ba.webm` |
| Filmmaking | `filmmaking/background.webp` (2880×1624) | `network-assets/a78fee5757a232636c5c.webp` | `d519f0f0f4dffe267e6b.webp`, `8cf4de374884d268ea40.webp`, `ca5fdf49f591c096e51a.webm`, `b602c016faa4f4f54810.webm` |
| Fashion | `fashion/background.webp` (2880×1624) | `network-assets/72b4130962ae4ae5c15b.webp` | `f2effb7d3c9b4909f3b8.webp`, `770764d8ebceca5147f9.webp`, `1df271b14f106572138e.webp`, `4e86fccb23b6aefa65e6.webp` |
| Branding | `branding/background.webm` (1920×1080) | `network-assets/341dd0e93efae794a628.webm` | `02c53d2f2e584516de4f.webp`, `7b62a071d0398b376f98.webp`, `49ae8909c0fc469b4a21.webp`, `84419ad9f8e99cfa5a20.webp`, `92751b5b588b5cf8dcf3.webp`, `ba77c2f656172fcb4f95.webp`, `2652bedf10ca87e3ef5c.webp` |

The scene backgrounds use source paths under `/media/pages/home/canvas-showcase/<slug>/`. The global static texture is `network-assets/38461a15166fd4e3da61.webp` (`/media/shared/noise.webp`).

## Layout and responsive behavior

### Outer section

- Root: `section#canvas.relative.isolate.bg-black`.
- Background and dock are `sticky top-0 h-lvh`; the scene list scrolls above them.
- Scene list: `flex flex-col gap-4`, with a viewport-relative top/bottom padding. Its desktop outer scene height is the scaled 559px viewport plus the flow gap; a 1280px-wide downloaded render measured each scene at **497.36px** high and `#canvas` at **3024.39px** high.
- Each scene section is `justify-end`, with `px-4`, `sm:px-0`, and `lg:pr-2.5`.

### Scene viewport scaling

`CanvasSceneSection` measures its wrapper width using `ResizeObserver`:

- Wrapper: `w-full sm:w-[min(88vw,640px)] lg:w-[54.2vw]`.
- Logical viewport width is **780px** normally.
- When the measured wrapper is non-zero and narrower than 560px, logical width becomes **560px** and the scene scales down to fit.
- Logical height is always **559px**. Final shell size is `logicalWidth × scale` by `559 × scale`.
- On a 1280px desktop capture, the wrapper was 694px wide, scale **0.889744**, and the rendered scene was **694 × 497.37px**.
- On the downloaded mirror's mobile layout (399px effective CSS viewport), the wrapper was **358px** wide and each rendered scene was **358 × 357.36px**. This is the 560px logical scene scaled down.

The logical track is `scene.width` on normal motion. With `prefers-reduced-motion`, it is forced to 780px for consistent connector coordinates.

### Node sizing and mobile placement

The source calculates a card width as the smallest of:

- 448px,
- the configured `maxWidth` (otherwise 348px),
- an available-height/aspect-ratio value based on a 559px viewport and a 62px card chrome allowance,
- and, in reduced/mobile mode, 232px.

Node media uses `object-contain`; the card has a small caption above it, off-black bordered shell with 8px padding, an orange tag, and its natural media aspect ratio.

For the compact/reduced layout, a node uses `reducedX`/`reducedY` if supplied. Branding supplies these explicitly. All other categories fall back by source order to:

```ts
[
  { x: 20, y: 35 },
  { x: 20, y: 285 },
  { x: 280, y: 190 },
  { x: 540, y: 70 }, // also the fallback for later nodes
]
```

### Dock positioning

The prompt dock morphs from the hero prompt's measured frame to its canvas dock frame as section scroll progress goes from 0 to 1 (spring stiffness 140, damping 26).

- Desktop dock: max width **353px**; default x is `16.875vw`, clamped to keep it on screen; y is **24.0148vh**.
- Mobile (`<768px`): width is viewport minus 24px; x is 12px; y is `max(16px, announcementHeight + headerHeight)`.
- The mobile downloaded render measured the dock at x≈12px, y≈66px.
- Its tab row is horizontally scrollable with hidden scrollbars. The tab bar auto-scrolls the selected button near the left edge.

## State machine and interaction contract

### Category selection and scroll

1. An `IntersectionObserver` observes every `#canvas-showcase-*` section with `rootMargin: '-35% 0px -35% 0px'`.
2. Entering the central observer band selects that category, updates `aria-current="true"` on its button, selects/cross-fades its background, and starts the category sequence only the first time that category is encountered.
3. Clicking a tab updates selection and Lenis-scrolls to the matching scene. The scroll offset equals minus the dock's desktop y ratio (`-viewportHeight * 195 / 812`).
4. The currently selected tab indicator animates to its `offsetLeft` and `offsetWidth` for **0.5s** with an `easeOutCirc` curve (instant with reduced motion). The indicator is orange; selected text is white and inactive text is gray, becoming white on hover.
5. After a down-scroll pauses for **5s** while the section progress is between 0.05 and 0.82, the source returns selection to Advertising.

Downloaded-mirror verification:

- Desktop and mobile clicks changed `aria-current`, scrolled to the selected scene, and cross-faded to the matching image/video background for all five categories.
- The Branding background was confirmed to play while active; image backgrounds cross-faded instead.

### Background behavior

- A background becomes mounted permanently after its category has been visited, so leaving a category fades it to opacity 0 rather than unmounting it.
- Background opacity transition: **0.8s `easeInOutCubic`**; zero duration with reduced motion.
- Background videos are muted, looped, inline, and only play when active and motion is not reduced. They pause when inactive.
- The source overlays a global noise layer (`mix-blend-mode: overlay`, opacity 0.3).

### Prompt dock behavior

- Before docking, its textarea is interactive and cycles five placeholder prompts character-by-character (22ms per character), holds for 1.8s, fades for 350ms, waits 400ms, then advances.
- Once the canvas is docked, the category prompt types into the compact text region at 22ms per character. The source makes the input non-interactive while docked.
- After typing completes: a 400ms pressing state, then loading while the scene sequence runs, then completed/orange CTA state.
- The circular CTA links to signup with `?prompt=<typed-or-active-prompt>`; it opens a new tab. It must not be simulated as a submitted form.
- The dock begins when the hero's `WEBGL_HERO_IMAGES_SHOW` event fires plus 1s, but includes a **6s fallback**. A standalone component needs an explicit `introReady` input or the fallback; it must not depend silently on the hero being implemented.

### Node and connector playback

For non-reduced motion, a fresh category sequence does this:

1. Reveal the first node immediately.
2. For every later node, use an inter-node timing profile, pan the track to place its center near viewport center, reveal the required connector, then reveal the next node.
3. Finish 0.75s after the final sequence action and enable dragging.

Node entrance variant: opacity 0, `translateY(16px) scale(0.98)` → opacity 1, identity transform over **0.75s `easeOutCubic`**. The media frame simultaneously transitions from `brightness(1000%) sepia(20%)` to normal over **0.75s `easeOutCirc`**.

Connection timing profile:

- Consecutive nodes in the same `node-<group>`: linger 0.18s, pan 0.45s, start line after 0.30s, line draw 0.30s.
- Other transitions use lingering delays `[0.85s, 0.5s]` by transition index (then the last value), pan 0.8s, line start at 75% of the linger delay, line draw 0.45s.

Connectors are orange cubic Beziers. Each has outlined orange ports: outer radius 3.75px, inner radius 1.875px. Root nodes receive a left-side initial port; graph edges then join source right port to target left port. Paths animate `pathLength` and opacity with `easeInOutCubic`; ports use an `easeOutBack` scale/opacity entrance.

With reduced motion, all cards and lines are immediately visible, background video is paused, scene playback is considered complete, and there is no drag interaction or timed sequence.

### Drag behavior

After a non-reduced sequence completes, the whole logical track changes from `select-none` to `cursor-grab`; while pressed it is `cursor-grabbing`.

- Horizontal track bounds: `min(0, max(-(trackWidth - viewportWidth), x))`.
- Vertical pan bounds: -120px to 120px, but touch input deliberately does **not** change y.
- Pointer release applies a 0.45s `easeOutCubic` inertia-like settle using 180× last velocity.
- The downloaded mobile Branding scene was checked after completion: all seven cards were visible and its track reported `cursor: grab` with a non-zero horizontal pan transform.

## Implementation dependencies and blockers

There is no missing source asset or unknown category data in this capture. The implementation lane must, however, preserve these dependencies before declaring the composite verified:

1. **Motion runtime:** the original uses motion values, transforms, and springs; a static tab swap is not an equivalent component.
2. **Scroll runtime:** tab selection and scene selection are two directions of the same state. Implement the central-observer rule and click-to-scroll rule together.
3. **Hero handoff:** inject or emulate the hero-to-dock readiness/morph contract. Do not leave the dock permanently in the final state just because the hero is not yet rebuilt.
4. **Responsive validation:** verify the `<560px` scaled-scene path and `<768px` dock path as separate conditions, in addition to desktop.
5. **Media lifecycle:** only active/revealed node videos play; inactive backgrounds and reduced-motion videos pause.
6. **Accessibility:** preserve tab buttons, `aria-current`, labelled scene sections, decorative connector/grid `aria-hidden`, and the prompt textarea label.

Until all six are implemented and compared to the downloaded mirror, the correct inventory status is **analyzed / implementation pending**, not a verified `CanvasScene` replacement.
