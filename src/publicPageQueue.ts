import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import { canonicalPublicPageUrl } from "./publicPage.ts";

export const PUBLIC_PAGE_QUEUE_NAME = "public-page-jobs";
export const PUBLIC_PAGE_DLQ_NAME = "public-page-jobs.dlq";
export const PUBLIC_PAGE_MAX_ATTEMPTS = 3;

export type PublicPageJob = {
  type: "crawl-public-page";
  url: string;
  jobId: number;
};

export interface PublicPageAttempt {
  attempt: number;
  maxAttempts: number;
}

export interface PublicPageQueue {
  publish(job: PublicPageJob): Promise<void>;
  consume(
    handler: (job: PublicPageJob, context: PublicPageAttempt) => Promise<void>,
  ): Promise<void>;
  close(): Promise<void>;
}

function invalidPublicPageJob(): never {
  throw new Error("Invalid public-page queue job");
}

export function parsePublicPageJob(value: unknown): PublicPageJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidPublicPageJob();
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 3 ||
    !["type", "url", "jobId"].every((key) => key in input) ||
    input.type !== "crawl-public-page" ||
    typeof input.url !== "string" ||
    !Number.isSafeInteger(input.jobId) ||
    (input.jobId as number) <= 0
  ) invalidPublicPageJob();
  try {
    return {
      type: "crawl-public-page",
      url: canonicalPublicPageUrl(input.url).requestedUrl,
      jobId: input.jobId as number,
    };
  } catch {
    return invalidPublicPageJob();
  }
}

export function createPublicPageQueue(
  connect: typeof amqp.connect,
  url = process.env.RABBITMQ_URL ?? "amqp://localhost",
): PublicPageQueue {
  let connection: ChannelModel | undefined;
  let channelPromise: Promise<Channel> | undefined;

  const getChannel = async (): Promise<Channel> => {
    if (!channelPromise) {
      channelPromise = (async () => {
        connection = await connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue(PUBLIC_PAGE_DLQ_NAME, { durable: true });
        await channel.assertQueue(PUBLIC_PAGE_QUEUE_NAME, {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": PUBLIC_PAGE_DLQ_NAME,
          },
        });
        return channel;
      })().catch((error) => {
        channelPromise = undefined;
        connection = undefined;
        throw error;
      });
    }
    return channelPromise;
  };

  return {
    async publish(job) {
      const parsed = parsePublicPageJob(job);
      const channel = await getChannel();
      channel.sendToQueue(
        PUBLIC_PAGE_QUEUE_NAME,
        Buffer.from(JSON.stringify(parsed)),
        { persistent: true, headers: { "x-attempt": 1 } },
      );
    },

    async consume(handler) {
      const channel = await getChannel();
      await channel.prefetch(1);
      await channel.consume(PUBLIC_PAGE_QUEUE_NAME, async (message) => {
        if (!message) return;
        const attempt = attemptFrom(message);
        let job: PublicPageJob | undefined;
        try {
          job = parsePublicPageJob(JSON.parse(message.content.toString("utf8")));
          await handler(job, { attempt, maxAttempts: PUBLIC_PAGE_MAX_ATTEMPTS });
          channel.ack(message);
        } catch {
          console.error(
            `Public-page job failed (attempt ${attempt}/${PUBLIC_PAGE_MAX_ATTEMPTS}, type=${job?.type ?? "invalid"})`,
          );
          if (attempt >= PUBLIC_PAGE_MAX_ATTEMPTS) {
            channel.nack(message, false, false);
          } else {
            channel.sendToQueue(PUBLIC_PAGE_QUEUE_NAME, message.content, {
              persistent: true,
              headers: { "x-attempt": attempt + 1 },
            });
            channel.ack(message);
          }
        }
      });
    },

    async close() {
      const channel = channelPromise ? await channelPromise.catch(() => undefined) : undefined;
      await channel?.close();
      await connection?.close();
      channelPromise = undefined;
      connection = undefined;
    },
  };
}

function attemptFrom(message: ConsumeMessage): number {
  const value = message.properties.headers?.["x-attempt"];
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 1;
}

let productionQueue: PublicPageQueue | undefined;

function livePublicPageQueue(): PublicPageQueue {
  productionQueue ??= createPublicPageQueue(amqp.connect);
  return productionQueue;
}

export function publishPublicPageJob(job: PublicPageJob): Promise<void> {
  return livePublicPageQueue().publish(job);
}

export function consumePublicPageJobs(
  handler: (job: PublicPageJob, context: PublicPageAttempt) => Promise<void>,
): Promise<void> {
  return livePublicPageQueue().consume(handler);
}

export async function closePublicPageQueue(): Promise<void> {
  const queue = productionQueue;
  productionQueue = undefined;
  await queue?.close();
}
