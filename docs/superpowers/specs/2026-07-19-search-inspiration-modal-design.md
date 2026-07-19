# Search Inspiration Modal Design

## Goal

Turn the search modal from a basic record finder into a fast source of design inspiration. A user should be able to start with a broad intent, browse visual references, follow related ideas, and take action without losing their search context.

## Direction

Use an **Inspiration Canvas** with a lightweight **Design Trail**. Search remains the entry point, but results prioritize screen imagery and relationships rather than text lists.

The preview stays inside the modal. This keeps the user in an exploratory loop and preserves their query, filters, scroll position, and selected result when they go back.

## Experience

### Starting state

When the modal opens with no query, show a concise set of intent prompts such as:

- Onboarding
- Checkout
- AI assistant
- Empty states
- Pricing
- Profile

The existing category and flow browsing can remain available, but these prompts become the primary invitation.

### Search results

After the user types or selects a prompt, display a thumbnail-first result grid grouped into:

- Screens
- Flows
- Patterns

Each card shows the visual reference, app name, screen or pattern name, and a small type label. Text metadata supports scanning but does not compete with the image.

### Preview and design trail

Selecting a result opens a preview panel within the modal. It contains:

- A larger view of the selected screen or reference
- Its surrounding flow, when available
- Four to six related references from other apps
- Actions to Open, Compare, or Save to collection

Selecting a related reference updates the preview in place. Back returns to the same results and scroll position.

### Responsive behavior

On desktop, the preview uses a split or expanded panel within the existing modal. On narrow screens, it becomes a full-height layer inside the modal with a clear Back control.

## Interaction and motion

- Preserve the current modal entrance and exit animation.
- Animate the results-to-preview transition with a short fade and horizontal shift.
- Keep keyboard focus within the modal.
- Support arrow-key result navigation, Enter to preview, and Escape to step back before closing the modal.
- Respect `prefers-reduced-motion`.

## Data flow

The existing catalog search remains the source for filtered results and facets. The modal should use the same search endpoint rather than maintaining a second local matching system.

Related references are requested only after a result is selected. The primary preview renders immediately; related results may load independently. A related-result failure must not block the selected result or its actions.

## Component boundaries

- `CommandPalette` owns modal navigation, query state integration, and close behavior.
- `InspirationPrompts` renders the empty-state intent shortcuts.
- `InspirationResults` renders grouped visual result sections and keyboard selection.
- `InspirationPreview` renders the selected reference, flow context, related references, and actions.

These components receive data and callbacks through explicit props so their layout and loading states can change independently.

## Empty, loading, and error states

- While searching, retain the previous results and show a small progress indicator.
- With no matches, suggest nearby intent prompts or removing active filters.
- If the main search fails, show a retry action without closing the modal.
- If related references fail, omit that section or show a small retry affordance while leaving the preview usable.

## Scope

Included:

- Intent prompts
- Visual grouped results
- In-modal preview
- Flow context and related references
- Open, Compare, and Save actions
- Keyboard and responsive behavior

Not included:

- AI-generated natural-language recommendations
- A new recommendation service or vector-search system
- Automatic redesign suggestions
- Changes to the full screen-detail page

## Success criteria

- A user can reach a useful visual reference from an empty modal in two interactions.
- Opening and closing previews does not reset the query, filters, or results position.
- Search, preview, and related-reference failures are isolated from one another.
- The entire primary flow works with keyboard navigation.
- Existing direct navigation to apps, screens, categories, and flows remains available.

## Verification

- Component tests cover prompt selection, grouped results, preview/back state preservation, and actions.
- Interaction tests cover keyboard navigation and Escape behavior.
- Responsive checks cover desktop and narrow layouts.
- Reduced-motion checks confirm transitions do not depend on animation timing.
