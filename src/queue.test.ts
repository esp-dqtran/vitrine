import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJob, publishJob } from "./queue.ts";

test("queue accepts identifier-only durable crawler jobs and preserves BIGINT run ids as strings", () => {
  assert.deepEqual(parseJob({
    type: "research-app",
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/",
    provider: "chatgpt",
    jobId: 7,
  }), {
    type: "research-app",
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/",
    provider: "chatgpt",
    jobId: 7,
  });
  assert.deepEqual(parseJob({
    type: "smart-crawl-app",
    name: "atlassian",
    runId: "9223372036854775807",
  }), {
    type: "smart-crawl-app",
    name: "atlassian",
    runId: "9223372036854775807",
  });
  assert.deepEqual(parseJob({
    type: "autonomous-crawl-app",
    name: "linear",
    runId: "42",
  }), {
    type: "autonomous-crawl-app",
    name: "linear",
    runId: "42",
  });
});

test("Apps queue rejects isolated Sites jobs", () => {
  assert.throws(
    () => parseJob({ type: "import-site", url: "https://mobbin.com/sites/site/version/preview", jobId: 7 }),
    /invalid queue job/i,
  );
});

test("autonomous queue jobs reject embedded credentials and mission data", () => {
  for (const value of [
    { type: "autonomous-crawl-app", name: "linear", runId: "42", password: "secret" },
    { type: "autonomous-crawl-app", name: "linear", runId: "42", url: "https://app.test" },
    { type: "autonomous-crawl-app", name: "linear", runId: "42", mission: {} },
    { type: "autonomous-crawl-app", name: "linear", runId: 42 },
  ]) assert.throws(() => parseJob(value), /invalid queue job/i);
});

test("queue rejects embedded plans, secret fields, non-string run ids, and non-public research URLs", () => {
  const invalid = [
    { type: "smart-crawl-app", name: "atlassian", runId: 12 },
    { type: "smart-crawl-app", name: "atlassian", runId: "12", plan: { flows: [] } },
    { type: "research-app", name: "atlassian", homepageUrl: "https://user:password@example.com" },
    { type: "research-app", name: "atlassian", homepageUrl: "http://127.0.0.1", token: "secret" },
    { type: "research-app", name: "atlassian", homepageUrl: "http://[::1]" },
  ];
  for (const value of invalid) assert.throws(() => parseJob(value), /invalid queue job/i);
});

test("publishing validates the payload before opening a broker connection", async () => {
  const previous = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = "amqp://127.0.0.1:1";
  try {
    await assert.rejects(
      () => publishJob({ type: "smart-crawl-app", name: "atlassian", runId: "1", plan: {} } as never),
      /invalid queue job/i,
    );
  } finally {
    if (previous === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previous;
  }
});

test("queue rejects secret-bearing research URLs and unsupported providers without echoing values", () => {
  assert.deepEqual(parseJob({
    type: "research-app",
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/?locale=en",
    provider: "claude",
  }), {
    type: "research-app",
    name: "atlassian",
    homepageUrl: "https://www.atlassian.com/?locale=en",
    provider: "claude",
  });

  const invalid = [
    { type: "research-app", name: "atlassian", homepageUrl: "https://example.com/?token=TOPSECRET" },
    { type: "research-app", name: "atlassian", homepageUrl: "https://example.com/?api_key=TOPSECRET" },
    { type: "research-app", name: "atlassian", homepageUrl: "https://example.com/#access_token=TOPSECRET" },
    { type: "research-app", name: "atlassian", homepageUrl: "https://example.com/", provider: "TOPSECRET" },
  ];
  for (const value of invalid) {
    assert.throws(
      () => parseJob(value),
      (error) => error instanceof Error && /invalid queue job/i.test(error.message) && !error.message.includes("TOPSECRET"),
    );
  }
});

test("queue rejects hex-form IPv4-mapped IPv6 private and link-local addresses", () => {
  for (const homepageUrl of [
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:a00:1]/",
    "http://[::ffff:a9fe:1]/",
    "http://[::ffff:ac10:1]/",
    "http://[::ffff:c0a8:1]/",
    "http://[::ffff:6440:1]/",
  ]) {
    assert.throws(
      () => parseJob({ type: "research-app", name: "atlassian", homepageUrl }),
      /invalid queue job/i,
    );
  }
});
