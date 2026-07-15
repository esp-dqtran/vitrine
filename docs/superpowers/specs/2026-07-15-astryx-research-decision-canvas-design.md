# Astryx Research Project and Decision Canvas — Product Design

Date: 2026-07-15

Status: Approved conversational design; awaiting written-spec review

## Product Decision

Astryx will help product designers move from scattered references to an evidence-backed design decision.

The next feature is a **Research Project and Decision Canvas**: a constrained workspace where a designer gathers catalog and private evidence, aligns comparable journeys, annotates patterns, records decisions, and generates a cited handoff from only the evidence they selected.

The AI Competitive Brief remains part of the feature, but it is an output of the designer's workspace rather than a black-box starting point.

The product promise is:

> Turn real product evidence into a design direction your team can understand, challenge, and build.

## Why This Direction

Mobbin, Page Flows, and adjacent libraries are strong at discovering screens and flows. The unresolved designer job begins after discovery: relevant evidence is copied into Figma or another board, rearranged, annotated, compared, summarized, and handed to a product or engineering team.

Astryx already has the inputs required for a stronger workflow:

- Published, evidence-backed screens and ordered flows
- Screen metadata, visible text, components, product areas, and states
- Cross-application search and comparison
- Collections and research notes
- Versioned design-system snapshots
- Protected media and user entitlements

The Decision Canvas connects these inputs into a persistent research workflow. It does not compete on catalog size alone and does not ask designers to trust unsupported AI conclusions.

## Primary User and Job

The primary user is an individual product designer researching a web or mobile product decision.

Their job is:

> When I am designing or redesigning a product journey, help me find relevant real-product evidence, compare the alternatives in context, and communicate the direction I chose without manually rebuilding the research in another tool.

Common questions include:

- How do B2B products introduce SSO during onboarding?
- Where do finance apps explain permissions before requesting them?
- How do project-management products handle first-run empty states?
- What are the trade-offs between progressive and up-front profile setup?

## Product Principles

### Designer in control

Astryx may suggest, align, and summarize evidence. The designer decides what belongs on the canvas, how it is grouped, and which recommendation is accepted.

### Evidence before interpretation

Every generated observation and recommendation must cite evidence selected in the project. The interface distinguishes observed facts from AI interpretation.

### Context over isolated screenshots

Evidence retains its app, platform, flow, step, state, capture date, source version, and surrounding journey whenever those fields are available.

### Structured, not infinite

The canvas uses ordered comparison lanes and evidence cards. It is not a freeform infinite whiteboard. The constrained model keeps comparison, keyboard access, persistence, export, and AI input predictable.

### Private research stays private

User-uploaded evidence is visible only to its owner in v1. It is never added to the public catalog or used to train a shared catalog model.

### Existing access rules remain authoritative

A project can use only catalog evidence the user is entitled to access. Project creation does not bypass app unlocks, subscription state, signed-media checks, or anti-scraping controls.

## V1 Scope

V1 includes:

- Personal research projects
- A required research question and optional platform filter
- Suggested evidence from published catalog screens and flows
- Manual catalog search from within a project
- Two to five ordered comparison lanes
- Catalog screen and flow-step evidence cards
- Private PNG, JPEG, and WebP screenshot uploads
- Notes and pattern tags on evidence cards
- Lane-level conclusions
- Project-level decision and rationale
- AI synthesis from selected evidence only
- Cited Markdown and `DESIGN.md` export
- Project list, open, rename, duplicate, and delete

V1 excludes:

- Real-time collaboration, comments, mentions, and team permissions
- Public sharing links
- Video capture or playback
- An infinite canvas or arbitrary drawing tools
- Automatic Figma document creation
- Editable reconstruction of third-party interfaces
- Customer-triggered crawling of authenticated third-party applications
- MCP or public API access to research projects
- Automatic claims about conversion, usability, accessibility, or business performance without supporting evidence

## Core User Journey

### 1. Start a project

The designer creates a project with:

- A project title
- A required research question
- An optional platform filter: iOS, Android, Web, or All

Astryx creates a project with two empty lanes and returns initial evidence suggestions. Suggestions do not populate the canvas automatically.

### 2. Gather evidence

The designer can:

- Search published apps, screens, and flows
- Inspect why a suggestion matched the research question
- Preview the surrounding flow before adding a screen
- Add a complete flow as ordered evidence
- Add individual catalog screens
- Upload private screenshots

The project supports at most 100 evidence cards, including at most 25 private uploads. Each upload is at most 10 MB and must be PNG, JPEG, or WebP.

Adding a complete flow creates one ordered evidence card per flow step in the selected lane. The designer previews the resulting card count before confirming the add.

### 3. Organize comparison lanes

The designer creates two to five lanes. A lane usually represents an app, an approach, or an alternative journey.

Within each lane, the designer can:

- Reorder evidence cards
- Move cards between lanes
- Edit a step label
- Add a note
- Add or remove pattern tags
- Mark a card as important
- Remove a card without deleting its catalog source

Drag and drop is supplemented by keyboard-accessible Move earlier, Move later, and Move to lane actions.

A lane can be deleted only when it is empty. The designer must move or remove its evidence first, preventing an ambiguous bulk-delete action.

### 4. Compare and conclude

The canvas displays lanes side by side on desktop. Each card exposes its app, platform, flow, step, state, capture date, and source type. Selecting a card opens its full evidence view without leaving the project.

Each lane has a short conclusion field. The project also has:

- Decision
- Rationale
- Constraints
- Open questions

These fields remain designer-authored. AI may propose text, but it never silently replaces saved content.

### 5. Generate synthesis

The designer chooses **Synthesize selected evidence**. Astryx sends only the current project's selected evidence, notes, tags, lane conclusions, question, and constraints to the configured model.

The result contains:

- Executive read
- Observed common patterns
- Meaningful differences
- Missing or weakly represented states
- Alternatives and trade-offs
- Recommended direction
- Evidence-linked design requirements
- Open questions that still require user research or product input

Every result is a draft. The designer can accept text into the project decision fields, copy it, regenerate it, or ignore it.

### 6. Hand off

The designer exports Markdown or `DESIGN.md`. The export includes:

- Project question and constraints
- Compared alternatives
- Selected evidence and source links
- Designer notes and lane conclusions
- Accepted decision and rationale
- The latest synthesis, clearly labeled as AI-generated
- Evidence identifiers next to every generated claim

The export contains no expired signed-media URLs. It links back to authenticated Astryx evidence pages.

## Information Architecture

### Projects list

A new **Projects** destination appears in the existing application navigation. The list shows title, question, platform, evidence count, updated time, and whether synthesis is current or stale.

Primary actions are Create project, Open, Duplicate, Rename, and Delete.

Duplicating a project copies its question, lanes, cards, notes, tags, conclusions, and decision fields but not prior syntheses. Catalog references remain references. Private uploads reuse the same owner-scoped object until one copy is removed; the object is deleted only after its final project reference is removed.

### Project workspace

The desktop workspace has three regions:

1. **Evidence drawer** — query, filters, suggestions, catalog results, and private upload.
2. **Decision canvas** — two to five horizontally arranged comparison lanes.
3. **Insights panel** — project question, constraints, decision fields, synthesis, and export.

The evidence drawer and insights panel can collapse. The canvas remains the primary surface.

On narrow screens, lanes stack vertically and all actions remain available. V1 is optimized for desktop product-design work; mobile is functional but not optimized for dense comparison.

## Component Boundaries

The frontend adds focused components instead of extending the main application component with project-specific state:

- `ResearchProjectsPage` owns the project list.
- `ResearchProjectPage` loads one project and coordinates mutations.
- `EvidenceDrawer` owns search, suggestions, previews, and upload entry.
- `DecisionCanvas` renders lanes and cross-lane movement.
- `ComparisonLane` owns lane title, conclusion, and ordered cards.
- `EvidenceCard` renders one catalog or private reference.
- `ProjectInsightsPanel` owns constraints, decision fields, synthesis, and export.
- `SynthesisResult` renders observations, interpretations, and citations.

API calls live in a dedicated research-project client rather than being added to unrelated catalog or collection clients.

## Persistence Model

The database adds the following user-owned entities.

### `research_projects`

- `id`
- `user_id`
- `title`
- `question`
- `platform_filter`
- `constraints`
- `decision`
- `rationale`
- `open_questions`
- `revision`
- `created_at`
- `updated_at`

`revision` increments whenever evidence, lane order, notes, tags, conclusions, or decision context changes.

### `research_project_lanes`

- `id`
- `project_id`
- `title`
- `position`
- `conclusion`

Lane positions are unique within a project.

### `research_project_items`

- `id`
- `project_id`
- `lane_id`
- `position`
- `source_kind`: `catalog_screen`, `catalog_flow_step`, or `private_upload`
- Catalog app, version, flow, step, and image references when applicable
- Private object-storage key and media metadata when applicable
- `step_label`
- `note`
- `tags` as JSON
- `important`
- A small immutable evidence-summary snapshot used by exports and historical synthesis
- `created_at`
- `updated_at`

The source reference and snapshot are both retained. The reference supports current evidence navigation; the snapshot explains what a completed synthesis saw at generation time.

### `research_project_syntheses`

- `id`
- `project_id`
- `project_revision`
- `status`: `complete` or `failed`
- `result` as validated JSON
- `error_code` for failed attempts
- Model identifier and prompt-schema version
- `created_at`

A synthesis is marked stale when its `project_revision` differs from the current project revision.

## API Surface

All routes require an authenticated customer session and enforce project ownership.

- `GET /research-projects`
- `POST /research-projects`
- `GET /research-projects/:id`
- `PATCH /research-projects/:id`
- `DELETE /research-projects/:id`
- `POST /research-projects/:id/duplicate`
- Lane create, update, reorder, and delete routes
- Item add, update, move, reorder, and delete routes
- `GET /research-projects/:id/suggestions`
- `POST /research-projects/:id/uploads`
- `POST /research-projects/:id/synthesize`
- `GET /research-projects/:id/export.md`

Mutating routes accept the expected project revision. A stale revision returns a conflict response and the latest project state instead of overwriting a newer edit.

The API returns project data as one workspace document so the frontend does not assemble a canvas through many dependent reads.

## Evidence Retrieval

Suggestions search only the latest published app versions accessible to the user. Ranking uses existing structured metadata:

- Flow title, description, category, tags, and step labels
- Screen type, product area, description, visible text, visible states, components, and layout patterns
- Platform and app category
- Capture recency as a secondary signal

The first implementation uses deterministic text scoring and filters. It does not require embeddings or a vector database. Each suggestion includes matching fields so the designer understands why it appeared.

The system requires evidence from at least two distinct lanes before synthesis. It does not require that every lane represent a different app because designers may compare alternative journeys within one product.

## AI Synthesis and Trust Boundary

The existing browser-driven `llmChat.ts` session is not used for customer requests. It requires interactive third-party login and is not a production service boundary.

Research synthesis uses a server-side provider adapter configured by environment. The adapter accepts a versioned structured request and returns a structured JSON result. V1 exposes no model selector in the UI.

Before generation, Astryx creates an evidence allowlist containing opaque project evidence IDs and compact metadata. Private object-storage credentials and raw signed URLs are never placed in prompts.

After generation, Astryx validates:

- The result matches the versioned schema
- Every citation refers to an allowlisted evidence ID
- Every observed claim has at least one citation
- Interpretation and recommendation fields are labeled separately
- The result contains no unknown apps, flows, or screens presented as observed evidence

An invalid response is retried once with validation errors. A second invalid response fails the generation and displays no partial synthesis.

Generation is synchronous in v1 with a 60-second server timeout. The completed or failed attempt is persisted. RabbitMQ and a dedicated worker are introduced only if production latency or request reliability makes asynchronous generation necessary.

## Private Upload Handling

Private screenshots use the existing S3-compatible object-storage layer and signed-media delivery pattern.

The server validates file type and size before accepting an upload. Stored objects use non-guessable, user-scoped keys. Private uploads are never served through public catalog routes.

Deleting a private item deletes its object only when no remaining project item references that object. Deleting a project removes its unreferenced private objects. Cleanup failures are recorded for retry rather than hiding a successful project deletion.

V1 does not run visual analysis on private screenshots. The designer provides the step label, notes, and tags used in synthesis. Automatic captioning can be added later behind the same evidence interface.

## Entitlements and Security

- Every project, lane, item, upload, synthesis, and export is scoped to its owner.
- Catalog items are checked against existing app access rules when added.
- Catalog media access is checked again when a project is opened or exported.
- Losing access does not erase designer-authored notes or historical synthesis, but restricted catalog images and source links are redacted until access returns.
- Private uploads use short-lived signed delivery URLs.
- Export endpoints are rate limited and do not contain raw object keys or expiring signatures.
- Project limits and upload limits are enforced server-side.
- Existing access-event and anti-scraping controls remain active for catalog media opened through a project.

V1 adds no research-specific Free or Pro limits. Existing app entitlements determine which catalog evidence can be used. Product-specific monetization is deferred until usage data exists.

## Failure and Empty States

### No suggestions

The project remains usable. Astryx recommends broadening the question, changing the platform filter, searching manually, or uploading private evidence.

### Insufficient comparison evidence

Synthesis is disabled until the project contains evidence in at least two lanes. The interface explains the requirement.

### Restricted catalog evidence

The card keeps its note and step label but redacts media. The designer can remove it, restore access, or continue with the remaining evidence.

### Upload failure

The failed file remains local to the upload control with a retry action. No empty project item is created.

### Model timeout or provider failure

The project and evidence remain unchanged. The insights panel shows a retryable error. No partial recommendation is displayed.

### Invalid model citations

Astryx retries once, then fails closed. Unsupported claims are never silently stripped into an apparently valid report.

### Concurrent edit

A stale mutation receives the latest project state and a clear conflict message. V1 does not attempt field-level merge.

## Accessibility and Interaction Requirements

- All project actions are usable without drag and drop.
- Lanes and cards have programmatic names and positions.
- Move actions announce the new lane and position.
- Focus returns predictably after moving or deleting a card.
- Evidence metadata and tags are text, not color-only indicators.
- The full-screen evidence viewer supports keyboard dismissal and focus trapping.
- Loading, upload, synthesis, error, and stale states are announced through appropriate live regions.
- The desktop board supports horizontal scrolling without trapping normal page navigation.

## Testing Strategy

### Domain and unit tests

- Deterministic suggestion ranking and match explanations
- Project revision increments
- Lane and item ordering invariants
- Project and upload limits
- Evidence snapshot creation
- Synthesis schema parsing and citation allowlisting
- Stale-synthesis detection
- Markdown escaping and stable export output

### API integration tests

- Authentication and ownership on every route
- Catalog entitlement checks when adding, reading, and exporting evidence
- Project CRUD, duplication, lane movement, and item reorder
- Revision conflicts
- Upload type, size, signed access, deletion, and cleanup retry
- Insufficient-evidence rejection
- Provider timeout, one validation retry, and failed-closed behavior
- Export redaction for inaccessible evidence

### Frontend component tests

- Empty project and no-suggestion states
- Evidence search and add flow
- Lane creation, rename, reorder, and deletion
- Card notes, tags, important state, and keyboard movement
- Private upload success and failure
- Current, stale, failed, and completed synthesis states
- Export and delete confirmation

### End-to-end acceptance test

A seeded customer creates a project, adds published evidence from two apps into two lanes, uploads one private screenshot, annotates the evidence, generates synthesis through a fake provider, opens every citation, accepts a recommendation into the project decision, and downloads a deterministic `DESIGN.md` export.

The test also proves that another customer cannot read the project or private media.

## Success Criteria

The v1 feature is complete when:

- A designer can create and reopen a persistent personal research project.
- They can compare evidence across two to five lanes without using another tool.
- They can add catalog evidence and private screenshots, notes, and tags.
- Every synthesis observation is supported by a valid selected-evidence citation.
- Unsupported or malformed model output fails closed.
- The designer can edit and retain their own decision independently of AI output.
- The exported Markdown preserves the question, alternatives, evidence, rationale, and citations.
- Project ownership, catalog entitlements, and private-media authorization hold across every route.
- Existing catalog search, comparison, collections, exports, and media access continue to pass regression tests.

## Product Metrics

The primary activation event is a project that contains evidence in at least two lanes and either records a decision or exports a handoff.

Supporting measures are:

- Time from project creation to first evidence added
- Percentage of projects reaching two populated lanes
- Percentage of eligible projects generating synthesis
- Percentage of generated syntheses followed by a designer-authored decision edit
- Percentage of projects exported
- Citation-open rate from synthesis
- Private-upload usage rate
- Synthesis failure and retry rates

Metrics must not capture private image contents, designer notes, questions, or generated report text.

## Rollout Boundary

V1 is a single-user vertical slice. It should be released behind a feature flag until seeded end-to-end tests and live browser acceptance pass.

After release, the next decisions should be driven by observed usage and designer interviews:

1. Add shareable, read-only project links or team collaboration.
2. Add Figma export for selected evidence and decision context.
3. Add automatic analysis for private screenshots.
4. Add video evidence and interaction playback.
5. Add MCP or API access to accepted decisions and handoffs.

None of these follow-ups are required to call the initial Research Project and Decision Canvas complete.
