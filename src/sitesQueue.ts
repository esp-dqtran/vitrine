import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import { canonicalMobbinSitesUrl } from "./sites.ts";

export const SITES_QUEUE_NAME = "mobbin-sites-jobs";
export const SITES_DLQ_NAME = "mobbin-sites-jobs.dlq";
export const SITES_MAX_ATTEMPTS = 3;

export type SitesJob = {
  type: "import-site";
  url: string;
  jobId: number;
};

export interface SitesAttempt {
  attempt: number;
  maxAttempts: number;
}

export interface SitesQueue {
  publish(job: SitesJob): Promise<void>;
  consume(
    handler: (job: SitesJob, context: SitesAttempt) => Promise<void>,
  ): Promise<void>;
  close(): Promise<void>;
}

function invalidSitesJob(): never {
  throw new Error("Invalid Sites queue job");
}

export function parseSitesJob(value: unknown): SitesJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidSitesJob();
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 3 ||
    !["type", "url", "jobId"].every((key) => key in input) ||
    input.type !== "import-site" ||
    typeof input.url !== "string" ||
    !Number.isSafeInteger(input.jobId) ||
    (input.jobId as number) <= 0
  ) {
    invalidSitesJob();
  }
  try {
    return {
      type: "import-site",
      url: canonicalMobbinSitesUrl(input.url).canonicalUrl,
      jobId: input.jobId as number,
    };
  } catch {
    return invalidSitesJob();
  }
}

export function createSitesQueue(
  connect: typeof amqp.connect,
  url = process.env.RABBITMQ_URL ?? "amqp://localhost",
): SitesQueue {
  let connection: ChannelModel | undefined;
  let channelPromise: Promise<Channel> | undefined;

  const getChannel = async (): Promise<Channel> => {
    if (!channelPromise) {
      channelPromise = (async () => {
        connection = await connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue(SITES_DLQ_NAME, { durable: true });
        await channel.assertQueue(SITES_QUEUE_NAME, {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": SITES_DLQ_NAME,
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
      const parsed = parseSitesJob(job);
      const channel = await getChannel();
      channel.sendToQueue(
        SITES_QUEUE_NAME,
        Buffer.from(JSON.stringify(parsed)),
        { persistent: true, headers: { "x-attempt": 1 } },
      );
    },

    async consume(handler) {
      const channel = await getChannel();
      await channel.prefetch(1);
      await channel.consume(SITES_QUEUE_NAME, async (message) => {
        if (!message) return;
        const attempt = attemptFrom(message);
        let job: SitesJob | undefined;
        try {
          job = parseSitesJob(JSON.parse(message.content.toString("utf8")));
          await handler(job, { attempt, maxAttempts: SITES_MAX_ATTEMPTS });
          channel.ack(message);
        } catch {
          console.error(
            `Sites job failed (attempt ${attempt}/${SITES_MAX_ATTEMPTS}, type=${job?.type ?? "invalid"})`,
          );
          if (attempt >= SITES_MAX_ATTEMPTS) {
            channel.nack(message, false, false);
          } else {
            channel.sendToQueue(SITES_QUEUE_NAME, message.content, {
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

let productionQueue: SitesQueue | undefined;

function liveSitesQueue(): SitesQueue {
  productionQueue ??= createSitesQueue(amqp.connect);
  return productionQueue;
}

export function publishSitesJob(job: SitesJob): Promise<void> {
  return liveSitesQueue().publish(job);
}

export function consumeSitesJobs(
  handler: (job: SitesJob, context: SitesAttempt) => Promise<void>,
): Promise<void> {
  return liveSitesQueue().consume(handler);
}

export async function closeSitesQueue(): Promise<void> {
  const queue = productionQueue;
  productionQueue = undefined;
  await queue?.close();
}
