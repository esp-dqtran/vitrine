# App Knowledge ChatGPT Browser Provider

**Date:** 2026-07-23
**Status:** Approved design
**Scope:** App Knowledge generation only

## Goal

Run App Knowledge evidence analysis and synthesis through the normal signed-in
ChatGPT web application instead of an OpenAI-compatible API. Reuse Astryx's
existing Playwright-based ChatGPT integration and authenticated
`~/.config/chatgpt-cli/profile` without requiring `RESEARCH_LLM_*` credentials.

The change must preserve the existing App Knowledge evidence manifest,
quarantine, caching, citation validation, resumability, review workflow, and
pilot verification contracts.

## Non-goals

- Replacing the existing ChatGPT browser implementation.
- Changing caption, synthesis, autonomous research, or Feature Document
  providers.
- Adding a separate `chatgpt-cli` subprocess or MCP dependency.
- Sharing conversations between evidence items.
- Increasing the pool beyond two ChatGPT tabs.
- Bypassing App Knowledge API authorization or RabbitMQ job processing.

## Existing Capability

`src/llmChat.ts` already provides the required browser primitives:

- a persistent authenticated ChatGPT browser profile;
- normal `chatgpt.com` navigation;
- file upload through `#upload-files`;
- in-memory Playwright file payloads containing name, MIME type, and bytes;
- fresh chats for every request;
- response extraction from assistant message bubbles; and
- a multi-tab pool sharing one authenticated browser context.

App Knowledge currently cannot use this path because its worker constructs an
`AppKnowledgeProvider` only when `RESEARCH_LLM_*` config creates a multimodal
JSON API provider. The API also treats an empty `RESEARCH_LLM_MODEL` as meaning
that App Knowledge generation is unavailable.

## Architecture

### Provider selection

App Knowledge will use a dedicated provider setting:

```env
APP_KNOWLEDGE_PROVIDER=chatgpt-browser
APP_KNOWLEDGE_BROWSER_CONCURRENCY=2
```

`chatgpt-browser` is the only supported App Knowledge worker value.
Concurrency defaults to two and is constrained to one or two. The API
advertises the stable provider model identity `chatgpt-browser`; it does not
read or require `RESEARCH_LLM_*`. Missing or unknown App Knowledge provider
values fail closed.

The existing multimodal API adapter remains available to other repository
features, but the App Knowledge API and worker do not select it.

### Browser provider adapter

A focused adapter will implement `AppKnowledgeProvider` on top of
`ChatSession`:

- `analyzeEvidence` sends the existing structured evidence prompt and one
  `ChatAttachment` containing the verified raster bytes.
- `synthesize` sends the existing synthesis prompt without an attachment.
- Both methods parse the returned text as one JSON object and return the parsed
  value to the existing App Knowledge validators.
- A response may be raw JSON or a single fenced `json` block. Prose surrounding
  JSON, multiple objects, empty output, or malformed JSON remains invalid.
- The adapter reports `model = "chatgpt-browser"`.

The adapter does not weaken existing schema validation. A browser reply that
does not satisfy the App Knowledge contract follows the existing bounded
repair/retry path.

### Two-tab scheduling

One provider instance owns exactly two `ChatSession` objects from
`startChatPool("chatgpt", 2)`. Evidence requests are assigned through the
existing bounded-concurrency analysis runtime so each session handles at most
one request at a time. Results retain manifest order regardless of completion
order.

Synthesis runs only after evidence analysis completes and may use either idle
session. Each `ask` call navigates to a fresh chat, so evidence from one item
cannot leak into another item or the final synthesis conversation.

### Job-scoped lifecycle

The browser pool is lazy and job-scoped:

1. RabbitMQ delivers one `generate-app-knowledge` job.
2. The worker creates the two-tab ChatGPT pool only for that job.
3. The existing App Knowledge service processes or resumes the job.
4. The worker closes the shared browser context in `finally`, regardless of
   success, cancellation, provider failure, or validation failure.

The import worker must not open ChatGPT during startup or while handling other
job types. A failed pool startup marks the App Knowledge job with the existing
safe provider-unavailable outcome.

## Cancellation and Recovery

`ChatSession.ask` will accept an optional abort signal while preserving its
current call signature for existing consumers.

Browser waits will check the signal during:

- login/input readiness;
- attachment upload readiness;
- message submission retries; and
- stable-response polling.

Cancellation stops further evidence assignment, closes the job-scoped browser
context, and uses the existing App Knowledge `cancelled` status. A response
already in progress may take up to the next bounded polling interval to observe
the signal.

Completed evidence and cache entries remain durable. Restarting or resuming the
job reuses those results and opens a new two-tab browser pool only for remaining
evidence.

## Authentication

The provider uses the existing ChatGPT profile resolution:

```text
~/.config/chatgpt-cli/profile
```

If the profile is authenticated, no new login is required. If ChatGPT is logged
out when an image upload is attempted, the job fails safely with the existing
sanitized provider error and can be resumed after the user signs in.

The worker never reads or copies cookies, tokens, passwords, or browser profile
contents. `HEADLESS=true` is supported only when the persistent profile is
already authenticated.

## Error Handling

Errors exposed outside the worker remain bounded and secret-free:

- missing or expired ChatGPT login → provider unavailable;
- missing upload control or unfinished upload → provider unavailable;
- no stable assistant response before the existing timeout → provider timeout;
- malformed or fenced-with-prose output → invalid output;
- schema or citation mismatch → existing validation failure;
- selector drift → provider unavailable with no page body or session data;
- cancellation → cancelled, not error.

Raw ChatGPT responses, prompts, browser profile paths, and page content are not
stored in job error messages.

## API and UI Behavior

The existing App Knowledge API, SSE progress stream, Analysis tab, and curator
review UI remain unchanged. Starting a job still requires an authenticated
admin and a valid app/platform/version target.

The provider model displayed in diagnostics and stored with jobs and revisions
is `chatgpt-browser`. Progress continues to report evidence totals, completed
items, cache hits, and failures through database notifications rather than
polling.

## Testing

Automated tests will cover:

- provider selection without `RESEARCH_LLM_*`;
- rejection of unknown provider values and invalid concurrency;
- raw and singly fenced JSON parsing;
- rejection of prose, multiple objects, and malformed JSON;
- verified image bytes passed as an in-memory `ChatAttachment`;
- two sessions never receiving concurrent requests individually;
- deterministic result order across the two-tab pool;
- synthesis without an attachment;
- abort propagation during browser waits;
- pool closure on success, failure, and cancellation;
- no browser startup for unrelated worker jobs;
- API availability reporting `chatgpt-browser`; and
- unchanged existing caption/research `ChatSession` consumers.

The existing App Knowledge unit, API, SSE, review, build, and 15five pilot
verification suites remain required gates.

## Operational Test

After implementation:

1. Confirm migrations 17 and 18 are current.
2. Confirm RabbitMQ and object storage are available.
3. Start the API and import worker with
   `APP_KNOWLEDGE_PROVIDER=chatgpt-browser`.
4. If necessary, authenticate once in the browser opened from the persistent
   ChatGPT profile.
5. Submit `15five / web / version 1` through the existing admin API.
6. Observe SSE/job progress without polling.
7. Resume after an intentional cancellation to prove durability.
8. Run the read-only 15five pilot verifier.

The first live pilot is successful only when generation completes, citations
validate, required human review markers are present, the repeated manifest is a
full cache hit, and the pilot verifier passes.

## Risks and Mitigations

- **ChatGPT UI selector drift:** keep all browser selectors isolated in
  `llmChat.ts` and retain focused selector-boundary tests.
- **ChatGPT usage limits:** use two tabs only, preserve cache hits, and rely on
  resumable jobs rather than aggressive retries.
- **Long runtime:** report durable progress through existing SSE and avoid
  repeating completed evidence.
- **Non-deterministic prose:** require strict JSON parsing and existing schema
  validation; never accept best-effort text.
- **Login expiry:** fail safely, close the pool, and resume after authentication.
