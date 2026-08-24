# Canvas prompt dock parity audit

Audited 2026-08-21 against the downloaded Melius mirror at `http://localhost:4186/#canvas` and the React reconstruction at `http://localhost:4185/`. The Filmmaking category and the same section scroll offset were used. The live website was not used.

## Verdict

The React prompt dock is not source-equivalent. It preserves the prompt copy, selected-category color, signup URL, and 353px desktop width, but it rebuilds the component as two separate cards and omits most of the original state machine.

## Confirmed differences

1. **Composition:** the downloaded tabs and prompt are one `353 x 114px` bordered panel. React renders a `353 x 47.359px` tab card plus a separate `353 x 74px` prompt link with an 8px gap.
2. **Position:** at the same 882px-wide viewport and `scrollY=1852`, the downloaded panel is at `x=24.956, y=207.248`; React is at `x=148.836`, with the prompt beginning at `y=262.602`. The downloaded dock position is driven by the hero-to-canvas morph and scroll progress; React is a static sticky block.
3. **Prompt control:** the downloaded DOM retains a labelled textarea (`What would you like to create?`) and swaps to a non-interactive typed overlay when docked. React uses a single anchor with a plain text span.
4. **Text layout:** downloaded typed copy is Futurist at `11px/15px`, width 241px, clamped to two lines. React is Ease Standard at `12.8px/15.36px`, width 285px, and wraps to three lines.
5. **Missing primitives:** React omits the leading 32 x 12 Melius waveform mark, the internal divider, the 32 x 32 source CTA icon, edge masks for the scrollable tabs, the animated border/glow layer, and the source shadow.
6. **State machine:** React only types the category copy at 22ms per character. It omits the pre-dock editable placeholder cycle, hero readiness/fallback, spring morph, pressing state, loading state, completion state, and associated CTA transitions.
7. **Tab/scroll behavior:** React updates `aria-current` but declares `role="tab"` without `aria-selected`. Its `scrollIntoView({block: "center"})` is only an approximation of the downloaded Lenis offset and dock-aware scroll contract.

## Evidence

- `02-source-filmmaking.jpg`
- `03-react-filmmaking.jpg`
- `CANVAS_COMPONENT_SPEC.md`, especially the dock and prompt contracts at lines 152-189.

