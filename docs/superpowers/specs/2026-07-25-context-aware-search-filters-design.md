# Context-Aware Search Filters

## Goal

Add filtering to the shared Apps and Sites search experience without creating separate filter systems. Search should begin in the context where it was opened, allow users to expand to the entire research library, and reuse the advanced-search filter model already present in Astryx.

## Scope

This design covers:

- The shared search trigger used by Apps and Sites.
- Quick Search filtering.
- Handoff from Quick Search to the full Search page.
- Context-aware Apps, Sites, and All scopes.
- Session-level filter persistence.
- Public/private catalog boundaries.

This design does not change gallery sorting, taxonomy hover previews, import workflows, or detail-page search.

## Search Scope

Search has three scopes:

- `apps`: the default when opened from the Apps gallery.
- `sites`: the default when opened from the Sites gallery.
- `all`: searches the entire research library.

The active scope is visible inside Search and can be changed without closing it.

Changing scope preserves compatible filters and removes incompatible filters. For example, Platform remains selected when moving from Apps to All, while a Site Section filter is removed when moving from Sites to Apps.

## Shared State

The main application owns one session-level search state containing:

- Query text.
- Scope.
- Result type.
- Selected filters.
- Sort order for the full results page.

Apps, Sites, Quick Search, and the full Search page consume this shared state. The state remains active while the user browses during the current application session. It is not persisted to long-term browser storage.

The existing advanced-search filter representation remains the canonical format. Context-specific gallery values are translated into that format instead of introducing a second filter schema.

## Filter Model

Quick Search exposes context-sensitive filters.

### Apps

- Platform
- Category
- Screens
- UI Elements
- Flows

### Sites

- Category
- Sections
- Styles

### All

- Result type
- Platform
- App
- Theme

The More filters panel exposes all compatible advanced fields:

- Platform
- App
- App category
- Screen or page type
- Product area
- Flow
- Component
- State
- Theme
- Layout
- Site section
- Site style

Site Section and Site Style extend the canonical search filter model because they are not currently represented by the advanced-search fields.

## Interaction

Quick Search contains:

1. A search input.
2. An Apps, Sites, and All scope selector.
3. A row of context-sensitive quick-filter chips.
4. Active-filter pills with individual removal.
5. A More filters action.
6. Grouped search results.

Selecting a quick-filter chip opens a compact option menu. Options include result counts when facets are available. Options with no results are hidden or disabled.

Filter changes update results immediately. Search remains debounced, and stale requests are cancelled.

More filters opens the existing advanced filter panel adapted to the active scope. Changes in this panel also apply immediately; there is no separate Apply step.

A Clear all action removes filters but preserves the query and scope.

The shared header search trigger shows the number of active filters, for example `Search on Web… · 3 filters`. Existing active taxonomy pills remain removable.

## Gallery Integration

Opening Search from Apps initializes scope to Apps. Opening it from Sites initializes scope to Sites.

The current gallery taxonomy selection is reflected in Search when it maps to a compatible filter. Changes made inside Search update the shared filter state. Gallery filters continue to control their own gallery results; the translation boundary prevents Apps and Sites taxonomies from becoming coupled to each other's component state.

Closing and reopening Search restores the most recent session filter state. Opening Search from a different gallery changes the scope but preserves filters compatible with the new scope.

## Full Search Handoff

View all results navigates to the full Search page and serializes:

- Query
- Scope
- Result type
- Filters
- Sort order

The full Search page parses the same URL state and renders the same active-filter pills and filter selections. Links are shareable and reload-safe.

## Data Flow

1. A gallery opens Search with its context.
2. The shared state resolves the active scope and compatible filters.
3. Quick Search sends the query, scope, and filters to the search API.
4. The API returns results and facet counts.
5. Quick Search renders results and filter options from the response.
6. Filter changes update shared state and issue a debounced replacement request.
7. View all serializes the state into the full Search URL.

## Loading and Errors

When filters change, current results remain visible while the replacement request loads. A subtle loading indicator communicates refresh progress.

If a request fails:

- Preserve the query, scope, filters, and current results.
- Show an inline error with Retry.
- Do not clear or silently relax filters.

Aborted stale requests do not surface as errors.

## Access Boundaries

Public users can search and filter only published public catalog data. Filter facets must be calculated from the same authorized result set.

Member and admin behavior remains governed by existing entitlements. Adding filters must not expose unpublished Apps, Sites, screens, flows, components, or facet counts to public users.

## Component Boundaries

- `SearchTrigger`: displays the search label, active-filter count, keyboard shortcut, and existing active taxonomy pill.
- Shared search-state owner: stores query, scope, filters, and session persistence.
- `QuickSearch`: composes the query field, scope selector, quick filters, active pills, results, and More filters action.
- Context filter configuration: declares visible filters and compatibility rules for Apps, Sites, and All.
- Advanced filter panel: renders the complete compatible filter set.
- Search API adapter: serializes the canonical state and cancels stale requests.
- Full Search page: parses and serializes the same state through the URL.

## Testing

Automated coverage must verify:

- Apps, Sites, and All default scopes.
- Scope switching and incompatible-filter removal.
- Compatible-filter preservation.
- Immediate result updates after filter changes.
- Active-filter count on the shared search trigger.
- Individual removal and Clear all.
- Session persistence after closing and reopening Search.
- URL serialization and reload-safe parsing.
- Quick Search to full Search handoff.
- Stale-request cancellation.
- Retry behavior without losing filters or current results.
- Public results and facets exclude unpublished content.
- Apps and Sites gallery state remain isolated.

## Success Criteria

- Apps and Sites use one filter-capable Search experience.
- Search defaults to the current gallery and can expand to All.
- Common filters are reachable in one interaction.
- Advanced filters remain available without overwhelming Quick Search.
- Results update immediately and retain stable state through errors.
- Active filters remain visible on both Search and its trigger.
- Public/private visibility rules are unchanged.
