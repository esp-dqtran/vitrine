# Reverse engineering rules

This file is the operating contract for rebuilding a public webpage as clean,
maintainable React. The downloaded browser deliverable is the primary source of
truth. The live website is not used as an implementation source.

## Canonical workflow

1. Download the complete public page and every required public asset.
2. Serve and prove the immutable download locally.
3. Decompose the entire downloaded page into a complete DOM component manifest.
4. Reverse engineer each manifested DOM component from downloaded HTML, CSS,
   JavaScript, assets, and behavior, then rebuild it as a React component.
5. Assemble the full page from those verified React components and run
   component-level plus full-page parity checks.

Do not skip directly from a screenshot or live page to a monolithic React page.
Each assembled section must trace back to a manifested downloaded DOM component.

## 1. Preserve an immutable downloaded source

Before rebuilding anything, capture and retain:

- the rendered HTML for every required viewport and route;
- every public CSS and JavaScript response loaded by the browser;
- fonts, images, video, shader data, icons, RSC responses, and other public
  assets;
- desktop and mobile full-page screenshots;
- network and asset manifests with original URLs, MIME types, byte sizes, and
  hashes;
- the capture viewport, density, URL, timestamp, and scroll/interaction state.

The capture must exercise every user-visible variant and control that can load
deferred code or assets: tabs, menus, accordions, carousels, modals, route-like
states, and responsive branches. After each transition, wait for the state to
settle, inventory newly requested same-origin resources, and retain each new
response with its triggering state. Repeat the state pass until it produces no
new required resources.

Never edit the captured source in place. Reconstruction files must live outside
the immutable capture directory.

## 2. Prove the download is replayable

Serve the untouched capture before reverse engineering components.

The replay gate requires:

1. the captured HTML loads locally;
2. local mappings resolve every required captured CSS, JavaScript, font, and
   media URL;
3. the page can render in an explicit offline/static mode;
4. missing, failed, redirected, or live-source requests are recorded;
5. checksums for captured files still pass.

Replay every captured interaction variant while offline. A default-state
replay does not prove that lazy variants are complete. If a transition requests
an uncaptured chunk, record the exact trigger and URL, keep the original capture
immutable, and store any later recovery as a separately dated supplement.

If the static replay needs the live document or a remote asset, mark the mirror
as incomplete. A live-backed replay is useful for comparison, but it is not
proof that the download contains the required implementation evidence.

Grade replay in two independent states:

- `static-replay`: the captured, already-rendered DOM and styles render entirely
  from local files;
- `hydrated-replay`: the captured application JavaScript hydrates and restores
  the downloaded interactions without a live document or live assets.

Passing `static-replay` does not imply that behavior has been recovered. A
hydration exception must remain visible in the evidence log even if the static
page looks correct.

Before using replay geometry as a visual target, verify every declared font with
`document.fonts.check(...)` and confirm the font request returned the captured
file. `document.fonts.status === "loaded"` is insufficient: it can be true when
the declared face failed and the browser silently substituted a fallback.

## 3. Decompose the complete downloaded DOM first

Create a component manifest before writing or revising React. Walk the captured
DOM from the page root and give every component a stable ID.

Create a component boundary when an element has one or more of these traits:

- semantic responsibility such as header, navigation, section, article,
  dialog, form, or footer;
- an independent layout, paint, animation, or stacking context;
- independent state or interaction behavior;
- a repeated structure that should share one implementation;
- a fixed, sticky, portal, canvas, WebGL, or overlay responsibility;
- a source marker such as `data-page-builder-section`, `data-studio-chrome`,
  `data-studio-item`, an ARIA role, or an accessible label.

The manifest must record:

- component ID, parent ID, source order, multiplicity, and source selector;
- downloaded HTML anchor and relevant source markers;
- CSS files/selectors and JavaScript chunks associated with it;
- assets and fonts it consumes;
- responsive variants;
- controls and state transitions;
- reconstruction file and verification status.

Do not build the page as one large `App` component. `App` should primarily
compose verified React components in source order.

## 4. Build a forensic evidence packet per DOM component

Reverse engineer one manifested component at a time from the downloaded replay.
Its evidence packet must include:

### Structure

- outer HTML and direct-child tree;
- semantic roles, accessible names, IDs, ARIA relationships, and source order;
- repeated item count and item keys;
- fixed, sticky, absolute, and portal relationships.

For portable/rich-text content, inventory the actual child block types and
inline nodes. Flattened `textContent` is not structural evidence: inline
portraits, media blocks, figures, captions, and linked fragments can disappear
while the prose still appears complete.

For schema-driven inspection or authoring UIs, recover the schema manifest
before constructing controls. Current DOM markers determine field presence and
array indices; they do not determine whether a value is a string, rich text,
media, link, radio, boolean, or array, nor do they contain the option contract.
When animated text duplicates hidden measurement and visible line trees, read
its canonical accessible value (`aria-label` or `.sr-only`) before falling back
to aggregate `textContent`.

### Styling

- all matching downloaded CSS selectors and their source files;
- computed grid/flex tracks, gap, padding, margin, alignment, wrapping, and
  overflow;
- typography, colors, borders, radii, shadows, opacity, filters, transforms,
  and stacking order;
- pseudo-elements, container queries, breakpoints, and motion preferences.

### JavaScript and behavior

- downloaded chunks containing its text, selector, accessible label, or source
  marker;
- click, hover, focus, keyboard, pointer, drag, resize, hold, scroll, and
  animation behavior;
- state variables, initial state, transitions, timing, easing, and cleanup;
- canvas/WebGL dimensions, inputs, render loop, resize behavior, and reduced
  motion behavior.

If visible control text is measured or truncated by JavaScript, retain the full
accessible label and record the visible label, available width, measurement
algorithm, and resize lifecycle at every required viewport. A fixed width that
matches one viewport is not equivalent behavior.

### Assets

- exact local asset mapping and original public URL;
- intrinsic dimensions, rendered dimensions, crop, fit, and responsive source;
- font file and used weight/style;
- asset checksum.

When the downloaded component uses a vector asset, preserve that vector source.
Do not substitute a rasterized screenshot merely because its CSS box matches at
one density. Compare vector detail at the rendered size and at a higher capture
scale before passing the asset gate.

If evidence is missing, record the gap instead of inventing behavior.

Separate client-visible behavior from external mutations. Reconstruct and test
validation, loading, error, success, reset, and accessibility states locally,
but do not trigger a live newsletter, checkout, analytics, account, or other
third-party mutation merely to prove the UI. Record the original transport and
any local deterministic adapter as an explicit deviation.

## 5. Reconstruct as clean React

Each manifested component receives:

- a dedicated React component or a documented reason to remain a small private
  child;
- scoped or clearly owned CSS;
- props for content and reusable variants;
- local state only for behavior the downloaded component actually owns;
- semantic HTML and matching accessible state;
- local public assets rather than hotlinks;
- deterministic cleanup for listeners, timers, animation frames, observers,
  canvases, and WebGL resources.

Repeated DOM structures must share one component implementation. Do not copy
markup or event logic for each instance.

Do not import the original minified application bundles into the clean React
reconstruction. They are forensic evidence, not maintainable source.

## 6. Verify each component before page assembly

A component is `verified` only after all applicable gates pass:

1. **DOM gate** — structure, order, item count, labels, and ARIA state match.
2. **Style gate** — equal-viewport geometry and computed visual contracts match.
3. **Behavior gate** — every inventoried state transition works.
4. **Responsive gate** — mobile, breakpoint, tall desktop, and wide desktop
   behavior match.
5. **Asset gate** — required assets load locally with the intended crop and
   dimensions.
6. **Accessibility gate** — keyboard access, focus, names, roles, and state are
   present.
7. **Lifecycle gate** — repeated mounting, resizing, and interaction do not leak
   listeners, timers, frames, or graphics resources.

Required comparison viewports:

- `390 x 844` mobile;
- `1024 x 768` breakpoint check;
- `1159 x 863` tall desktop;
- `1280 x 720` wide desktop.

Screenshots must compare the downloaded local replay and React reconstruction at
the same viewport, scroll position, animation phase, and interaction state.

Verify the effective `innerWidth` and `innerHeight` inside every comparison tab;
do not assume a browser-level viewport override reached an already-open or
claimed tab. Before capturing a section that contains its own scrollable editor,
carousel, terminal, or panel, normalize both the document scroll position and
each nested scroll position. Send page-scroll gestures from a non-scrollable
region so the gesture cannot silently change component state.

After changing an emulated viewport, reload both comparison pages and wait for
fonts, hydration, responsive layout, and deterministic animation state before
capturing. A freshly resized compositor frame can disagree with the measured
DOM even when the final responsive layout is correct.

For entry-gated typewriters and terminals, test four states independently:
before entry, partially typed, completed/editable, and reduced motion. Invisible
measurement spans prove reserved geometry; they do not prove the visible typing
state or completion timing.

For line-splitting text animation, compare motion-enabled and reduced-motion
geometry separately. The downloaded component can use atomic word wrappers and
line masks only when motion is enabled while leaving reduced-motion text in its
native unsplit flow.

For canvas and WebGL components, reduced motion is a rendered visual state, not
only a media-query or paused-loop check. Capture the static reduced-motion
output and compare it with the downloaded renderer before marking the component
verified.

For DOM-derived minimaps, page overviews, and inspection canvases, recover the
semantic element filter, rectangle-flattening method, classification, scale
equations, device-pixel-ratio policy, scroll transform, and resize/font-settle
lifecycle. A fixed miniature height or screenshot copied from one document
state is invalid because the overview must change with the assembled page.

For drag, hold, spring, and other transient pointer interactions, a final
resting screenshot is not a behavior check. Dispatch a real pointer sequence
and sample at least the origin, an active held/moved state, and the settled
state after release. Record the pointer delta, transformed geometry, temporary
visual state, and return tolerance. Also start the same gesture from one
non-handle region when the source restricts where interaction may begin.

When verifying a control whose behavior depends on the current scroll position,
account for automation that scrolls a target into the viewport before clicking.
Record the position at actual pointer dispatch or click an already-visible
control by its measured point; otherwise the test can falsely report the
control's own scroll delta as incorrect.

Build success, HTTP 200, total document height, or a full-page screenshot alone
does not prove component parity.

A matching component root box also does not prove its internal layout. Record
the direct-child boxes at every required breakpoint: fixed heights and
compensating gaps can preserve the outer height while headings, cards, and
lists are all wrong inside it.

Do not silently “fix” an awkward downloaded behavior while claiming parity.
Reproduce observed source behavior when it is safe, including reduced-motion
or loading anomalies, keep the accessible name correct, and document the
source-matched anomaly in the component evidence. Any intentional product
improvement must be tracked as a named deviation rather than hidden inside the
reverse-engineered result.

## 7. Assemble only verified components

After component verification:

1. compose components in the captured DOM order;
2. reproduce page-level stacking, sticky/fixed chrome, anchors, and scroll
   relationships;
3. verify section boundaries and total height without replacing intrinsic or
   viewport-relative sizing with arbitrary fixed heights;
4. rerun all component interactions in the assembled page;
5. run full-page desktop and mobile comparison.

A component that passes alone can still fail in the assembled page because of
inherited typography, containing blocks, clipping, stacking contexts, or scroll
geometry. Assembly therefore has its own parity gate.

## 8. Use the live website only as a final reference

The live website may be consulted only when:

- the downloaded replay is missing a server/API response;
- an animation or interaction state was not captured;
- a final check is needed to determine whether the downloaded capture was
  already stale.

Any evidence obtained only from the live website must be labeled `live-only` and
must not silently replace downloaded evidence. Improve the capture so the next
run can work from the download alone.

Before treating a live mismatch as a reconstruction failure, compare stable
item counts and identities against the immutable manifest. When live content
has been inserted, removed, or reordered since capture, record the exact drift
and continue verifying the captured component contract. Do not mutate the React
snapshot merely to match newer live content.

Captured animated text may contain line wrappers produced for the viewport at
capture time. Those wrappers are rendered state, not immutable component
boundaries. When the downloaded JavaScript resplits text after fonts load or on
resize, reconstruct that behavior and verify fresh line grouping at every target
viewport instead of hard-coding the captured lines.

## 9. Maintain an evidence-backed process loop

When testing reveals a repeatable failure mode:

1. record the concrete mismatch and the evidence that exposed it;
2. identify why the existing rules failed to prevent it;
3. add the smallest reusable rule or quality gate that would prevent recurrence;
4. apply the new rule to the current component and at least one adjacent or
   repeated component;
5. record the rule change in the process log below.

Do not add speculative rules. Every process change must come from an observed
reverse-engineering or verification failure.

## 10. Status vocabulary

- `captured`: downloaded evidence exists.
- `traced`: HTML, CSS, JavaScript, assets, and states are mapped.
- `implemented`: a clean React component exists.
- `verified`: all applicable component gates pass.
- `assembled`: the verified component is used in the complete page.
- `blocked`: required evidence is missing and the gap is recorded.

The page is complete only when every required manifest entry is verified and
assembled, and the full-page assembly passes responsive and interaction QA.

## Process improvement log

### 2026-08-19 — Download-first source boundary

Observed failure: screenshot and live-DOM inspection produced close silhouettes
but missed component counts, compiled behavior ownership, and the distinction
between captured and live-only dependencies.

Rule added: the immutable downloaded browser deliverable is the primary evidence
source. The live website is restricted to labeled gap-filling and final checks.

### 2026-08-19 — Manifest before implementation

Observed failure: rebuilding sections directly in `App.jsx` made it easy to miss
source subcomponents and duplicate reusable behavior.

Rule added: decompose the complete downloaded DOM and maintain a component
manifest before revising React.

### 2026-08-19 — Item-count parity gate

Observed failure: the reconstruction contained seventeen FAQ entries while the
downloaded DOM contains sixteen. Whole-page screenshots did not make the extra
item obvious.

Rule added: repeated-item count and source keys are mandatory DOM-gate evidence.

### 2026-08-19 — Separate static and hydrated replay gates

Observed failure: the captured DOM rendered locally while the raw downloaded
application failed hydration with `n.reason.enqueueModel is not a function`.
Treating the visible static page as a complete replay would hide missing
interaction evidence.

Rule added: record `static-replay` and `hydrated-replay` independently. Static
geometry may be inspected when hydration fails, but behavior remains unverified.

### 2026-08-19 — Prove font faces before measuring geometry

Observed failure: the mirror reported `document.fonts.status` as loaded while
`document.fonts.check` failed for both Geist faces. Relative CSS font URLs were
resolving against an asset-ID route, so measurements used a fallback font.

Rule added: a visual comparison cannot begin until every required font face is
confirmed loaded from its captured local response.

### 2026-08-19 — Preserve layout-wrapper boundaries

Observed failure: the FAQ reconstruction flattened the source section and its
inner twelve-column grid into one two-column grid. Mobile happened to look
close, but every desktop column, sticky position, and section height was wrong.

Rule added: the structure gate must record layout-bearing wrapper elements as
component boundaries. Do not move a wrapper's grid, flex, sticky, or sizing
responsibility onto its parent even when one viewport appears equivalent.

### 2026-08-19 — Preserve intrinsic and container-relative sizing

Observed failure: the closing terminal used fixed section, card, and `pre`
heights copied from one desktop screenshot. It only matched near 1159 px and was
wrong at mobile, breakpoint, and wide desktop sizes. The downloaded source sizes
the ASCII text with `100cqw / 82.8`, so the card height is intrinsic.

Rule added: before introducing a fixed dimension, trace whether the downloaded
component is sized by content, viewport units, container units, aspect ratio,
grid tracks, or min/max constraints. Preserve that sizing model and verify it at
all required viewports.

### 2026-08-20 — Verify transient terminal states separately

Observed failure: the captured terminal DOM contained every invisible measure
span while its visible typewriter was still empty. Reading the captured text as
the current visual state would falsely mark the behavior complete.

Rule added: entry-gated typewriters require separate before-entry, partial,
complete/editable, and reduced-motion checks. Reserved invisible text is used
for geometry only.

### 2026-08-20 — Reload after emulated viewport changes

Observed failure: the first mobile screenshot after switching directly from the
desktop emulation showed a stale compositor scale even though DOM geometry and
computed font sizes were already correct. Reloading both pages at the target
viewport produced matching captures.

Rule added: reload and settle both pages after changing an emulated viewport
before taking parity screenshots.

### 2026-08-19 — Recover scroll equations, not just endpoint screenshots

Observed failure: the footer looked correct only at the bottom of the page but
did not reproduce its reveal state while approaching the bottom.

Rule added: for scroll-driven components, trace the downloaded JavaScript
equation and verify at the start, midpoint, and end of its range. Endpoint
screenshots alone are not a behavior gate.

### 2026-08-20 — Preserve document-level sibling and stacking structure

Observed failure: the sticky footer was placed inside the reconstructed
`<main>`. Its geometry was correct at the page bottom, but its sticky layer
painted over the FAQ while scrolling because the source footer is a sibling of
the positioned, `z-index: 1` main element.

Rule added: the assembly gate must compare document-level parentage and
stacking-context ownership, not only component order. Fixed and sticky elements
must retain the same sibling relationship, positioned ancestor, background,
and z-index boundary as the downloaded DOM.

### 2026-08-20 — Recover renderer lifecycle and frame-budget controls

Observed failure: a DOM text texture resembled the canvas background in a still
image but omitted the downloaded shader, phrase data, 30 FPS cap, deferred
mount, and offscreen WebGL-context release. Keeping every canvas alive also
made the reconstructed page unnecessarily expensive.

Rule added: canvas/WebGL components are incomplete until their source data,
render-mode flags, frame cap, viewport gating, resize buffering, reduced-motion
path, and resource release policy are recovered and tested. Visual similarity
alone does not pass the lifecycle or performance gates.

### 2026-08-20 — Verify texture orientation and the rendered reduced-motion frame

Observed failure: the glyph field had the exact downloaded phrase, brightness
bytes, shader, and geometry, but its atlas texture used `flipY: true` instead of
the downloaded `flipY: false`. The reduced-motion loop was also paused before a
fully entered frame had been rendered. Geometry checks passed while the canvas
showed the wrong glyphs or remained blank.

Rule added: verify texture coordinate conventions against the downloaded
renderer, including texture-specific `flipY` values, and compare an actual
reduced-motion canvas capture. Matching data and shader text alone does not
prove the rendered state.

### 2026-08-20 — Preserve SplitText word and whitespace ownership

Observed failure: a simplified line detector put trailing spaces inside its
word spans and allowed hyphenated words to split inside a measurement span.
The resulting line strings rewrapped when rendered, producing extra lines at
the 1024px breakpoint even though larger desktop and mobile captures matched.
The downloaded splitter instead uses atomic inline-block words, keeps
whitespace as sibling text nodes, and bypasses splitting under reduced motion.

Rule added: port the downloaded word/whitespace ownership and reduced-motion
branch before trusting animated line geometry. Verify a narrow breakpoint that
forces hyphenated words and nested inline content across lines.

### 2026-08-20 — Exercise deferred interaction states during capture

Observed failure: the initial page download captured the repository explorer's
Next.js state and its lazy loader, but never activated the Astro tab. The loader
references `static/immutable/chunks/1dxb-dyj08pik.js`, so the default page looked
complete while an entire user-visible edition remained absent from the asset
manifest.

Rule added: activate every user-visible variant during capture, wait after each
transition, inventory newly loaded resources until the pass is stable, and
replay every variant offline. Recoveries made after the immutable snapshot must
live in a separately dated supplement with trigger, URL, headers, bytes, and
checksum recorded.

### 2026-08-20 — Preserve rich-text block and inline-media structure

Observed failure: the drawer copy was initially transcribed as paragraphs. Its
words looked complete, but that flattening dropped an inline author portrait
and an autoplaying 16:9 media block, so the final section was hundreds of pixels
too short and its downloaded asset set was incomplete.

Rule added: inventory rich-text child block types and inline nodes instead of
using flattened text as structure. Open portals, scroll each rich-text section
into view, and supplement any newly requested public media without modifying
the original capture.

### 2026-08-20 — Reproduce measured label truncation

Observed failure: a fixed drawer-navigation width matched at 1280px but changed
the navigation and content tracks at 1024px and 1159px. The source measures the
available label width, derives a character-count ellipsis, and keeps the full
accessible name.

Rule added: measured/truncated controls require the full accessible label, the
visible label at each viewport, the source measurement equation, and a resize
test. Do not replace that state machine with a width copied from one screenshot.

### 2026-08-20 — Split client-state parity from external mutation proof

Observed failure: the newsletter's downloaded client behavior was fully
recoverable, but its final action is a server mutation that would add a real
address to a live audience. Treating that mutation as an ordinary browser test
would create an unrelated external side effect.

Rule added: verify client validation, anti-spam, pending, success, reset, roles,
and disabled/read-only states with a deterministic local adapter. Retain and
document the downloaded live transport separately, and do not execute it unless
the user explicitly authorizes that external mutation.

### 2026-08-20 — Sample transient pointer interactions before and after release

Observed failure: the closing card finished at its origin whether its drag
worked or never started. A post-release screenshot therefore could not prove
the active elastic displacement, dashed boundary, header-only handle, or spring
return.

Rule added: drag and hold components require a real pointer sequence with
origin, active, and settled measurements, plus a non-handle negative test when
interaction ownership is restricted.

### 2026-08-20 — Recover DOM-derived minimap equations

Observed failure: the reconstructed page minimap used a fixed `823 px` canvas
and painted broad section surfaces. It resembled the small source thumbnail at
one page height, but the downloaded renderer flattens semantic child geometry,
uses separate white/accent layers, and derives canvas height from document and
viewport scale.

Rule added: dynamic page overviews require the downloaded element inventory,
rectangle and classification rules, scale equations, scroll transform, DPR,
and layout-settle lifecycle. Their canvas height must be derived from the
current assembly rather than copied from a screenshot.

### 2026-08-20 — Preserve downloaded vector assets

Observed failure: the header logo occupied the correct 24px and 30px boxes, but
a raster proxy blurred its fine diagonal bars. Root geometry and ordinary-scale
screenshots did not expose the asset substitution reliably.

Rule added: a source SVG must remain vector in the React reconstruction. The
asset gate now includes a high-scale detail comparison, applied to both the
mobile and desktop instances of the shared header logo.

### 2026-08-20 — Separate live content drift from implementation mismatch

Observed failure: final assembly QA showed every boundary after FAQ displaced
by exactly 73px. The current live page had inserted a seventeenth FAQ while the
immutable capture, content manifest, and reconstructed component correctly
contained sixteen. Following the live height would have corrupted snapshot
identity.

Rule added: compare repeated item identities before changing layout from a live
parity result. Record post-capture additions as `live-only` drift and keep the
React reconstruction bound to the immutable downloaded item set.

### 2026-08-20 — Audit all matching local selectors at leaf mismatches

Observed failure: the Showcase root was only 2.8125px short even though its
owned copy class had the correct fluid typography. An older, broader
`.showcase-section__intro p` rule won on specificity and reduced the paragraph
line height.

Rule added: when a leaf's computed style differs, inventory every matching
local selector, not only the intended component class. Remove stale cross-pass
rules and recheck the leaf, its direct parent, and the next section boundary.

### 2026-08-20 — Recover editor schemas instead of inferring field types

Observed failure: the first Studio content editor treated every discovered DOM
marker as a generic input or textarea. That discarded the downloaded media,
link, radio, boolean, array, rich-text, and reorder contracts. Reading
`textContent` also duplicated values rendered by both hidden measurement spans
and visible animated lines.

Rule added: schema-driven interfaces require the downloaded manifest and a
field-type renderer. DOM markers only gate presence and array indices. Animated
fields must prefer their canonical accessible value before raw text content.

### 2026-08-20 — Normalize effective viewport and nested scroll state

Observed failure: a final comparison reported a false document-height mismatch
because the reference tab was `1280 x 720` while a claimed reconstruction tab
remained `737 x 863`. A later wheel gesture aligned the page to the repository
section but also scrolled each code editor to a different line because the
pointer was over the nested editor.

Rule added: read the effective viewport from each tab, create a same-context tab
when an override does not apply, and verify both document and nested scroll
positions before any screenshot. Scroll the page from a non-scrollable region;
then use the component's own accessible control to normalize nested state.

### 2026-08-20 — Capture route transitions as two-phase components

Observed failure: treating Blog as only a destination DOM would miss the
full-screen canvas that owns the navigation gesture, blocks input, covers the
source route, commits history only when opaque, resets scroll, and then reveals
the destination. A start/end screenshot cannot recover that lifecycle.

Rule added: for every client-side route transition, capture the trigger state,
multiple cover samples, the exact history/DOM commit point, multiple reveal
samples, settled cleanup, mobile behavior, browser back/forward, resize, and
reduced motion. Download the route-specific chunks before implementation, map
the canvas/CSS marker and state machine, and rebuild the transition as its own
React component rather than embedding timing inside a link handler.
