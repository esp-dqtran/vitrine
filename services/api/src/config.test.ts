import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  adminSeedFromEnv,
  apiRuntimeConfigFromEnv,
  billingConfigFromEnv,
  optionalBillingConfigFromEnv,
  referralCampaignFromEnv,
} from "./config.ts";

function runtimeEnvironment() {
  return {
    APP_URL: "https://astryx.example/",
    MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
    CRAWL_SESSION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };
}

test("requires valid admin seed variables", () => {
  assert.throws(() => adminSeedFromEnv({}), /ADMIN_EMAIL/);
  assert.throws(() => adminSeedFromEnv({ ADMIN_EMAIL: "admin@example.com" }), /ADMIN_PASSWORD/);
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "invalid",
        ADMIN_PASSWORD: "1234567890123456",
      }),
    /ADMIN_EMAIL/
  );
  assert.throws(
    () =>
      adminSeedFromEnv({
        ADMIN_EMAIL: "admin@example.com",
        ADMIN_PASSWORD: "too-short",
      }),
    /16 characters/
  );
});

test("normalizes a valid admin seed", () => {
  assert.deepEqual(
    adminSeedFromEnv({
      ADMIN_EMAIL: " Admin@Example.com ",
      ADMIN_PASSWORD: "1234567890123456",
    }),
    { email: "admin@example.com", password: "1234567890123456" }
  );
});

test("requires all billing and media-security variables", () => {
  assert.throws(() => billingConfigFromEnv({}), /PADDLE_API_KEY/);
  assert.throws(
    () => billingConfigFromEnv({ PADDLE_API_KEY: "pdl_test_x" }),
    /PADDLE_WEBHOOK_SECRET/,
  );
});

test("keeps billing disabled until Paddle configuration is supplied", () => {
  const runtime = runtimeEnvironment();
  assert.equal(optionalBillingConfigFromEnv(runtime), undefined);
  assert.deepEqual(apiRuntimeConfigFromEnv(runtime), {
    appUrl: "https://astryx.example",
    mediaSigningSecret: runtime.MEDIA_SIGNING_SECRET,
    crawlSessionEncryptionKey: runtime.CRAWL_SESSION_ENCRYPTION_KEY,
    generalRateLimit: 300,
    mediaRateLimit: 500,
    appTraversalLimit: 20,
  });
  assert.throws(
    () => optionalBillingConfigFromEnv({ ...runtime, PADDLE_ENVIRONMENT: "production" }),
    /PADDLE_API_KEY/,
  );
});

test("requires a 32-byte base64 crawl-session encryption key", () => {
  const base = {
    PADDLE_API_KEY: "pdl_test_x",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_x",
    PADDLE_PRO_MONTHLY_PRICE_ID: "pri_month",
    PADDLE_PRO_YEARLY_PRICE_ID: "pri_year",
    APP_URL: "https://astryx.example",
    MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
  };
  assert.throws(() => billingConfigFromEnv(base), /CRAWL_SESSION_ENCRYPTION_KEY/);
  assert.throws(
    () => billingConfigFromEnv({ ...base, CRAWL_SESSION_ENCRYPTION_KEY: randomBytes(31).toString("base64") }),
    /32 bytes/,
  );
});

test("parses billing and limiter configuration", () => {
  const crawlSessionEncryptionKey = randomBytes(32).toString("base64");
  assert.deepEqual(
    billingConfigFromEnv({
      PADDLE_API_KEY: "pdl_test_x",
      PADDLE_WEBHOOK_SECRET: "pdl_ntfset_x",
      PADDLE_PRO_MONTHLY_PRICE_ID: "pri_month",
      PADDLE_PRO_YEARLY_PRICE_ID: "pri_year",
      APP_URL: "https://astryx.example/",
      MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
      CRAWL_SESSION_ENCRYPTION_KEY: crawlSessionEncryptionKey,
      GENERAL_RATE_LIMIT: "300",
      MEDIA_RATE_LIMIT: "500",
      APP_TRAVERSAL_LIMIT: "20",
    }),
    {
      paddleApiKey: "pdl_test_x",
      paddleWebhookSecret: "pdl_ntfset_x",
      paddleEnvironment: "sandbox",
      monthlyPriceId: "pri_month",
      yearlyPriceId: "pri_year",
      teamYearlyPriceId: undefined,
      appUrl: "https://astryx.example",
      mediaSigningSecret: "0123456789abcdef0123456789abcdef",
      crawlSessionEncryptionKey,
      generalRateLimit: 300,
      mediaRateLimit: 500,
      appTraversalLimit: 20,
    },
  );
});

test("rejects an unknown Paddle environment", () => {
  assert.throws(() => billingConfigFromEnv({
    PADDLE_API_KEY: "pdl_test_x",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_x",
    PADDLE_ENVIRONMENT: "test",
    PADDLE_PRO_MONTHLY_PRICE_ID: "pri_month",
    PADDLE_PRO_YEARLY_PRICE_ID: "pri_year",
    APP_URL: "https://astryx.example",
    MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
    CRAWL_SESSION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  }), /PADDLE_ENVIRONMENT/);
});

test("parses the bounded launch referral campaign", () => {
  assert.deepEqual(referralCampaignFromEnv({
    REFERRAL_CAMPAIGN_ID: "launch-2026",
    REFERRAL_CAMPAIGN_START: "2026-07-21T00:00:00Z",
    REFERRAL_CAMPAIGN_END: "2026-10-19T00:00:00Z",
  }), {
    id: "launch-2026",
    startsAt: new Date("2026-07-21T00:00:00Z"),
    endsAt: new Date("2026-10-19T00:00:00Z"),
    rewardCap: 3,
  });
  assert.throws(() => referralCampaignFromEnv({}), /REFERRAL_CAMPAIGN_ID/);
  assert.throws(() => referralCampaignFromEnv({
    REFERRAL_CAMPAIGN_ID: "launch-2026",
    REFERRAL_CAMPAIGN_START: "not-a-date",
    REFERRAL_CAMPAIGN_END: "2026-10-19T00:00:00Z",
  }), /REFERRAL_CAMPAIGN_START/);
  assert.throws(() => referralCampaignFromEnv({
    REFERRAL_CAMPAIGN_ID: "launch-2026",
    REFERRAL_CAMPAIGN_START: "2026-10-19T00:00:00Z",
    REFERRAL_CAMPAIGN_END: "2026-07-21T00:00:00Z",
  }), /must be after start/);
});
