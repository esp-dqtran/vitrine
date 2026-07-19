# Users Filter Render Boundary Design

## Problem

`UsersPage` owns the search query and account filter and calls `useUsersDirectory` directly. Every search or filter change therefore rerenders the page root. The directory hook also marks itself `loading` for each first-page request, so the page temporarily swaps its header, directory, and analytics panel for the full-page spinner.

## Decision

Move all directory-specific state and behavior into a `UsersDirectoryContainer` child:

- Own `query`, `filter`, selected user, account updates, pagination, and `useUsersDirectory` inside the directory container.
- Keep `UsersPage` responsible only for the page shell and feature-usage insights.
- Preserve the current rows during a debounced filter request and expose a small loading status within the directory panel.
- Keep the initial directory load and directory errors local to the directory panel so they never replace the Users header or analytics panel.

This creates a real React render boundary: state updates caused by search and filters start at `UsersDirectoryContainer`, so React does not rerun `UsersPage` or `UserUsageInsights`.

## Alternatives Considered

1. **Isolated directory container (selected).** Fixes the ownership problem at its source, keeps the page stable, and requires no new state library.
2. **Memoize the existing page children.** Reduces some child work, but `UsersPage` still rerenders and its top-level loading branch still replaces the page.
3. **Move filters into a global store.** Would isolate subscriptions but adds unnecessary infrastructure for local UI state.

## Loading and Error Behavior

- On first directory load, render a spinner inside the directory column.
- On a later search/filter request, keep the current rows visible and mark the directory as updating.
- On a directory request failure, show the retry state inside the directory column.
- Insight loading and errors retain their existing page-level behavior because they are unrelated to filtering.

## Testing

Add a component-boundary regression test proving that `UsersPage` no longer imports or calls `useUsersDirectory`, and that `UsersDirectoryContainer` owns the search/filter state and hook. Keep the existing server-rendered Users workspace tests and run the full test and production build commands.
