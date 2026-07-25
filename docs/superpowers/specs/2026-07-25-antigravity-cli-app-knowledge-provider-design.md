# Antigravity CLI App Knowledge Provider Design

## Goal

Run Astryx App Knowledge screen analysis through the installed Antigravity CLI
instead of controlling the Antigravity desktop IDE. The provider must use the
exact model `gemini-3.6-flash-high`, preserve the current durable
evidence/synthesis resume boundaries, and prove that the CLI can see image
pixels before any real screen is submitted.

## Scope

This change adds an `antigravity-cli` App Knowledge provider and the tests and
operations documentation needed to use it.

It does not:

- automate the Antigravity IDE;
- add a general-purpose Antigravity SDK;
- change App Knowledge prompts, schemas, revisions, or evidence caching;
- delete or recreate the preserved manifest, completed evidence, or synthesis
  chunks;
- apply database migrations or resume a production job without separate,
  explicit authorization.

## Provider Configuration

Selecting the provider uses:

```env
APP_KNOWLEDGE_PROVIDER=antigravity-cli
```

The provider configuration reports model `gemini-3.6-flash-high` and fixed
concurrency `1`. The executable defaults to `agy`; tests may inject a fake
executable or process runner. The production model is not configurable so a
stale or misspelled environment value cannot silently change durable job
identity.

The existing `antigravity-browser` and `chatgpt-browser` providers remain
available and unchanged.

## CLI Invocation

Each request starts a fresh non-interactive CLI process without a shell:

```text
agy --model gemini-3.6-flash-high --print --print-timeout 6m <prompt>
```

For evidence analysis, the adapter writes the already validated and normalized
image bytes to a uniquely named temporary file, adds the file as an absolute
`@<path>` reference in the prompt, and removes the temporary directory after
the process settles. Synthesis requests contain text only and do not create a
temporary image.

Arguments are passed as an array to the child-process API. Prompts and paths
are never interpolated into a shell command. The worker keeps only one CLI
request active at a time.

## Pixel-Visibility Capability Gate

Antigravity documents media attachment for its interactive terminal UI but
does not document a reliable non-interactive image-attachment flag. Therefore,
CLI availability alone is insufficient.

Before constructing the production provider, the worker runs one bounded
capability probe:

1. Generate a small, non-sensitive image containing a random visual token whose
   value is not present in the prompt.
2. Submit that image through the same temporary-file and `@<path>` mechanism
   used for real evidence.
3. Require strict JSON containing the exact visual token.
4. Reject a generic, inferred, malformed, or mismatched answer.

The token is random per worker start so a memorized response cannot satisfy the
gate. A successful probe is cached only in that worker process. Every new
worker process proves the capability again.

If the probe fails, provider initialization fails with
`provider_unavailable`. No durable evidence item is claimed or marked failed,
and the worker must not fall back to IDE automation automatically.

## Adapter Boundary

A focused Antigravity CLI session abstraction owns:

- executable lookup and argv construction;
- temporary image lifetime;
- child-process stdout and stderr capture;
- timeout and abort propagation;
- output-size limits;
- response extraction.

The App Knowledge provider above that session reuses the existing prompt
builders and validation pipeline for:

- evidence analysis;
- whole-app synthesis;
- Flow synthesis;
- Design System chunk synthesis;
- Design System merge.

The provider returns parsed JSON-compatible values through the existing
`AppKnowledgeProvider` interface. No downstream worker or store API changes are
required.

## Output Contract

The CLI response must contain exactly one JSON object, optionally surrounded by
one Markdown JSON fence and leading or trailing whitespace. Any other prose,
multiple JSON values, truncation, or invalid JSON is rejected.

stderr is retained only as a bounded diagnostic source. User prompts, image
bytes, credentials, `.env` values, and full model responses are not logged.
Safe errors may include the executable name, exit code, timeout/abort state, and
a short redacted stderr summary.

## Cancellation, Timeout, and Cleanup

The adapter combines the caller's `AbortSignal` with a local deadline slightly
longer than the CLI's six-minute print timeout. On cancellation or timeout it
terminates the child process, waits for process settlement, and then removes
the temporary directory.

Non-zero exit, spawn failure, timeout, abort, oversized output, malformed JSON,
and a failed capability gate are explicit errors. Cleanup runs for every
outcome, including partial process startup.

## Durable Resume Behavior

The provider does not introduce a new persistence path. App Knowledge keeps
using the existing durable job, manifest, evidence-cache, Flow synthesis, and
Design System chunk boundaries.

Operational activation follows this order:

1. Deploy the provider code and configure `antigravity-cli`.
2. Confirm the application schema is current. Applying any pending migration
   to the Vitrine Supabase application database requires separate, explicit
   user authorization.
3. Start one supervised import worker.
4. Let the pixel-visibility gate pass.
5. Resume cancelled App Knowledge job `3` through the existing resume path,
   reusing its preserved manifest and any completed cache rows.
6. Confirm one worker and one RabbitMQ consumer before allowing evidence work
   to continue.

If the gate or provider is unavailable, the job remains resumable. The worker
does not erase evidence or switch providers implicitly.

## Testing

Tests use a fake CLI executable or injected runner and never call the real
Antigravity account.

Coverage includes:

- environment selection, fixed model, and fixed concurrency;
- exact argv with no shell;
- evidence prompt receives an absolute image reference;
- synthesis does not create or attach an image;
- strict JSON and fenced-JSON acceptance;
- prose, multiple values, invalid JSON, and oversized output rejection;
- non-zero exit and spawn failure mapping;
- caller abort and deadline termination;
- temporary-file cleanup on success and every failure path;
- capability gate success only when the hidden pixel token matches;
- capability gate failure prevents provider construction;
- worker wiring selects the CLI provider without opening a browser or IDE;
- existing browser-provider tests remain green.

## Acceptance Criteria

1. `APP_KNOWLEDGE_PROVIDER=antigravity-cli` selects a provider whose durable
   model identity is exactly `gemini-3.6-flash-high`.
2. No Antigravity IDE window, CDP endpoint, Playwright browser, or clipboard
   automation is used.
3. A fresh worker proves real pixel visibility before it can analyze an App
   Knowledge evidence item.
4. Each request is single-lane, cancellable, bounded, strict-JSON-only, and
   cleans up its temporary files.
5. A failed probe or CLI process fails closed without consuming or corrupting
   durable evidence.
6. After separately authorized schema preparation, job `3` can resume through
   the existing durable path without rebuilding its preserved manifest.
