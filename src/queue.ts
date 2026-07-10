import amqp, { type ChannelModel, type Channel } from "amqplib";

const QUEUE_NAME = "mobbin-jobs";
const DLQ_NAME = "mobbin-jobs.dlq";
const MAX_ATTEMPTS = 3;

export type Job = (
  | { type: "discover-catalog" }
  | { type: "import-app"; name: string; url: string }
  | { type: "caption-app"; name: string }
  | { type: "synthesize-app"; name: string }
) & { jobId?: number };

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

// ponytail: no in-process reconnect logic — if the broker connection drops, this process
// exits (unhandled connection error) and docker-compose's `restart: on-failure` brings it
// back up against a fresh connection. Simpler and more standard for a single-node compose
// setup than hand-rolling consumer re-subscription across reconnects.
async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  const url = process.env.RABBITMQ_URL ?? "amqp://localhost";
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertQueue(DLQ_NAME, { durable: true });
  // Only import-worker ever consumes this — dead-lettering here means "gave up after
  // MAX_ATTEMPTS", not "no worker running", so a growing DLQ is the signal to look.
  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: { "x-dead-letter-exchange": "", "x-dead-letter-routing-key": DLQ_NAME },
  });
  return channel;
}

export async function publishJob(job: Job): Promise<void> {
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(job)), {
    persistent: true,
    headers: { "x-attempt": 1 },
  });
}

// Consumes one job at a time (prefetch 1) — the only Mobbin browser session lives in one
// worker process, so there's never a reason to process more than one job concurrently.
export async function consumeJobs(handler: (job: Job) => Promise<void>): Promise<void> {
  const ch = await getChannel();
  await ch.prefetch(1);
  await ch.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const attempt = (msg.properties.headers?.["x-attempt"] as number | undefined) ?? 1;
    const job = JSON.parse(msg.content.toString()) as Job;
    try {
      await handler(job);
      ch.ack(msg);
    } catch (e) {
      console.error(`Job failed (attempt ${attempt}/${MAX_ATTEMPTS}, type=${job.type}):`, e);
      if (attempt >= MAX_ATTEMPTS) {
        ch.nack(msg, false, false); // routes to the DLQ per the queue's dead-letter args
      } else {
        // Republish before acking the original — a crash between the two just means the
        // job is processed twice (already idempotent), never lost.
        ch.sendToQueue(QUEUE_NAME, msg.content, { persistent: true, headers: { "x-attempt": attempt + 1 } });
        ch.ack(msg);
      }
    }
  });
}

export async function closeQueue(): Promise<void> {
  await channel?.close();
  await connection?.close();
}
