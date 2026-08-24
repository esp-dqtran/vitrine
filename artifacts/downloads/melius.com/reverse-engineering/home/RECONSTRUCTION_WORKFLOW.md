# Melius homepage reconstruction workflow

## Evidence boundary

This reconstruction uses the downloaded Melius home-page capture only:

- captured HTML, JavaScript, CSS, and media in `../../2026-08-20-home/`;
- the offline mirror at `http://localhost:4186/` for rendered-state checks;
- the local React gallery in `react-demo/` for component comparisons.

The original public site is not an implementation dependency. A component is
not marked verified just because its resting appearance is close: its
responsive layout, source interaction states, asset lifecycle, and relevant
accessibility semantics must also match the downloaded source.

## Correct dependency order

```text
downloaded capture
  -> source inventory and DOM boundaries
  -> primitives
  -> stateful composites
  -> sections
  -> page assembly
  -> same-viewport visual and interaction QA
```

Page assembly remains blocked until the component it imports is verified.
This prevents a visually plausible static section from being mistaken for a
reconstruction of the source interaction.

## Component families and current findings

### Already verified reusable building blocks

- Header and announcement primitives/composites: `MeliusLogo`, `MenuToggle`,
  `AccordionContent`, `MenuLink`, `MeliusButton`, `TextLink`,
  `AnnouncementBar`, and `SiteHeader`.
- Canvas card internals: `SegmentedTab`, `SegmentedTabBar`, `MeliusTag`,
  `CanvasNodeCaption`, `CanvasMediaFrame`, and `CanvasNode`.
- Persona card internals: `PersonaIndent`, `PersonaMedia`, and `PersonaCard`.
- Pricing input primitive: `BillingToggle`.
- FAQ and footer primitives/composites: `FaqAccordionItem`, `FaqSection`,
  `NewsletterForm` idle state, `FooterLinkGroup`, `FooterStatus`, and
  `FooterMeta` static layout.

Their exact source evidence and viewport/state coverage are in
`COMPONENT_INVENTORY.md`.

### Stateful composites still requiring reconstruction

| Family | Actual downloaded-source behavior | Why the existing draft is insufficient |
| --- | --- | --- |
| Canvas showcase | Five vertically stacked, central-observer scenes; tabs scroll to scenes; active backgrounds cross-fade; each scene types a prompt and plays a node/connector graph before enabling drag. | A static scene or simple tab swap loses the synchronized scroll, playback, background/media lifecycle, and reduced-motion state. |
| Personas | Five-card, unbounded, click/selector-driven wrapping stack. In-view only gates entrance/media playback; it is not scroll-driven. | Fixed cards, a scroll listener, or an auto-rotating carousel changes the original interaction contract. |
| Models | WebGL texture carousel with drag, wheel, snap, loop, progress rail, and screen-reader-only provider list. | A DOM card carousel is a fallback design, not a source-equivalent implementation. |
| Pricing | Annual-by-default billing state, spring toggle, number-flow prices, savings tags, card reveals/hover treatments, and plan-specific CTA behavior. | Static text swapping misses the actual pricing-state transitions. |
| Cookie preferences | Third-party dialog with three consent categories, locked necessary state, independent switches, responsive action layout, and persistence/close behavior. | A generic modal would not reproduce the captured consent UI or its state rules. |

Detailed contracts are split by family to keep independent work auditable:

- `CANVAS_COMPONENT_SPEC.md`
- `PERSONA_COMPONENT_SPEC.md`
- `PRICING_MODELS_COMPONENT_SPEC.md`
- `CONSENT_COMPONENT_SPEC.md`

## Implementation sequence

1. `ConsentSwitch` and `CookiePreferencesDialog` are reconstructed and
   verified. Wire the existing `FooterMeta` callback during the footer-section
   assembly; consent-provider persistence remains an integration concern.
2. Rebuild `PersonaStackCardMotion`, `PersonaStack`, and `PersonaSelector`.
   Verify five-card wrapping at desktop and mobile before the Personas section.
3. Rebuild `PricingCard` primitives and `PricingSection`; preserve the missing
   source notch asset as an explicit fidelity blocker rather than inventing it.
4. Implement the WebGL `ModelCarousel` or explicitly keep it pending. Do not
   call a DOM fallback source-faithful.
5. Implement the canvas orchestrator last among these large composites because
   it depends on observer, dock, typed-prompt, playback, connector, drag,
   media, and reduced-motion contracts working together.
6. Assemble the page only from components whose inventory status is verified.

## Parallel-work rule

Source-analysis lanes may run independently by component family. Integration
does not: one owner updates the shared React gallery, shared CSS, inventory,
and page assembly after each source spec has been reviewed. This avoids both
merge conflicts and accidental mixing of unverified drafts into the final page.

## Verification gate per component

For every component, prove all applicable items against the offline mirror:

1. desktop geometry and real downloaded assets;
2. mobile geometry and breakpoint-specific structure;
3. every visible interactive state;
4. keyboard/ARIA semantics and focus behavior where the source exposes them;
5. motion/media/reduced-motion behavior; and
6. no missing captured asset or unverified external service dependency.

Only then change its inventory status from **analyzed** to **verified**.
