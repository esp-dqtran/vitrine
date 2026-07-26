# Shared Apps and Sites Discovery Toolbar Design

## Goal

Make the Sites discovery toolbar use the same component, spacing, sort-tab styling, and active animation as the Apps discovery toolbar. Remove the Sites Filter control and remove the bottom border from the Apps toolbar.

## Scope

- Add one shared `ReferenceDiscoveryToolbar` component for Apps and Sites.
- Keep the Apps iOS/Web platform control as an optional leading element.
- Render the Sites `Latest` and `Most popular` options through the shared sort toolbar.
- Remove the Sites Filter button, clear action, and filter-open state. The Sites taxonomy remains visible, and clicking an already-selected taxonomy value still clears it.
- Use one shared CSS block for toolbar height, top border, sort typography, hover color, active underline animation, horizontal overflow, and reduced-motion behavior.
- Remove the toolbar bottom border on both Apps and Sites.
- Preserve all existing sorting, platform selection, search, routing, and data-loading behavior.

## Component

`ReferenceDiscoveryToolbar` accepts:

- an accessible tab-list label;
- the active string value;
- an ordered list of `{ value, label }` options;
- an `onChange` callback;
- an optional leading React node for Apps platform selection.

The component owns only toolbar and sort-tab markup. Apps and Sites continue to own their page-specific state.

## Styling

The shared toolbar has a 64px minimum height, a top border, no bottom border, and a 24px gap. Sort labels use secondary text by default, become primary text on hover, focus, and selection, and animate the same underline used by Apps today. Reduced-motion users receive the state change without transitions.

Apps-specific platform-pill styling remains scoped to `.apps-discovery__platform`.

## Tests

- Assert Apps and Sites render the shared toolbar contract.
- Assert Sites no longer renders Filter or its toolbar actions.
- Assert the shared toolbar CSS contains the Apps sort color and active-underline behavior.
- Assert the shared toolbar has a top border and no bottom border.
- Run the Apps, Sites, and application boundary tests plus the production build.
