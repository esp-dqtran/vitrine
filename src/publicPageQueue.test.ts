import assert from "node:assert/strict";
import test from "node:test";
import type { ConsumeMessage } from "amqplib";
import { parseJob } from "./queue.ts";
import { parseSitesJob } from "./sitesQueue.ts";
import {
  createPublicPageQueue,
  parsePublicPageJob,
  PUBLIC_PAGE_DLQ_NAME,
  PUBLIC_PAGE_MAX_ATTEMPTS,
  PUBLIC_PAGE_QUEUE_NAME,
} from "./publicPageQueue.ts";

const approved = "https://www.example.com/pricing?currency=usd";

test("public-page parser accepts only an exact public crawl job", () => {
  assert.deepEqual(parsePublicPageJob({ type: "crawl-public-page", url: approved, jobId: 7 }), {
    type: "crawl-public-page",
    url: approved,
    jobId: 7,
  });
  for (const value of [
    { type: "import-app", url: approved, jobId: 7 },
    { type: "crawl-public-page", url: "http://127.0.0.1/admin", jobId: 7 },
    { type: "crawl-public-page", url: approved, jobId: 0 },
    { type: "crawl-public-page", url: approved, jobId: 7, name: "example" },
  ]) assert.throws(() => parsePublicPageJob(value), /invalid public-page queue job/i);

  assert.throws(() => parseJob({ type: "crawl-public-page", url: approved, jobId: 7 } as never));
  assert.throws(() => parseSitesJob({ type: "crawl-public-page", url: approved, jobId: 7 } as never));
});

test("public-page queue owns durable declarations and persistent publishing", async () => {
  const fake = fakeBroker();
  const queue = createPublicPageQueue(fake.connect, "amqp://fixture");

  await queue.publish({ type: "crawl-public-page", url: approved, jobId: 9 });

  assert.deepEqual(fake.events.slice(0, 3), [
    ["connect", "amqp://fixture"],
    ["assertQueue", PUBLIC_PAGE_DLQ_NAME, { durable: true }],
    ["assertQueue", PUBLIC_PAGE_QUEUE_NAME, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": PUBLIC_PAGE_DLQ_NAME,
      },
    }],
  ]);
  const publish = fake.events.find((event) => event[0] === "sendToQueue");
  assert.equal(publish?.[1], PUBLIC_PAGE_QUEUE_NAME);
  assert.deepEqual(publish?.[3], { persistent: true, headers: { "x-attempt": 1 } });
  assert.deepEqual(JSON.parse((publish?.[2] as Buffer).toString()), {
    type: "crawl-public-page",
    url: approved,
    jobId: 9,
  });
  await queue.close();
});

test("public-page queue retries 1 to 2 to 3, then dead-letters", async () => {
  const fake = fakeBroker();
  const queue = createPublicPageQueue(fake.connect);
  const attempts: number[] = [];
  const previousError = console.error;
  console.error = () => undefined;
  try {
    await queue.consume(async (_job, context) => {
      attempts.push(context.attempt);
      throw new Error("fixture failure");
    });
    await fake.consumer!(message(1));
    await fake.consumer!(message(2));
    await fake.consumer!(message(3));
  } finally {
    console.error = previousError;
    await queue.close();
  }

  assert.deepEqual(attempts, [1, 2, 3]);
  assert.ok(fake.events.some((event) => event[0] === "prefetch" && event[1] === 1));
  const retryEvents = fake.events.filter((event) =>
    event[0] === "sendToQueue" || event[0] === "ack" || event[0] === "nack"
  );
  assert.deepEqual(retryEvents.map((event) => {
    if (event[0] === "sendToQueue") {
      return [event[0], (event[3] as { headers: { "x-attempt": number } }).headers["x-attempt"]];
    }
    return event;
  }), [
    ["sendToQueue", 2],
    ["ack", 1],
    ["sendToQueue", 3],
    ["ack", 2],
    ["nack", 3, false, false],
  ]);
  assert.equal(PUBLIC_PAGE_MAX_ATTEMPTS, 3);
});

function message(attempt: number): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ type: "crawl-public-page", url: approved, jobId: 7 })),
    fields: {} as ConsumeMessage["fields"],
    properties: { headers: { "x-attempt": attempt } } as unknown as ConsumeMessage["properties"],
  };
}

function fakeBroker() {
  const events: unknown[][] = [];
  let consumer: ((message: ConsumeMessage | null) => Promise<void>) | undefined;
  const channel = {
    assertQueue: async (name: string, options: unknown) => {
      events.push(["assertQueue", name, options]);
      return { queue: name, messageCount: 0, consumerCount: 0 };
    },
    sendToQueue: (name: string, content: Buffer, options: unknown) => {
      events.push(["sendToQueue", name, content, options]);
      return true;
    },
    prefetch: async (count: number) => { events.push(["prefetch", count]); },
    consume: async (name: string, handler: typeof consumer) => {
      consumer = handler;
      events.push(["consume", name]);
      return { consumerTag: "fixture" };
    },
    ack: (msg: ConsumeMessage) => events.push(["ack", msg.properties.headers?.["x-attempt"]]),
    nack: (msg: ConsumeMessage, allUpTo: boolean, requeue: boolean) =>
      events.push(["nack", msg.properties.headers?.["x-attempt"], allUpTo, requeue]),
    close: async () => events.push(["channel.close"]),
  };
  const connection = {
    createChannel: async () => channel,
    close: async () => events.push(["connection.close"]),
  };
  const connect = (async (url: string) => {
    events.push(["connect", url]);
    return connection;
  }) as never;
  return { events, connect, get consumer() { return consumer; } };
}
