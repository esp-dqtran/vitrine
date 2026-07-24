# App Knowledge with Antigravity

Use the signed-in Antigravity desktop application as the App Knowledge
analysis provider without an API key:

```env
APP_KNOWLEDGE_PROVIDER=antigravity-browser
APP_KNOWLEDGE_BROWSER_CONCURRENCY=1
```

Open Antigravity and leave one conversation visible. The local worker reads
Antigravity's `DevToolsActivePort`, attaches to that desktop window, selects
`Gemini 3.6 Flash (High)`, starts a fresh conversation per evidence item, and
uploads the verified image bytes. It does not use `agy --print @image` because
that path does not reliably attach image content.

Antigravity is a single interactive lane. Do not use its conversation window
while the worker is analyzing evidence. The adapter waits for Antigravity's
loading state to clear before accepting a stable reply, and the evidence prompt
caps long arrays so a large screen does not produce truncated JSON.

Install the supervised import worker on the same macOS host as Antigravity:

```shell
npm run service:antigravity-worker:install
npm run service:antigravity-worker:status
```

The LaunchAgent starts at login, restarts after unexpected exits, and writes
`data/logs/antigravity-worker.stdout.log` and
`data/logs/antigravity-worker.stderr.log`. Installation fails if a manual host
worker or the Docker `import-worker` is already active, preventing duplicate
RabbitMQ consumers. To remove only the host service, run
`npm run service:antigravity-worker:uninstall`.

The Docker worker cannot use the loopback-only desktop CDP endpoint. If the
worker reports `provider_unavailable`, confirm that Antigravity is running,
signed in, and showing a conversation, then resume the durable App Knowledge
job. Completed evidence and cache records remain durable.

The first run for a capture version validates every referenced object before
analysis begins. Large versions can spend several minutes in
`validating_evidence` with zero analyzed items while S3 reads, hashes, and image
normalization are active.

## Design-system synthesis and resume

After screen evidence is complete, the worker extracts the design system from
compact screen signals in deterministic chunks. It does not copy duplicate
Flow steps into the synthesis payload and it does not send the original image
bytes again. Each validated chunk is stored in
`app_knowledge_design_system_chunks` before the next chunk runs.

The default signal ceiling is 120 KB per chunk with one synthesis call at a
time. A resumed job reuses every completed chunk, retries only pending or
failed chunks, then sends the compact validated fragments through one final
deduplication merge. The canonical screen catalog is assembled locally from
the completed evidence analyses; full-page screenshots can create only
`candidate` components.

If synthesis fails:

1. Keep Antigravity open, signed in, and on a conversation.
2. Resume the durable App Knowledge job through the normal resume action.
3. Do not delete evidence cache or synthesis-chunk rows. They are the resume
   boundary that prevents successful work from being repeated.

`ANTIGRAVITY_CDP_ENDPOINT` is an optional override for a locally reachable CDP
endpoint. Do not expose the endpoint beyond the local machine.

## Automatic Design System rollout

Automatic extraction is disabled unless both the feature flag and an exact
app/platform allowlist entry are present. An empty allowlist enables nothing.
For the first production pilot, use only:

```env
APP_KNOWLEDGE_AUTO_GENERATE=1
APP_KNOWLEDGE_AUTO_ALLOWLIST=15five:web
APP_KNOWLEDGE_DESIGN_PROMPT_VERSION=2
APP_KNOWLEDGE_DESIGN_CHUNK_BYTES=24000
APP_KNOWLEDGE_DESIGN_CHUNK_CONCURRENCY=3
APP_KNOWLEDGE_FLOW_CHUNK_BYTES=24000
```

Restart the import worker after changing these values. Configuration is parsed
once when the worker starts. A completed, fully verified Crawl Data job is
persisted before its automatic handoff is attempted. The handoff identity
includes app, platform, capture version, source hash, provider model, and
prompt version, so repeating an unchanged handoff reuses the durable job.

Keep the rollout in this order:

1. Run `15five:web` and leave every other target excluded.
2. Run `npm run analysis:pilot:verify` against the authorized database.
3. Review the generated draft and crop specimens in the Design System tab.
4. Add a small number of newly crawled app/platform targets.
5. Only after those pass, enqueue a bounded historical backfill.

Do not expand the allowlist when the verifier returns a failed gate. The
verifier uses a read-only transaction and prints counts and invariant names;
it never prints prompts, credentials, object keys, or provider responses.

## Recovery

- **Queued job without a RabbitMQ consumer:** run the bounded automatic-job
  reconciliation path. It republishes only durable queued automatic jobs whose
  transport is not already queued or running.
- **Failed evidence or synthesis chunk:** use retry-failed-evidence. Completed
  evidence cache rows and completed design-system chunks remain the resume
  boundary; do not delete them.
- **Provider rate limit:** pause the consumer, wait for the provider window to
  recover, then resume the same durable job. Keep browser concurrency at one
  for Antigravity.
- **Source changed during analysis:** treat the job as stale. Finish or verify
  the new crawl, then create a new automatic identity from its new source hash.
  Never force the stale revision into the working copy.
- **Rejected crop:** inspect the source occurrence. Rejections mean the region
  was out of bounds, smaller than 16 by 16 pixels, effectively full-screen, or
  lacked verified source/object metadata. The component may remain an inferred
  preview, but the rejected crop must not be presented as observed evidence.
- **Working-copy conflict:** keep the current imported, reviewed, or
  human-edited Design System unchanged. Review the generated App Knowledge
  revision separately; never overwrite the protected working copy.

The Design System tab follows job progress over SSE. It makes one initial
analysis read and one Design System reload when the job completes; it does not
poll. During regeneration, the previous draft stays visible until the new
candidate is safely available.
