# Sites Crawl Fail-and-Continue Design

## Goal

One malformed or unsupported Mobbin Site must never stop the Sites catalog
crawl. Every Site crawl error is terminal for that Site and the worker
continues with the next queued Site.

## Runtime behavior

- When a Site crawl throws any error, record its job as `error` with a safe,
  redacted message.
- Resolve the queue handler after recording the failure so RabbitMQ
  acknowledges that message.
- Consume the next queued Site immediately.
- Do not retry crawl errors.
- Preserve intentional job cancellation as `cancelled`, not `error`.
- Startup failures that occur before an individual job is consumed remain
  worker-level failures because there is no Site job to mark.

## Failure boundary

The Mobbin response listener must not reject an unobserved Promise. It will
settle a success-or-error result and surface the error only from the awaited
crawler call. This keeps the exception inside the pipeline handler, where the
job can be marked failed without terminating Node or disconnecting the
RabbitMQ consumer.

## Verification

- A regression test reproduces a source-capture error arriving before the
  crawler awaits the result and proves it does not become an unhandled
  rejection.
- A pipeline test proves every non-cancellation crawl error sets the job to
  `error` and resolves instead of asking RabbitMQ to retry.
- Existing success and cancellation tests remain green.
- Live verification confirms the worker remains healthy, Biograph is marked
  failed, and the next queued Site begins running.
