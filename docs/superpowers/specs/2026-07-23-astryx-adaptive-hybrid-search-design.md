# Astryx Adaptive Hybrid Search — Product and Technical Design

Date: 2026-07-23

Status: Approved

## Product Decision

Astryx will add an **Adaptive Hybrid Search** experience for visual product research.

The feature combines:

- Natural-language semantic retrieval
- Predictable exact and full-text matching
- Structured, multi-select research filters
- A fast global Quick Search
- A dedicated Advanced Search results page
- Direct actions into collections, research projects, comparison, and evidence detail

V1 searches Apps, Screens, Flows, UI Elements, and Patterns. It does not search Sites, design tokens, projects, collections, or handoff documents.

The product promise is:

> Describe the product evidence you need, refine it precisely, and move useful results directly into your research workflow.

## Why This Direction

Astryx already exposes deterministic catalog search across app, screen, component, token, flow, and pattern records. It also has catalog facets, protected media, collections, comparison, and research projects. The missing layer is a search experience that supports both exploratory designer language and precise structured research.

The direction draws on two established discovery models:

- [Mobbin](https://mobbin.collaboo.co/changelog) uses quick filters, suggested filters, layered refinement, persistent platform and content-type state, screenshot text search, popularity/latest sorting, and flow-aware browsing. Its 2025 search update explicitly removed category-filter dead ends by allowing users to continue refining into screens, UI elements, or flows.
- [Dribbble](https://dribbble.com/search/search-filter) emphasizes dense visual browsing, related terms, category navigation, color and timeframe filters, and lightweight popularity or recency sorting.

Astryx will combine Mobbin's research precision with Dribbble's scanning speed. It will differentiate through hybrid semantic retrieval, surrounding-flow context, evidence-backed metadata, and direct project-to-handoff actions.

## Primary User and Job

The primary user is an individual product designer researching a product screen, component, interaction pattern, or journey.

Their job is:

> When I have either a clear reference in mind or an incomplete design intent, help me find relevant real-product evidence, narrow it without losing context, and move the strongest examples into comparison or a research project.

Representative searches include:

- `Airbnb checkout`
- `dark mobile checkout with trust signals`
- `empty states with an upgrade action`
- `bottom sheets used for account switching`
- `notification permission onboarding`
- `multi-step KYC with progress`

## Product Principles

### Intent and precision coexist

Natural-language meaning, exact words, aliases, metadata, and explicit filters contribute to one ranked result set. Semantic retrieval does not replace predictable known-item search.

### Evidence stays dominant

Search controls remain visually subordinate to the result imagery. Result cards expose factual context without showing internal similarity scores or generated query interpretations.

### No dead ends

Users can move between content types and layer compatible filters without losing valid search state. Impossible combinations are disabled or removed.

### Research actions are first class

Useful results can move directly into preview, surrounding-flow inspection, collections, projects, or comparison.

### Access rules apply before discovery

Unauthorized evidence cannot influence candidates, result totals, facets, suggestions, or related results.

### Degrade without collapsing

If semantic retrieval is unavailable, exact and full-text search remain usable. Partial media or facet failures do not erase valid results.

## V1 Scope

V1 includes:

- Global Quick Search
- Dedicated `/search` route
- Apps, Screens, Flows, UI Elements, and Patterns
- Natural-language, exact, phrase, alias, and visible-text retrieval
- Hybrid relevance ranking
- Multi-select structured filters
- Relevance, Recently added, and App A–Z sorting
- Cursor-based pagination
- Query and search state encoded in the URL
- Search suggestions from catalog taxonomy
- Device-local recent searches
- Result preview
- Surrounding-flow navigation
- Save to collection
- Add to research project
- Select two to five items for comparison
- Related searches
- Accessible desktop and narrow-screen experiences
- Feature-flagged rollout and deterministic fallback

V1 excludes:

- Search across Sites, tokens, projects, collections, and handoff documents
- Uploaded-image or visual-embedding search
- Personalized ranking
- Personalized related searches
- Conversational answer generation
- Exposing generated query interpretation chips
- User-authored Boolean query syntax
- Elasticsearch or OpenSearch
- Replacing existing entitlement or protected-media rules

## Experience and Information Architecture

### Quick Search

Quick Search remains available from the existing global search action and keyboard shortcut.

It contains:

- One keyword or natural-language input
- Up to ten recent searches stored on the current device
- Suggested starting intents when the query is empty
- Top authorized results grouped into Screens, Flows, UI Elements, Patterns, and Apps
- Keyboard navigation
- Instant preview
- `View all results`

Selecting `View all results` opens `/search` with the current query. Quick Search does not expose the complete filter system.

Recent searches:

- Are stored locally in the browser
- Are recorded only after explicit query submission
- Are limited to ten entries
- Can be cleared by the user
- Are not sent to analytics as history

### Advanced Search

The dedicated `/search` page contains:

- A persistent search field
- Content-type tabs: All, Screens, Flows, UI Elements, Patterns, Apps
- A collapsible filter sidebar on desktop
- A filter drawer on narrow screens
- Active-filter chips
- A visual result grid
- Sort controls
- Result count
- Cursor pagination through `Load more`
- A preview surface that preserves result context
- A comparison selection tray

The URL is the canonical public state for:

- Query
- Content type
- Selected filters
- Sort

The pagination cursor is not written to the URL. Refresh restores the first page for the encoded search state.

### Result Navigation

Opening and closing a preview preserves:

- Query
- Filters
- Sort
- Loaded pages
- Scroll position
- Current selection

Direct navigation to a source detail page remains available. Browser Back returns to the encoded search state.

### Result Actions

Each eligible result supports:

- Preview
- Open surrounding flow
- Open source evidence
- Save to collection
- Add to research project
- Select for comparison

An action appears only when it is meaningful for that entity and allowed for the user. Search never adds evidence automatically.

## Query and Filter Model

### Filter Semantics

Filters use:

- **AND across groups**
- **OR within a group**

Example:

```text
(Platform = iOS OR Platform = Android)
AND Product area = Checkout
AND (Component = Bottom sheet OR Component = Modal)
```

### V1 Filter Groups

- Content type
- Platform
- App
- App category
- Screen/page type
- Product area
- Flow
- UI component
- State
- Theme
- Layout pattern

Each filter option returns an authorized count. Zero-result options are disabled. Active filters appear as removable chips above the results.

`Clear all` clears filters while preserving the query. Clearing the query does not clear explicit filters.

### Desktop and Narrow-Screen Behavior

Desktop filters update results immediately.

Narrow-screen filter selections remain local to the open drawer until the user selects `Show results`. Closing the drawer without applying restores the last applied selections. This prevents repeated layout movement while retaining the same filter semantics.

### Invisible Query Interpretation

Astryx may normalize spelling, aliases, entity terms, and semantic intent internally. It does not expose generated interpretation chips, automatically activate structured filters, or rewrite the user's visible query.

Explicit user-selected filters remain authoritative.

## Result Presentation

The All tab renders one ranked stream. It does not divide the main page into content-type sections. Focused type tabs narrow the stream.

### Screen Results

- Large thumbnail
- App and platform
- Screen/page type
- Matching factual context

### Flow Results

- Ordered step preview
- App and platform
- Flow name
- Step count
- Matching step context

### UI Element Results

- Cropped evidence
- Component name
- State
- Source app

### Pattern Results

- Representative evidence
- Pattern name
- Number of represented apps
- Dominant matching context

### App Results

- App identity
- Category
- Available platforms
- Summary of matching content

### Matched Context

Cards may show:

- Highlighted visible screenshot text
- Exact title or alias match
- Matching component
- Matching flow
- Matching product area

Cards do not show:

- Vector similarity
- Internal rank score
- Generated query interpretation
- Unsupported quality or conversion claims

### Empty Results

An empty state offers:

- Remove the most restrictive active filter
- Search a related catalog term
- Switch to All content
- Clear filters while preserving the query

The system never fabricates results to avoid an empty state.

## Search Projection

V1 uses PostgreSQL with the `vector` extension. It does not introduce a separate search service.

One normalized search document is stored per searchable entity.

### Search Document Fields

- Stable document ID
- Entity type
- Stable source ID
- App ID and app name
- Platform
- App category
- Title
- Description
- Searchable aliases
- Visible screenshot text
- Screen/page type
- Product area
- Flow ID, name, and step context
- UI components
- States
- Theme
- Layout patterns
- Published timestamp
- Captured timestamp when available
- Protected media reference
- Access-scope fields required by the existing entitlement model
- PostgreSQL full-text vector
- Semantic embedding
- Index schema version
- Source revision
- Indexed timestamp

Arrays are stored in native PostgreSQL array or JSONB columns according to the existing repository conventions. Frequently filtered scalar and array fields receive appropriate B-tree or GIN indexes.

### Index Lifecycle

A search document is updated when its source is:

- Published
- Republished
- Repaired
- Reclassified
- Removed from the published catalog
- Changed in a way that affects access

Index updates are idempotent and keyed by entity type plus source ID.

Embeddings are generated asynchronously during indexing. A document without an embedding remains available to keyword search. Failed embedding generation is retried without removing the last valid searchable document.

The index stores a schema version so a new projection can be backfilled alongside the active version and switched only after verification.

## Retrieval and Ranking

### Candidate Retrieval

For each request, Astryx runs:

1. Exact, alias, and PostgreSQL full-text retrieval
2. Semantic vector retrieval when available
3. Structured SQL filtering

Entitlement and publication constraints are applied inside each candidate query before ranking, limiting, counts, or facets.

### Rank Fusion

Candidates are combined using deterministic reciprocal-rank fusion, followed by bounded boosts:

1. Exact app or entity title
2. Exact component or pattern alias
3. Exact phrase
4. Strong full-text relevance
5. Semantic relevance
6. Matching structured metadata
7. Freshness as a small tie-breaker

The precise constants live in one versioned rank configuration and are covered by relevance fixtures. They are not distributed across route or component code.

Exact entity-name matches must rank first when the entity passes the active filters.

### Sort Modes

- **Relevance:** Hybrid score, with stable document ID as final tie-breaker
- **Recently added:** Published timestamp descending, then relevance, then stable ID
- **App A–Z:** Normalized app name ascending, then relevance, then stable ID

### Related Searches

Related searches come from:

- Catalog taxonomy aliases
- Adjacent catalog terms
- Aggregate successful-query relationships once sufficient privacy-safe data exists

V1 does not use personal history to generate related searches.

### Semantic Fallback

If vector retrieval or query embedding fails:

- Keyword and full-text results are returned
- Structured filters and facets continue to work
- The request is marked as degraded in internal diagnostics
- The user does not receive a disruptive warning

## API Contract

### Search

`GET /api/search`

Accepted parameters:

- `q`
- `type`
- Repeated filter parameters for each filter group
- `sort`
- `cursor`
- `limit`

The server enforces a bounded page size. The client cannot request an unbounded result set.

The response contains:

- `requestId`
- `items`
- `facets`
- `typeCounts`
- `nextCursor`
- `hasMore`
- `degraded`

`degraded` is available for client diagnostics but does not trigger a warning banner in v1.

### Suggestions

`GET /api/search/suggestions`

Suggestions include:

- Apps
- Known entity titles
- Catalog taxonomy terms
- Approved aliases

Suggestions do not expose private content or derive from another user's history.

### Cursor Stability

The cursor is opaque and binds:

- Normalized query
- Active filters
- Sort
- Index schema version
- Final sort values

A cursor used with different search state returns a validation error. If the active index version changes between pages, the API returns a restart-required response and the client reloads from the first page while preserving visible search state.

## Frontend Component Boundaries

- `QuickSearch` owns modal state, device-local history, grouped top results, and keyboard navigation.
- `AdvancedSearchPage` coordinates URL state and requests.
- `SearchInput` owns input, suggestions, submission, and loading feedback.
- `SearchFilters` renders desktop facets.
- `SearchFilterDrawer` renders the same filter model on narrow screens.
- `ActiveSearchFilters` renders removable selections.
- `SearchResults` owns empty state and pagination presentation.
- Type-specific result cards render Screens, Flows, UI Elements, Patterns, and Apps.
- `SearchPreview` renders evidence without replacing search state.
- `SearchSelectionTray` owns comparison selection and bulk research actions.

Query parsing, filter normalization, and URL serialization are pure shared modules. They are not duplicated between Quick Search and Advanced Search.

## Backend Component Boundaries

- `SearchIndexRepository` reads and writes normalized documents.
- `SearchIndexer` projects published source entities.
- `SearchQueryService` validates requests and coordinates retrieval.
- `KeywordRetriever` returns exact and full-text candidates.
- `SemanticRetriever` returns vector candidates.
- `SearchRanker` performs deterministic rank fusion.
- `SearchFacetService` returns authorized facet and type counts.

Existing publication, entitlement, protected-media, collection, project, comparison, and evidence services remain authoritative. Search does not reimplement those rules.

## Request Flow

1. The user changes a query, applied filter, type, or sort.
2. The client writes canonical state to the URL.
3. The client cancels the previous request.
4. After the existing short debounce, the client sends one search request.
5. The backend validates, authorizes, retrieves, ranks, and facets.
6. The client accepts only the response for its latest request.
7. Results update without resetting scroll unless the query or primary content type changed.
8. `Load more` appends the next cursor page without replacing earlier selections.

No search request reads `/api/jobs`. Search indexing operations remain on administrative or worker surfaces.

## Error Handling

### Complete Search Failure

- Preserve query, filters, sort, and existing results
- Show an inline retry state
- Keep navigation and already loaded evidence usable

### Semantic Failure

- Return keyword results
- Record degraded diagnostics
- Do not interrupt the user

### Facet Failure

- Preserve loaded results
- Show filters as temporarily unavailable
- Allow retry without clearing search state

### Media Failure

- Render a neutral placeholder
- Preserve metadata and actions that do not require the missing media
- Fail closed when protected evidence cannot be authorized

### Stale Responses

Cancelled or superseded responses are discarded. They cannot replace newer search state.

### Indexing Failure

- Retry with bounded backoff
- Retain the last valid indexed document
- Expose terminal failures to administrators
- Never publish a partially authorized document

## Accessibility

- Quick Search and Advanced Search are fully keyboard operable.
- Search suggestions use the combobox pattern.
- Content-type tabs use the tabs pattern.
- Filter groups expose names, selection state, and counts.
- Result updates are announced without moving focus.
- Preview focus returns to its originating card.
- Comparison selection does not rely on color alone.
- Narrow-screen filters preserve focus on open and close.
- Reduced-motion preferences disable nonessential transitions.

## Privacy and Telemetry

Standard telemetry records:

- Request ID
- Latency
- Result count
- Zero-result event
- Degraded retrieval
- Filter-group use
- Sort use
- Reformulation event
- Result open
- Save to collection
- Add to project
- Comparison selection

Standard telemetry does not record:

- Raw query text
- Private project content
- Private notes
- Protected screenshot text
- Device-local recent-search history

Relevance development uses an explicit curated benchmark. Production diagnostics correlate technical events through request IDs rather than raw user queries.

## Verification

### Retrieval Tests

- Exact entity names rank first.
- Phrase and alias matches rank predictably.
- Typo handling does not override stronger exact matches.
- Natural-language queries satisfy benchmark expectations.
- Filters implement AND across groups and OR within groups.
- Sorting is stable.
- Unauthorized content cannot affect candidates, counts, facets, or suggestions.

### API and Indexing Tests

- Search-document create, update, repair, removal, and access changes
- Idempotent indexing
- Restartable backfill
- Cursor pagination without duplicates or omissions
- Cursor rejection when search state or index version changes
- Accurate combined-filter facets
- Semantic fallback
- Bounded page size
- Searchable-within-five-minutes freshness

### Experience Tests

- Quick Search hands state to `/search`.
- URL refresh restores query, filters, type, and sort.
- Preview and Back preserve search context.
- Narrow-screen filters apply only through `Show results`.
- Research actions target the correct source entity.
- Comparison accepts two to five eligible items.
- Keyboard, screen-reader, reduced-motion, and responsive behavior
- Empty, degraded, media-error, facet-error, and complete-error states

### Relevance Benchmark

The benchmark contains:

- Exact app and entity lookups
- Designer intent queries
- Component and state queries
- Flow and journey queries
- Visible screenshot text queries
- Ambiguous queries
- Expected zero-result queries
- Authorization-sensitive queries

Each benchmark query records a set of acceptable relevant entities rather than one complete exact ordering.

Release criteria:

- A relevant entity appears in the top five for at least 85% of benchmark queries.
- Exact entity-name matches rank first when allowed by filters.
- Every authorization-sensitive fixture excludes inaccessible evidence from results and counts.

## Performance Targets

- Search API p95 under 750 ms at expected catalog scale
- Suggestions API p95 under 250 ms
- Immediate visible acknowledgement of filter input
- Bounded first-page payload
- Newly published evidence searchable within five minutes
- No complete catalog-index rebuild during a search request
- No unbounded result or facet query

Performance tests use production-shaped document counts and filter cardinality.

## Rollout

### Phase 1: Projection

- Create the versioned search projection.
- Enable the PostgreSQL `vector` extension.
- Backfill searchable published entities.
- Verify counts, authorization, and benchmark coverage.

### Phase 2: Shadow Retrieval

- Run the new retrieval path against curated and production-shaped requests.
- Compare latency, zero-result behavior, and benchmark relevance.
- Do not expose shadow results to users.

### Phase 3: Admin Release

- Enable backend and frontend feature flags for administrators.
- Validate Quick Search handoff, full-page state, result actions, and rollback.

### Phase 4: Cohort Release

- Enable a small user cohort.
- Monitor latency, errors, degraded retrieval, zero results, reformulation, and research actions.

### Phase 5: General Release

- Replace the old Quick Search path only after relevance, performance, accessibility, and authorization gates pass.
- Retain deterministic keyword fallback during the rollout window.

## Feature Flags and Rollback

The backend and frontend use separate Advanced Search feature flags.

Rollback:

- Disables the Advanced Search page and new Quick Search path
- Restores the existing deterministic search UI
- Leaves the search projection intact for diagnosis
- Does not require removing indexed data

## Success Criteria

The feature is successful when:

- Designers can use either natural language or precise filters in the same search.
- Known-item searches remain predictable.
- Exploratory searches return relevant evidence without requiring taxonomy knowledge.
- Users can move results into collections, projects, or comparison without rebuilding context.
- Search state is bookmarkable and survives refresh.
- Authorization is enforced before discovery and counting.
- Semantic outages do not make search unavailable.
- The new search meets the relevance and performance release gates.
