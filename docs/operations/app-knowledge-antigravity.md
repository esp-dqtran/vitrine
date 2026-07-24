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
