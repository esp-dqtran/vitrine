import assert from "node:assert/strict";
import test from "node:test";
import type { ConsumeMessage } from "amqplib";
import {
  createSitesQueue,
  parseSitesJob,
  SITES_DLQ_NAME,
  SITES_MAX_ATTEMPTS,
  SITES_QUEUE_NAME,
} from "./sitesQueue.ts";

const approved =
  "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview";

test("Sites parser accepts only an identifier-only import-site job", () => {
  assert.deepEqual(parseSitesJob({ type: "import-site", url: `${approved}/`, jobId: 7 }), {
    type: "import-site",
    url: approved,
    jobId: 7,
  });
  for (const value of [
    { type: "import-app", url: approved, jobId: 7 },
    { type: "import-site", url: approved, jobId: 0 },
    { type: "import-site", url: `${approved}?token=secret`, jobId: 7 },
    { type: "import-site", url: approved, jobId: 7, name: "v7" },
  ]) {
    assert.throws(() => parseSitesJob(value), /invalid Sites queue job/i);
  }
});

test("Sites queue owns durable declarations and persistent publishing", async () => {
  const fake = fakeBroker();
  const queue = createSitesQueue(fake.connect, "amqp://fixture");

  await queue.publish({ type: "import-site", url: approved, jobId: 9 });

  assert.deepEqual(fake.events.slice(0, 3), [
    ["connect", "amqp://fixture"],
    ["assertQueue", SITES_DLQ_NAME, { durable: true }],
    ["assertQueue", SITES_QUEUE_NAME, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": SITES_DLQ_NAME,
      },
    }],
  ]);
  const publish = fake.events.find((event) => event[0] === "sendToQueue");
  assert.equal(publish?.[1], SITES_QUEUE_NAME);
  assert.deepEqual(publish?.[3], { persistent: true, headers: { "x-attempt": 1 } });
  assert.deepEqual(JSON.parse((publish?.[2] as Buffer).toString()), {
    type: "import-site",
    url: approved,
    jobId: 9,
  });
  await queue.close();
  assert.deepEqual(fake.events.slice(-2), [["channel.close"], ["connection.close"]]);
});

test("Sites queue retries 1 to 2 to 3, then dead-letters", async () => {
  const fake = fakeBroker();
  const queue = createSitesQueue(fake.connect);
  const attempts: number[] = [];
  const previousError = console.error;
  console.error = () => undefined;
  try {
    await queue.consume(async (_job, context) => {
      attempts.push(context.attempt);
      throw new Error("fixture failure");
    });

    assert.ok(fake.consumer);
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
    if (event[0] === "sendToQueue") return [event[0], (event[3] as { headers: { "x-attempt": number } }).headers["x-attempt"]];
    return event;
  }), [
    ["sendToQueue", 2],
    ["ack", 1],
    ["sendToQueue", 3],
    ["ack", 2],
    ["nack", 3, false, false],
  ]);
  assert.equal(SITES_MAX_ATTEMPTS, 3);
});

function message(attempt: number): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ type: "import-site", url: approved, jobId: 7 })),
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
    prefetch: async (count: number) => {
      events.push(["prefetch", count]);
    },
    consume: async (_name: string, handler: typeof consumer) => {
      consumer = handler;
      events.push(["consume", _name]);
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
  return {
    events,
    connect,
    get consumer() {
      return consumer;
    },
  };
}
