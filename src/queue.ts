import amqp, { type ChannelModel, type Channel } from "amqplib";
import { isIP } from "node:net";
import { isAppSlug } from "./imageSource.ts";
import { isPlatform, type Platform } from "./platformFromUrl.ts";

const QUEUE_NAME = "mobbin-jobs";
const DLQ_NAME = "mobbin-jobs.dlq";
const MAX_ATTEMPTS = 3;
const SENSITIVE_URL_KEY = /password|passwd|pwd|secret|token|apikey|privatekey|authorization|auth|cookie|sessionid|credential|signature/i;

export type ResearchProvider = "chatgpt" | "claude";

export type Job = (
  | { type: "discover-catalog" }
  | { type: "import-app"; name: string; url: string; platform: Platform }
  | { type: "caption-app"; name: string }
  | { type: "synthesize-app"; name: string; platform: Platform }
  | { type: "research-app"; name: string; homepageUrl: string; provider?: ResearchProvider }
  | { type: "smart-crawl-app"; name: string; runId: string }
  | { type: "autonomous-crawl-app"; name: string; runId: string }
  | { type: "generate-feature-document"; runId: string }
  | { type: "generate-app-knowledge"; runId: string }
) & { jobId?: number };

export function appKnowledgeQueueJob(
  durableJobId: number,
  transportJobId: number,
): Job {
  if (
    !Number.isSafeInteger(durableJobId) || durableJobId <= 0
    || !Number.isSafeInteger(transportJobId) || transportJobId <= 0
  ) invalidJob();
  return {
    type: "generate-app-knowledge",
    runId: String(durableJobId),
    jobId: transportJobId,
  };
}

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

function invalidJob(): never {
  throw new Error("Invalid queue job");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidJob();
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = new Set(allowed);
  if (Object.entries(value).some(([key, item]) => item !== undefined && !keys.has(key))) invalidJob();
}

function appSlug(value: unknown): string {
  if (typeof value !== "string" || !isAppSlug(value)) invalidJob();
  return value;
}

function nonPublicIpv4(value: string): boolean {
  const [a, b, c] = value.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2))))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0 && c === 113);
}

function mappedIpv4(value: string): string | undefined {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(value);
  if (!match) return undefined;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function publicUrl(value: unknown): string {
  if (typeof value !== "string") invalidJob();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalidJob();
  }
  const host = url.hostname.toLowerCase();
  const ipHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const ip = isIP(ipHost);
  const mapped = ip === 6 ? mappedIpv4(ipHost) : undefined;
  const blockedIpv4 = ip === 4 && nonPublicIpv4(ipHost);
  const blockedIpv6 = ip === 6 && (
    ipHost === "::" || ipHost === "::1"
    || /^(?:fc|fd|fe[89ab]|ff)/i.test(ipHost)
    || (mapped !== undefined && nonPublicIpv4(mapped))
  );
  const sensitiveQuery = [...url.searchParams.keys()].some((key) =>
    SENSITIVE_URL_KEY.test(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.username || url.password
    || url.hash || sensitiveQuery
    || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
    || blockedIpv4 || blockedIpv6
  ) invalidJob();
  return value;
}

function platformValue(value: unknown): Platform {
  if (typeof value !== "string" || !isPlatform(value)) invalidJob();
  return value;
}

function researchProvider(value: unknown): ResearchProvider | undefined {
  if (value === undefined) return undefined;
  if (value !== "chatgpt" && value !== "claude") invalidJob();
  return value;
}

function optionalJobId(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) invalidJob();
  return value as number;
}

export function parseJob(value: unknown): Job {
  const input = object(value);
  const type = input.type;
  const jobId = optionalJobId(input.jobId);
  const withJobId = <T extends object>(job: T): T & { jobId?: number } => jobId === undefined ? job : { ...job, jobId };
  if (type === "discover-catalog") {
    exactKeys(input, ["type", "jobId"]);
    return withJobId({ type });
  }
  if (type === "import-app") {
    exactKeys(input, ["type", "name", "url", "platform", "jobId"]);
    return withJobId({ type, name: appSlug(input.name), url: publicUrl(input.url), platform: platformValue(input.platform) });
  }
  if (type === "caption-app") {
    exactKeys(input, ["type", "name", "jobId"]);
    return withJobId({ type, name: appSlug(input.name) });
  }
  if (type === "synthesize-app") {
    exactKeys(input, ["type", "name", "platform", "jobId"]);
    return withJobId({ type, name: appSlug(input.name), platform: platformValue(input.platform) });
  }
  if (type === "research-app") {
    exactKeys(input, ["type", "name", "homepageUrl", "provider", "jobId"]);
    const provider = researchProvider(input.provider);
    return withJobId({
      type,
      name: appSlug(input.name),
      homepageUrl: publicUrl(input.homepageUrl),
      ...(provider === undefined ? {} : { provider }),
    });
  }
  if (type === "smart-crawl-app") {
    exactKeys(input, ["type", "name", "runId", "jobId"]);
    if (typeof input.runId !== "string" || !/^[1-9]\d*$/.test(input.runId)) invalidJob();
    return withJobId({ type, name: appSlug(input.name), runId: input.runId });
  }
  if (type === "autonomous-crawl-app") {
    exactKeys(input, ["type", "name", "runId", "jobId"]);
    if (typeof input.runId !== "string" || !/^[1-9]\d*$/.test(input.runId)) invalidJob();
    return withJobId({ type, name: appSlug(input.name), runId: input.runId });
  }
  if (type === "generate-feature-document") {
    exactKeys(input, ["type", "runId", "jobId"]);
    if (typeof input.runId !== "string" || !/^[1-9]\d*$/.test(input.runId)) invalidJob();
    return withJobId({ type, runId: input.runId });
  }
  if (type === "generate-app-knowledge") {
    exactKeys(input, ["type", "runId", "jobId"]);
    if (typeof input.runId !== "string" || !/^[1-9]\d*$/.test(input.runId)) invalidJob();
    return withJobId({ type, runId: input.runId });
  }
  return invalidJob();
}

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
  const parsed = parseJob(job);
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(parsed)), {
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
    let job: Job | undefined;
    try {
      job = parseJob(JSON.parse(msg.content.toString()));
      await handler(job);
      ch.ack(msg);
    } catch (e) {
      console.error(`Job failed (attempt ${attempt}/${MAX_ATTEMPTS}, type=${job?.type ?? "invalid"}):`, e);
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
