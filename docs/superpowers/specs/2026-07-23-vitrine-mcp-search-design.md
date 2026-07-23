# Vitrine MCP Search — Product and Technical Design

**Date:** 2026-07-23
**Status:** Approved for planning
**Owner:** Vitrine

## Product Decision

Vitrine will expose its published application-design catalog to AI chat clients and coding agents through a remote, read-only Model Context Protocol server.

The first release serves existing Vitrine Pro customers. It uses the customer's Vitrine identity and entitlement on every tool call, returns authorized visual evidence inline, and never exposes object-storage credentials, internal keys, reusable media URLs, raw search documents, or another customer's private work.

V1 is intentionally narrower than the Vitrine web product:

- It searches published application evidence only.
- It does not search imported Sites.
- It does not mutate collections, projects, comparisons, notes, or source data.
- It does not crawl, import, analyze, repair, publish, or export content.
- It does not provide a general-purpose SQL, filesystem, or object-storage interface.

## Primary User and Job

The primary user is a product designer or product-building agent working in Codex, Claude, Cursor, or another OAuth-capable MCP client.

The job is:

> Find relevant, shipped interface evidence for one concrete design question, inspect the actual images, and carry trustworthy source context into design or implementation work without leaving the agent workflow.

Examples:

- Find iOS checkout screens with an order summary and trust signals.
- Compare mobile payment-confirmation flows.
- Find bottom-sheet UI elements used during onboarding.
- Find dark, single-column account-recovery patterns.

## Product Principles

### Evidence before synthesis

Vitrine returns observed images and factual catalog metadata. The consuming agent may interpret or compare the evidence, but Vitrine does not present generated design claims as observations.

### Authorization before discovery

Publication and entitlement constraints apply inside retrieval and media resolution before ranking, limiting, counts, or image delivery.

### Focused tools over a generic database tool

Separate tools give agents a clear intent, narrower schemas, better descriptions, and bounded visual payloads.

### Read-only first

Search and evidence delivery are useful without introducing mutation confirmation, project ownership, or agent-written catalog data. Mutation tools are a separate future design.

### Degrade without fabricating

If semantic retrieval is unavailable, keyword retrieval remains usable and the response reports degraded retrieval. If an image cannot be authorized or loaded, metadata may remain but no substitute image is fabricated.

## V1 Scope

V1 includes:

- A remote Streamable HTTP MCP endpoint
- OAuth-protected-resource metadata
- OAuth authorization-server metadata
- Dynamic client registration
- Authorization Code with PKCE (`S256`)
- Rotating refresh tokens
- Existing Vitrine account sign-in and explicit consent
- `search_screens`
- `search_flows`
- `search_ui_elements`
- `search_patterns`
- Hybrid retrieval over the existing versioned search projection
- Published and Pro-entitlement enforcement
- Inline thumbnail images
- Canonical Vitrine links
- Cursor pagination
- Per-user rate limits and payload limits
- Revocation and audit records
- Feature-flagged rollout

V1 excludes:

- Sites and website sections
- Apps as a dedicated tool
- Collections, projects, notes, and comparison mutations
- Full-resolution bulk downloads
- Visual-embedding or uploaded-image search
- Conversational answer generation
- Personalized ranking
- Anonymous access
- Free-plan MCP access
- Service-account or workspace-shared credentials
- API keys and personal access tokens

## Architecture Options

### Option A: Separate MCP service with first-party OAuth

This is the selected architecture.

`services/mcp` is deployed independently from the web API. It imports shared Vitrine domain modules and connects to the same Vitrine PostgreSQL database and object store. OAuth browser endpoints live in the existing API because that process already owns Vitrine sessions and account UI. Token validation and tool execution live in the MCP service.

Benefits:

- MCP transport and rate limits are isolated from the application API.
- Agents never receive browser session cookies.
- Search and entitlement code is reused rather than duplicated.
- The MCP service can be scaled, disabled, or rolled back independently.

### Option B: Mount MCP inside the existing API

This avoids one deployment but couples MCP transport, agent traffic, and future protocol evolution to a large Express process. It is not selected.

### Option C: Personal access tokens

This is faster to implement but does not provide the selected Mobbin-like connection experience, automatic client registration, or scoped consent. It is not selected.

## Component Boundaries

### `services/mcp`

Owns:

- Streamable HTTP `/mcp`
- Bearer-token extraction and validation
- MCP initialization and tool listing
- Tool argument validation
- Tool execution
- MCP text, structured-content, and image result formatting
- MCP-specific rate and payload limits
- Protocol-safe errors

It does not own passwords, web sessions, subscription mutation, search SQL, or object-storage authorization rules.

The transport is stateless. Each HTTP request creates a bounded MCP server/transport context, handles one request, and closes it. V1 has no server notifications or resumable server-side streams, so it does not require sticky sessions or an MCP session store.

### `services/api/src/mcpOAuth.ts`

Owns:

- OAuth protected-resource metadata
- OAuth authorization-server metadata
- Dynamic client registration
- Authorization UI handoff
- Consent recording
- Authorization-code issuance
- Access- and refresh-token exchange
- Refresh-token rotation
- Token-family revocation

It reuses the existing Vitrine session middleware for interactive account identity. Passwords are never handled by the MCP service.

### `src/mcpOAuthStore.ts`

Owns transactional OAuth persistence:

- Registered clients and redirect URIs
- One-time authorization-code hashes
- Consent grants
- Access-token hashes
- Refresh-token hashes and token families
- Expiry, rotation, revocation, and last-used timestamps

Raw authorization codes and tokens are returned once and are never stored. Database rows contain deterministic HMAC-SHA-256 token digests keyed by `VITRINE_MCP_TOKEN_PEPPER`, so lookup remains possible without retaining bearer credentials.

### `src/mcpSearchTools.ts`

Owns the stable agent-facing tool contracts and converts tool arguments into `NormalizedSearchRequest` values.

It reuses:

- `createSearchService`
- `PostgresSearchStore`
- `SearchAccess`
- Existing filter semantics
- Existing cursor binding
- Existing embedding fallback

It enforces the entity type required by each tool; clients cannot use a screen tool to retrieve another entity type.

### `src/mcpEvidence.ts`

Owns result evidence resolution:

- Resolves `mediaImageId` and `sourcePayload.evidence` IDs
- Rechecks that the evidence belongs to the authorized published version
- Loads object-backed thumbnail bytes through the trusted server adapter
- Validates media type and byte ceiling
- Produces MCP image content
- Produces the canonical Vitrine detail URL

It never exposes object keys, bucket names, storage endpoints, browser media tokens, or internal image URLs.

### Existing search/index services

The existing worker, versioned search documents, hybrid ranking, facets, suggestions, and web search routes remain unchanged in ownership. MCP is a new consumer of those domain services, not a proxy around `GET /search`.

## OAuth and Identity

### Discovery

The deployment exposes:

```text
/.well-known/oauth-protected-resource/mcp
/.well-known/oauth-authorization-server
/oauth/register
/oauth/authorize
/oauth/token
/oauth/revoke
/mcp
```

Protected-resource metadata names the canonical MCP URL and its authorization server.

### Client registration

Dynamic registration accepts:

- Client name
- HTTPS redirect URIs
- Loopback redirect URIs for native clients
- `authorization_code` and `refresh_token` grants only
- `code` response type only
- Public clients only in V1

Registration rejects wildcard, fragment-bearing, credential-bearing, non-loopback HTTP, and oversized redirect URIs.

Registration is rate-limited by IP and normalized redirect origin. It also caps redirect count, client-name length, metadata size, and registrations per origin. V1 ignores or rejects unsupported client metadata rather than persisting arbitrary fields.

### Authorization

The authorization endpoint requires:

- Registered client
- Exact redirect URI match
- `response_type=code`
- `code_challenge_method=S256`
- A valid PKCE challenge
- Requested scope exactly equal to or narrower than `mcp:search`
- Existing signed-in Vitrine account
- Current Pro entitlement
- Explicit consent for a new client or changed scope

The authorization code is single-use, client-bound, redirect-bound, PKCE-bound, user-bound, and expires after five minutes.

### Tokens

Access tokens:

- Are opaque random values
- Expire after one hour
- Carry no user data in the token value
- Bind one user, one client, and `mcp:search`

Refresh tokens:

- Are opaque random values
- Expire after 30 days
- Rotate on every use
- Revoke the token family when reuse is detected

Every MCP request validates:

- Token hash
- Expiry
- Revocation
- Scope
- User state
- Current Pro entitlement
- MCP feature flag

Downgrading, suspending, or deleting an account makes the next tool call fail even if the access token has not expired.

## Tool Contracts

All tools accept a single concrete design intent. Queries are trimmed and limited to 500 characters. The default result limit is six; the maximum is twelve. A cursor is opaque and can only be reused with identical query state.

Common optional arguments:

- `platform`: `ios`, `android`, or `web`
- `app`: exact Vitrine app name
- `limit`: integer from 1 to 12
- `cursor`: opaque pagination cursor

Array filters use OR within the array. Different filter groups use AND.

### `search_screens`

Purpose: find individual published application screens.

Arguments:

- `query` — required
- Common optional arguments
- `page_types`
- `product_areas`
- `components`
- `states`
- `themes`
- `layouts`

The tool enforces `type=screen`.

### `search_flows`

Purpose: find multi-step published user journeys.

Arguments:

- `query` — required
- Common optional arguments
- `product_areas`
- `components`

The tool enforces `type=flow`.

Each result includes ordered factual step labels and up to four authorized evidence thumbnails sampled in step order. It does not invent missing steps.

### `search_ui_elements`

Purpose: find observed UI elements and reconstructed design-system components.

Arguments:

- `query` — required
- Common optional arguments
- `components`
- `product_areas`
- `states`
- `themes`

The tool enforces `type=component`.

### `search_patterns`

Purpose: find observed layout and responsive patterns.

Arguments:

- `query` — required
- Common optional arguments
- `product_areas`
- `themes`
- `layouts`

The tool enforces `type=pattern`.

## Tool Results

Each tool returns:

1. Structured content for clients that support it
2. A concise text fallback
3. Inline MCP image blocks for authorized evidence

Structured content:

```json
{
  "request_id": "uuid",
  "items": [
    {
      "id": "screen:123",
      "type": "screen",
      "title": "Payment confirmation",
      "description": "Observed factual description",
      "app": "Example",
      "platform": "ios",
      "matched_context": [
        { "kind": "component", "value": "Trust badge" }
      ],
      "published_at": "2026-07-01T00:00:00.000Z",
      "vitrine_url": "https://vitrine.example/apps/example?evidence=SCREEN-123",
      "evidence": [
        { "content_index": 1, "media_type": "image/webp" }
      ]
    }
  ],
  "next_cursor": null,
  "has_more": false,
  "degraded": false
}
```

`content_index` is the zero-based position in the complete MCP `content` array returned for that tool call. The text fallback is always content index `0`; image blocks follow in item order and evidence order. Structured content repeats the same mapping for clients that expose it separately.

Result metadata never includes:

- Search vectors
- Embeddings
- Rank scores
- Raw searchable text
- Visible-text corpora beyond bounded matched context
- Source revision hashes
- Object keys
- Bucket or storage configuration
- Signed URLs
- User IDs
- Subscription records

## Media Delivery

Search metadata and image delivery are separate authorization steps.

For each result:

1. The search query returns an authorized published source.
2. The evidence resolver pins the source version and image ID.
3. The resolver confirms the evidence belongs to that version and app.
4. The resolver checks current user entitlement.
5. The object adapter loads the thumbnail.
6. The service validates MIME type and size.
7. The MCP response includes the image bytes inline.

Limits:

- Maximum 12 results
- Maximum four images for one flow
- Maximum 12 images in one tool response
- Thumbnail variant only
- Maximum 1.5 MiB per image
- Maximum 12 MiB total image bytes per response
- JPEG, PNG, and WebP only

If an image fails validation or authorization, the item remains only when its metadata is still authorized. Its `evidence` array is empty and the text fallback states that visual evidence was unavailable.

## Request Flow

```text
MCP client
  → discover protected resource and authorization server
  → dynamically register
  → redirect user to Vitrine authorize
  → existing Vitrine sign-in and explicit consent
  → exchange authorization code with PKCE
  → call /mcp with bearer access token
  → validate token, user state, scope, Pro entitlement, rate limit
  → validate one focused tool request
  → execute existing authorized hybrid search
  → resolve authorized published evidence thumbnails
  → return structured metadata, text fallback, and inline images
```

## Error Handling

OAuth endpoints use protocol-standard OAuth errors without internal details.

MCP tool errors use stable categories:

- `invalid_arguments`
- `authentication_required`
- `insufficient_scope`
- `pro_required`
- `rate_limited`
- `search_unavailable`
- `evidence_unavailable`

Rules:

- Invalid arguments do not run retrieval.
- Invalid or expired tokens return `401`.
- Valid tokens without scope return `403`.
- Accounts without current Pro access return `403` with `pro_required`.
- Rate limits include a retry hint.
- Semantic failures return keyword results with `degraded=true`.
- Complete search failures return a bounded tool error.
- Individual media failures do not fail unrelated authorized results.
- PostgreSQL, object-store, provider, and token values never appear in responses.

## Rate Limits and Abuse Controls

V1 limits:

- 60 tool calls per user per minute
- 120 tool calls per client per minute
- 12 concurrent tool calls per user
- Six failed token validations per IP per minute before temporary blocking
- 20 dynamic client registrations per IP per hour and five per redirect origin per hour
- Bounded query, filter, cursor, result, and image sizes

Admins use the same MCP payload limits. No role bypasses object, protocol, or byte ceilings.

## Privacy and Telemetry

Telemetry records:

- Request ID
- User and client identifiers as internal numeric IDs
- Tool name
- Latency
- Result and image counts
- Zero-result event
- Degraded retrieval
- Filter-group count
- Rate-limit outcome
- OAuth grant, refresh, revoke, and reuse-detection events

Telemetry does not record:

- Raw query text
- Returned screenshot text
- Image bytes
- Access or refresh tokens
- Authorization codes
- PKCE verifiers
- Private project or collection content
- Object keys or signed URLs

## Database Changes

A versioned migration creates:

- `mcp_oauth_clients`
- `mcp_oauth_consents`
- `mcp_oauth_codes`
- `mcp_oauth_token_families`
- `mcp_oauth_access_tokens`
- `mcp_oauth_refresh_tokens`

The migration includes:

- Foreign keys to users
- Unique token-hash constraints
- Exact client and redirect binding
- Expiry indexes
- Revocation indexes
- One-time authorization-code consumption
- Refresh-family reuse detection
- Cascading cleanup only where it cannot remove audit evidence accidentally

OAuth cleanup is a bounded maintenance task, never part of a search request.

## Configuration and Deployment

Configuration:

```dotenv
VITRINE_MCP_ENABLED=false
VITRINE_MCP_BASE_URL=
VITRINE_MCP_TOKEN_PEPPER=
VITRINE_MCP_ACCESS_TOKEN_TTL_SECONDS=3600
VITRINE_MCP_REFRESH_TOKEN_TTL_SECONDS=2592000
VITRINE_MCP_MAX_RESULTS=12
VITRINE_MCP_MAX_RESPONSE_BYTES=12582912
```

The MCP service uses the same:

- `DATABASE_URL` for the Vitrine Supabase database
- Search index version
- Embedding model configuration
- Object-store configuration

The legacy local `astryx` database is not an application deployment target.

## Verification

### OAuth tests

- Metadata is standards-shaped and uses canonical HTTPS URLs.
- Dynamic registration rejects unsafe redirects.
- Authorization requires an existing session, Pro access, consent, exact redirect matching, and PKCE S256.
- Codes expire, are single-use, and are client/redirect/verifier-bound.
- Access tokens expire and revoke.
- Refresh tokens rotate.
- Reusing a refresh token revokes the family.
- Scope escalation fails.
- Account downgrade or suspension blocks the next MCP request.
- Raw credentials never persist or appear in logs.

### Tool-contract tests

- Exactly four V1 tools are listed.
- Each JSON schema is bounded and rejects unknown fields.
- Each tool enforces its entity type.
- Filter semantics remain AND-across and OR-within.
- Cursor state cannot cross tools or queries.
- Result metadata excludes internal fields.
- Structured content and text fallback describe the same items.

### Authorization tests

- Unauthorized evidence cannot affect candidates, counts, ordering, cursors, or images.
- Free users cannot call tools.
- Published-only constraints apply to admins and customers.
- Images are reauthorized after search.
- Cross-app, cross-version, and removed evidence fail closed.

### Media tests

- Only allowed thumbnail types are emitted.
- Per-image and response byte ceilings are enforced.
- Flow evidence is ordered and bounded.
- Storage keys and signed URLs are absent.
- One failed image does not remove unrelated results.

### Retrieval tests

- Existing relevance benchmark remains above 85% top-five recall.
- Exact allowed entity names rank first.
- Semantic failure returns keyword results.
- Each tool returns correct entity types.
- Pagination has no duplicates or omissions.

### Protocol smoke tests

- MCP Inspector can discover, initialize, list tools, and call each tool.
- Codex can authorize and receive inline images.
- Claude can authorize and receive inline images.
- Cursor can authorize and receive inline images.
- Revoking consent terminates refresh and future calls.

## Performance Targets

- Tool metadata response p95 under 1 second at expected catalog scale
- First inline-image response p95 under 3 seconds
- OAuth token exchange p95 under 500 ms excluding user interaction
- No unbounded result, evidence, or media query
- No full catalog rebuild during an MCP request
- Search worker remains independently stoppable

## Rollout

### Phase 1: Protocol and OAuth disabled

- Deploy schema, OAuth endpoints, and MCP service with `VITRINE_MCP_ENABLED=false`.
- Verify metadata and token-store behavior in an isolated Vitrine test database.

### Phase 2: Internal allowlist

- Enable for selected Vitrine admins.
- Verify Codex, Claude, Cursor, image delivery, revocation, and rate limits.

### Phase 3: Pro cohort

- Enable for a small Pro cohort.
- Monitor authorization failure, latency, zero-result, degraded retrieval, media failure, and token reuse events.

### Phase 4: General Pro availability

- Enable for all active Pro customers after protocol, authorization, relevance, media, and performance gates pass.

Rollback disables `VITRINE_MCP_ENABLED`, rejects new authorization and MCP calls, and leaves token rows and search documents intact for diagnosis. Token families are revoked only when incident scope requires credential invalidation; ordinary rollback does not destroy grants automatically.

## Success Criteria

The release is successful when:

- A Pro customer can connect a standard OAuth-capable MCP client without manually copying a token.
- The client can discover exactly four read-only search tools.
- A focused query returns relevant factual metadata and authorized inline images.
- All results are published and currently entitled.
- No object key, reusable media URL, raw query, credential, or private research content leaks.
- Semantic outages preserve keyword retrieval.
- Revocation and plan downgrade take effect on the next request.
- Retrieval, media, OAuth, and performance release gates pass.
